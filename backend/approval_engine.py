"""
Approval and delegation routing engine.
Deterministic: derives required approvals from profile, pathway, and overlays.
"""

import json
import re
from pathlib import Path
from models import ProcurementProfile, PathwayResult, ApprovalResult, ApprovalAddition, ApprovalStep

DATA_DIR = Path(__file__).parent / "data"

VALUE_ORDER = ["micro", "low", "medium", "high", "major", "unknown"]
IMPACT_ORDER = ["low", "medium", "high", "critical"]

# DCS agencies recognised by this engine
DCS_AGENCY_IDS = {"nsw_dcs", "nsw_service_nsw"}

# DCS ICT categories (share the same approval chain logic)
DCS_ICT_CATEGORIES = {"ict_saas", "ict_hardware"}

# DCS Professional Services categories
DCS_PS_CATEGORIES = {"professional_services", "consulting"}


def _get_dcs_approval_chain(profile: ProcurementProfile) -> str | None:
    """
    Return the DCS-specific approval chain string for the given profile.
    Source: DCS Procurement Manual §10.1 Briefing Note Approvals table (December 2025, v11.82).
    Returns None if the profile is not a DCS agency.
    """
    if profile.agency_id not in DCS_AGENCY_IDS:
        return None

    category = profile.category or ""
    value = profile.value or "unknown"

    if category in DCS_PS_CATEGORIES:
        # Professional Services approval chain
        if value in ("micro", "low"):
            # Up to ~$50k
            return (
                "Director/Manager → Finance Director → Executive Director (optional) → "
                "Procurement Business Partner (BN endorsement) → "
                "Deputy Secretary, SEB3, or Chief People Officer (final approver per DCS Delegations Manual)"
            )
        elif value == "medium":
            # $50k–$250k
            return (
                "Director → Finance Director → Executive Director (optional) → "
                "Chief Procurement Officer (BN endorsement) → "
                "Chief Financial Officer (final approver)"
            )
        elif value == "high":
            # $250k–$1M
            return (
                "Director → Finance Director → Executive Director → "
                "Chief Procurement Officer (BN endorsement) → "
                "Chief Financial Officer (final approver)"
            )
        else:
            # Major (>$1M) — CFO up to $5M, Minister above $5M
            return (
                "Director → Finance Director → Executive Director → "
                "Chief Procurement Officer → Deputy Secretary → "
                "Chief Financial Officer or Minister (final approver — see DCS Delegations Manual)"
            )

    elif category in DCS_ICT_CATEGORIES:
        # ICT approval chain
        cyber_note = (
            "Note: Cyber security / Category K procurements require "
            "Chief Information Security Officer (CISO) as mandatory final approver at any value."
        )
        if value in ("micro", "low", "medium"):
            # Up to ~$250k
            return (
                f"Director/Manager → Finance Director → Executive Director (optional) → "
                f"Procurement Business Partner (BN endorsement) → "
                f"Final approver per DCS Delegations Manual. {cyber_note}"
            )
        elif value == "high":
            # $250k–$1M
            return (
                f"Director/Manager → Finance Director → Executive Director (optional) → "
                f"Procurement Business Partner (BN endorsement) → "
                f"Final approver per DCS Delegations Manual. {cyber_note}"
            )
        else:
            # Major (>$1M)
            return (
                f"Director/Manager → Finance Director → Executive Director → "
                f"Chief Procurement Officer → Final approver per DCS Delegations Manual. {cyber_note}"
            )

    else:
        # General goods, services, construction, labour hire
        if value == "micro":
            return (
                "Business sponsor → Finance Director → Director → "
                "Procurement Business Partner (BN endorsement) → "
                "Final approver per DCS Delegations Manual"
            )
        elif value == "low":
            return (
                "Business sponsor → Finance Director → Director → "
                "Procurement Business Partner (BN endorsement) → "
                "Final approver per DCS Delegations Manual"
            )
        elif value == "medium":
            return (
                "Business sponsor → Finance Director → Director → "
                "Procurement Business Partner (BN endorsement) → "
                "Final approver per DCS Delegations Manual"
            )
        elif value == "high":
            return (
                "Business sponsor → Finance Director → Executive Director → "
                "Procurement Business Partner (BN endorsement) → "
                "Final approver per DCS Delegations Manual"
            )
        else:
            # Major (>$1M)
            return (
                "Director → Finance Director → Executive Director → "
                "Chief Procurement Officer (BN endorsement) → "
                "Final approver per DCS Delegations Manual "
                "(Secretary for >$5M via: Director → Finance Director → CFO → CPO → Deputy Secretary → Secretary)"
            )


def _get_dcs_briefing_endorsement(profile: ProcurementProfile) -> str | None:
    """
    Return the required BN endorsement role for a DCS procurement.
    Source: DCS Procurement Manual §10.1.
    """
    if profile.agency_id not in DCS_AGENCY_IDS:
        return None

    category = profile.category or ""
    value = profile.value or "unknown"

    if category in DCS_PS_CATEGORIES:
        if value in ("micro", "low"):
            return "DCS Procurement Business Partner, Senior Sourcing Manager, or Associate Director must endorse the briefing note."
        else:
            return "Chief Procurement Officer (CPO) must endorse the briefing note before it goes to the approval delegate."
    else:
        if value in ("micro", "low", "medium", "high"):
            return "DCS Procurement Business Partner, Senior Sourcing Manager, or Associate Director must endorse the briefing note."
        else:
            return "Chief Procurement Officer (CPO) must endorse the briefing note before it goes to the approval delegate."


def _load_matrix() -> dict:
    with open(DATA_DIR / "approval_matrix.json", encoding="utf-8") as f:
        return json.load(f)


def _value_index(v: str) -> int:
    return VALUE_ORDER.index(v) if v in VALUE_ORDER else -1


def _impact_index(i: str) -> int:
    return IMPACT_ORDER.index(i) if i in IMPACT_ORDER else -1


def _find_base_tier(value: str, impact: str, tiers: list[dict]) -> dict:
    """Find the appropriate base approval tier for a given value and impact."""
    vi = _value_index(value or "unknown")
    ii = _impact_index(impact or "low")

    best = None
    for tier in tiers:
        tier_vi = max(_value_index(v) for v in tier["value_tiers"])
        tier_ii = _impact_index(tier["impact_max"])
        if vi <= tier_vi and ii <= tier_ii:
            if best is None or tier["delegate_level"] < best["delegate_level"]:
                best = tier

    # If no exact match (e.g. unknown value), use highest tier
    if best is None:
        best = max(tiers, key=lambda t: t["delegate_level"])

    return best


def _is_required_review(review: str) -> bool:
    text = (review or "").strip().lower()
    if not text:
        return False
    if "recommended" in text or "may apply" in text or "optional" in text:
        return False
    return any(token in text for token in ["required", "must", "mandatory"])


def _split_required_approver_steps(chain: str) -> list[tuple[str, str | None]]:
    steps = []

    for raw_step in (chain or "").split("→"):
        step = raw_step.strip()
        if not step:
            continue

        note = None
        if ". Note:" in step:
            step = step.split(". Note:", 1)[0].strip()

        paren_match = re.search(r"\(([^()]*)\)\s*$", step)
        if paren_match:
            paren_text = paren_match.group(1).strip()
            if "optional" in paren_text.lower():
                continue
            note = paren_text
            step = re.sub(r"\s*\([^()]*\)\s*$", "", step).strip()

        substeps = [part.strip() for part in step.split("+") if part.strip()]
        for substep in substeps:
            steps.append((substep, note))

    return steps


def _build_approval_steps(
    approver_role: str,
    reviews_required: list[str],
    additions: list[ApprovalAddition],
    delegate_level: int,
) -> list[ApprovalStep]:
    steps: list[ApprovalStep] = []

    required_reviews = [review for review in reviews_required if _is_required_review(review)]
    for index, review in enumerate(required_reviews, start=1):
        steps.append(ApprovalStep(
            id=f"review_{index}",
            kind="review",
            title=review,
            note="Must be completed before delegate approval.",
        ))

    parsed_approvers = _split_required_approver_steps(approver_role)
    if parsed_approvers:
        for index, (title, parsed_note) in enumerate(parsed_approvers, start=1):
            is_final = index == len(parsed_approvers)
            note = parsed_note or (
                f"Delegate level {delegate_level} approval point."
                if is_final else
                "Required approval step in the escalation chain."
            )
            steps.append(ApprovalStep(
                id=f"approver_{index}",
                kind="final_approval" if is_final else "approval",
                title=title,
                note=note,
                is_final=is_final,
            ))

    for index, addition in enumerate([a for a in additions if a.role], start=1):
        insert_at = len(steps)
        final_step_index = next((i for i, step in enumerate(steps) if step.is_final), None)
        if final_step_index is not None:
            insert_at = final_step_index

        steps.insert(insert_at, ApprovalStep(
            id=f"addition_{index}",
            kind="sign_off",
            title=addition.role,
            note=addition.note or "Mandatory additional sign-off.",
            source=addition.source,
            source_name=addition.source_name,
        ))

    return steps


def derive_approvals(profile: ProcurementProfile, pathway: PathwayResult) -> ApprovalResult:
    """
    Derive the required approval pathway from profile tags and pathway selection.
    """
    matrix = _load_matrix()
    tiers = matrix["tiers"]
    pathway_escalations = matrix.get("pathway_escalations", {})
    overlay_additions = matrix.get("overlay_additions", {})

    base_tier = _find_base_tier(profile.value, profile.impact, tiers)

    # Apply impact escalation for critical
    tier = base_tier
    if profile.impact == "critical":
        # Escalate one level
        current_level = tier["delegate_level"]
        higher = [t for t in tiers if t["delegate_level"] > current_level]
        if higher:
            tier = min(higher, key=lambda t: t["delegate_level"])

    # Pathway-specific escalation
    pathway_note = None
    requires_justification = False
    escalation = pathway_escalations.get(pathway.pathway_id)
    if escalation:
        pathway_note = escalation.get("note")
        requires_justification = escalation.get("add_justification", False)
        if escalation.get("add_justification") and tier["delegate_level"] < len(tiers):
            # Escalate one more level for exception pathways
            current_level = tier["delegate_level"]
            higher = [t for t in tiers if t["delegate_level"] > current_level]
            if higher:
                tier = min(higher, key=lambda t: t["delegate_level"])

    # Build additions from overlays
    additions = []
    for overlay in profile.overlays:
        oa = overlay_additions.get(overlay)
        if oa:
            role = oa.get("review", "")
            note = oa.get("approver_note", "")
            additions.append(ApprovalAddition(role=role, note=note))

    # Add scheme-specific approval additions
    from scheme_loader import load_schemes, match_schemes
    all_schemes = load_schemes()
    matched = match_schemes(profile, all_schemes)
    for scheme in matched:
        for aa in scheme.get("approval_additions", []):
            additions.append(ApprovalAddition(
                role=aa["role"],
                note=aa.get("note", ""),
                source=scheme["scheme_id"],
                source_name=scheme["name"],
            ))

    reviews = list(tier.get("reviews_required", []))

    # Override approver_role with DCS-specific chain when applicable
    dcs_chain = _get_dcs_approval_chain(profile)
    dcs_endorsement = _get_dcs_briefing_endorsement(profile)
    if dcs_chain:
        approver_role = dcs_chain
        if dcs_endorsement:
            reviews = [dcs_endorsement] + reviews
    else:
        approver_role = tier["approver_role"]

    return ApprovalResult(
        base_tier=tier["label"],
        approver_role=approver_role,
        delegate_level=tier["delegate_level"],
        reviews_required=reviews,
        pathway_note=pathway_note,
        requires_justification=requires_justification,
        additions=additions,
        approval_steps=_build_approval_steps(
            approver_role=approver_role,
            reviews_required=reviews,
            additions=additions,
            delegate_level=tier["delegate_level"],
        ),
    )
