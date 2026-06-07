"""
Builds the structured briefing note skeleton from deterministic outputs.
The LLM fills prose from this structure — structure itself is always deterministic.
"""

from models import (
    ProcurementProfile, PathwayResult, ObligationResult,
    ApprovalResult, BriefingStructure, BriefingSection
)
from approval_engine import (
    DCS_AGENCY_IDS, DCS_ICT_CATEGORIES, DCS_PS_CATEGORIES,
    _get_dcs_approval_chain, _get_dcs_briefing_endorsement,
)

VALUE_LABELS = {
    "micro": "under $10,000",
    "low": "$10,000 – $50,000",
    "medium": "$50,000 – $250,000",
    "high": "$250,000 – $1,000,000",
    "major": "over $1,000,000",
    "unknown": "to be confirmed",
}

CATEGORY_LABELS = {
    "ict_saas": "ICT Software / SaaS",
    "ict_hardware": "ICT Hardware",
    "professional_services": "Professional Services",
    "consulting": "Consulting / Advisory",
    "goods": "Goods and Supplies",
    "construction": "Construction / Built Environment",
    "labour_hire": "Labour / Contingent Workforce",
    "other": "Other",
}

MARKET_LABELS = {
    "sole": "sole supplier — no meaningful competition available",
    "limited": "limited market (2–3 specialist providers)",
    "some": "moderate market (4–10 suppliers)",
    "broad": "competitive market (many suppliers)",
    "unknown": "market not yet assessed",
}

IMPACT_LABELS = {
    "low": "Low — minor inconvenience, easily managed",
    "medium": "Medium — operational disruption, recoverable",
    "high": "High — significant service impact affecting many stakeholders",
    "critical": "Critical — safety risk, major legal exposure, or catastrophic disruption",
}

DEFINITION_LABELS = {
    "clear": "clearly defined with detailed specification ready",
    "mostly_clear": "mostly defined with minor gaps to resolve",
    "partial": "partially defined — market input required to refine",
    "exploratory": "early stage — solution not yet defined",
}

OVERLAY_LABELS = {
    "ai": "AI or automated decision-making",
    "privacy": "personal or health information",
    "critical_ict": "critical ICT infrastructure",
    "construction": "construction or built environment work",
    "overseas": "overseas supply chains",
}


def build_briefing_structure(
    profile: ProcurementProfile,
    pathway: PathwayResult,
    obligations: ObligationResult,
    approvals: ApprovalResult,
) -> BriefingStructure:
    """Build a structured dict that the LLM will convert to prose."""

    category_label = CATEGORY_LABELS.get(profile.category, profile.category or "Not specified")
    value_label = VALUE_LABELS.get(profile.value, "unknown value")
    market_label = MARKET_LABELS.get(profile.market, "unknown market")
    impact_label = IMPACT_LABELS.get(profile.impact, "not assessed")
    definition_label = DEFINITION_LABELS.get(profile.definition, "not specified")
    overlay_labels = [OVERLAY_LABELS[o] for o in profile.overlays if o in OVERLAY_LABELS]

    sections = [
        BriefingSection(
            id="purpose",
            heading="Purpose",
            data={
                "category": category_label,
                "purpose": profile.purpose,
                "value": value_label,
                "recommended_pathway": pathway.label,
            }
        ),
        BriefingSection(
            id="background",
            heading="Background",
            data={
                "purpose_context": profile.purpose,
                "org_context": profile.org,
                "definition_level": definition_label,
                "timing": profile.timing,
            }
        ),
        BriefingSection(
            id="what_is_being_procured",
            heading="What is Being Procured",
            data={
                "category": category_label,
                "estimated_value": value_label,
                "definition_level": definition_label,
                "interaction_required": profile.interaction,
                "overlays": overlay_labels if overlay_labels else ["None identified"],
            }
        ),
        BriefingSection(
            id="recommended_pathway",
            heading="Recommended Procurement Pathway",
            data={
                "pathway": pathway.label,
                "description": pathway.description,
                "rationale": pathway.rationale,
                "is_exception": pathway.exception,
                "requires_justification": pathway.requires_justification,
            }
        ),
        BriefingSection(
            id="value_for_money",
            heading="Value for Money Approach",
            data={
                "market_shape": market_label,
                "competition_approach": _vfm_approach(profile, pathway),
                "pathway": pathway.pathway_id,
            }
        ),
        BriefingSection(
            id="market_context",
            heading="Market Context",
            data={
                "market": market_label,
                "category": category_label,
                "matched_schemes": [s.name for s in obligations.matched_schemes],
                "pre_checks": [pc.title for pc in obligations.pre_checks + pathway.pre_checks],
            }
        ),
        BriefingSection(
            id="risk_and_impact",
            heading="Risk and Impact Assessment",
            data={
                "impact_level": impact_label,
                "overlays": overlay_labels if overlay_labels else ["None"],
                "low_confidence": pathway.low_confidence,
                "timing_risk": profile.timing in ("urgent", "compressed"),
            }
        ),
        BriefingSection(
            id="obligations",
            heading="Triggered Policy Obligations",
            data={
                "obligations": [
                    {"title": o.title, "policy": o.policy, "source": o.source}
                    for o in obligations.obligations
                ],
            }
        ),
        BriefingSection(
            id="approvals",
            heading="Approvals Required",
            data={
                "approver_role": approvals.approver_role,
                "delegate_level": approvals.delegate_level,
                "reviews_required": approvals.reviews_required,
                "pathway_note": approvals.pathway_note,
                "requires_justification": approvals.requires_justification,
                "additions": [
                    {"role": a.role, "note": a.note}
                    for a in approvals.additions
                ],
            }
        ),
        BriefingSection(
            id="recommendation",
            heading="Recommendation",
            data={
                "pathway": pathway.label,
                "steps_summary": [step.text for step in pathway.steps[:3]],
                "next_action": pathway.steps[0].text if pathway.steps else "Proceed with procurement planning",
            }
        ),
    ]

    # Add DCS-specific compliance section when agency is DCS
    if profile.agency_id in DCS_AGENCY_IDS:
        category = profile.category or ""
        value = profile.value or "unknown"
        is_ict = category in DCS_ICT_CATEGORIES
        is_ps = category in DCS_PS_CATEGORIES

        dcs_requirements = []

        # PRN requirement
        if is_ict or is_ps:
            dcs_requirements.append("PRN required at any value — obtain from DCS Procurement before any market activity")
        elif value in ("low", "medium", "high", "major"):
            dcs_requirements.append("PRN required for procurements ≥$30k incl. GST — obtain from DCS Procurement")

        # PSM Pro
        if is_ps:
            dcs_requirements.append("PSM Pro (SAP Fieldglass via KellyOCG) mandatory for all new consultancy engagements from 30 Sep 2024 — KellyOCG will obtain the PRN on your behalf")

        # Risk Assessment
        if is_ict and value in ("low", "medium", "high", "major"):
            dcs_requirements.append("DCS Combined Risk Assessment — Business Risk tab required for ICT ≥$10k; ICT Risk tab also required for ICT >$250k")
        elif not is_ict and value in ("low", "medium", "high", "major"):
            dcs_requirements.append("DCS Combined Risk Assessment — Business Risk tab required for G&S ≥$30k")

        # buy.NSW
        if value in ("medium", "high", "major"):
            dcs_requirements.append("Mandatory buy.NSW publication before market approach for procurements ≥$150k incl. GST (PBD-2024-01, effective 31 Dec 2024)")

        # GIPA / Contract Register
        if value in ("medium", "high", "major"):
            dcs_requirements.append("GIPA disclosure on Tenders NSW + DCS Central Contracts Register upload within 21 days of execution (threshold: ≥$150k incl. GST)")
        elif value in ("low",):
            dcs_requirements.append("DCS Central Contracts Register upload within 21 days of execution (≥$30k incl. GST)")

        # ELT endorsement for PS
        if is_ps and value in ("medium", "high", "major"):
            dcs_requirements.append("ELT endorsement required before approaching market (all consultancy ≥$50k ex. GST)")

        # Eval Committee
        if value in ("high", "major"):
            dcs_requirements.append(
                "Evaluation Committee Chair: Grade 9/10 minimum ($250k–$1M) or SEB1+/DCS Procurement (above $1M)"
            )

        # Briefing note endorsement
        dcs_endorsement = _get_dcs_briefing_endorsement(profile)
        if dcs_endorsement:
            dcs_requirements.append(f"Briefing note endorsement: {dcs_endorsement}")

        sections.append(BriefingSection(
            id="dcs_compliance",
            heading="DCS-Specific Compliance Requirements",
            data={
                "agency": profile.agency_name or "Department of Customer Service",
                "policy_source": "DCS Procurement Manual (December 2025, v11.82)",
                "approval_chain": _get_dcs_approval_chain(profile),
                "requirements": dcs_requirements,
                "note": (
                    "These requirements are in addition to NSW Procurement Policy Framework obligations. "
                    "Contact your DCS Procurement Business Partner if any requirement is unclear."
                ),
            }
        ))

    # Add justification section only if exception pathway
    if pathway.exception:
        sections.append(BriefingSection(
            id="justification",
            heading="Justification for Exception Pathway",
            data={
                "pathway": pathway.label,
                "pathway_id": pathway.pathway_id,
                "reason": pathway.rationale,
                "market": market_label,
                "instructions": "This section must document the specific reasons why the standard competitive process cannot be followed.",
            }
        ))

    return BriefingStructure(sections=sections)


def _vfm_approach(profile: ProcurementProfile, pathway: PathwayResult) -> str:
    if pathway.pathway_id == "emergency_procurement":
        return "Direct negotiation — value for money achieved through documented justification and negotiation with the best available supplier"
    elif pathway.pathway_id == "simple_purchase":
        return "Value for money through use of government arrangements where available, or direct comparison for low-value purchases"
    elif pathway.pathway_id in ("quote_based",):
        return "Competitive quotes from at least 3 suppliers — value for money demonstrated through price comparison and documented evaluation"
    elif pathway.pathway_id == "limited_direct":
        return "Value for money through direct negotiation — limited competition requires documented justification and transparent price benchmarking"
    elif pathway.pathway_id in ("open_market", "major_strategic"):
        return "Value for money through open competition — all capable suppliers have equal opportunity to compete on price and capability"
    elif pathway.pathway_id == "structured_market":
        return "Value for money through structured market engagement — competitive process adapted to solution development requirements"
    return "Value for money to be determined through the recommended procurement process"
