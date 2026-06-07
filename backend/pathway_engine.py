"""
Deterministic pathway selection engine.
Same inputs always produce the same output. No LLM involvement.
"""

import json
from pathlib import Path
from models import ProcurementProfile, PathwayResult, PreCheck, ProcessStep, RuleTrace

DATA_DIR = Path(__file__).parent / "data"
VALUE_ORDER = ["micro", "low", "medium", "high", "major", "unknown"]
IMPACT_ORDER = ["low", "medium", "high", "critical"]
DEFINITION_ORDER = ["exploratory", "partial", "mostly_clear", "clear"]

PATHWAY_STEP_CITATIONS = {
    "emergency_procurement": [
        ["NSW Procurement Policy Framework — Emergency Procurement"],
        ["NSW Procurement Policy Framework — Emergency Procurement"],
        ["NSW Procurement Policy Framework — Emergency Procurement"],
        ["NSW Procurement Policy Framework — Value for Money"],
        [],
        ["NSW Procurement Policy Framework — Emergency Procurement"],
        ["NSW Procurement Policy Framework — Emergency Procurement"],
    ],
    "major_strategic": [
        [],
        ["NSW Government Gateway Review Policy"],
        ["NSW Procurement Policy Framework — Market Engagement"],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
        ["NSW Procurement Policy Framework — Probity"],
        ["NSW Procurement Policy Framework — Probity"],
        ["NSW Procurement Policy Framework — Probity"],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
    ],
    "limited_direct": [
        ["NSW Procurement Policy Framework — Limited Competition"],
        ["NSW Procurement Policy Framework — Limited Competition"],
        ["NSW Procurement Policy Framework — Limited Competition"],
        ["NSW Procurement Policy Framework — Limited Competition"],
        ["NSW Procurement Policy Framework — Value for Money"],
        [],
        ["NSW Procurement Policy Framework — Limited Competition"],
    ],
    "simple_purchase": [
        [],
        [],
        [],
        [],
        [],
        [],
        ["NSW Procurement Policy Framework — Contract Management"],
    ],
    "quote_based": [
        [],
        [],
        [],
        [],
        ["NSW Procurement Policy Framework — Value for Money"],
        ["NSW Procurement Policy Framework — Value for Money"],
        [],
        [],
        ["NSW Procurement Policy Framework — Contract Management"],
    ],
    "structured_market": [
        ["NSW Procurement Policy Framework — Market Engagement"],
        ["NSW Procurement Policy Framework — Market Engagement"],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
        ["NSW Procurement Policy Framework — Value for Money"],
        ["NSW Procurement Policy Framework — Value for Money"],
        ["NSW Procurement Policy Framework — Probity"],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
    ],
    "open_market": [
        [],
        [],
        [],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
        [],
        ["NSW Procurement Policy Framework — Probity"],
        ["NSW Procurement Policy Framework — Probity"],
        [],
        [],
        [],
        ["NSW Procurement Policy Framework — Open Advertising"],
    ],
}


def _load_pathways() -> dict:
    with open(DATA_DIR / "pathways.json", encoding="utf-8") as f:
        return json.load(f)["pathways"]


def _value_gte(v: str, threshold: str) -> bool:
    if not v or v == "unknown":
        return False
    vi = VALUE_ORDER.index(v) if v in VALUE_ORDER else -1
    ti = VALUE_ORDER.index(threshold) if threshold in VALUE_ORDER else -1
    return vi >= ti


def _impact_gte(i: str, threshold: str) -> bool:
    if not i:
        return False
    ii = IMPACT_ORDER.index(i) if i in IMPACT_ORDER else -1
    ti = IMPACT_ORDER.index(threshold) if threshold in IMPACT_ORDER else -1
    return ii >= ti


def _definition_gte(d: str, threshold: str) -> bool:
    if not d:
        return False
    di = DEFINITION_ORDER.index(d) if d in DEFINITION_ORDER else -1
    ti = DEFINITION_ORDER.index(threshold) if threshold in DEFINITION_ORDER else -1
    return di >= ti


def _build_pre_checks(profile: ProcurementProfile) -> list[PreCheck]:
    """Core pre-checks based on category and purpose (before scheme layer)."""
    checks = []
    if profile.purpose == "renewal":
        checks.append(PreCheck(
            id="CORE-PC-001",
            title="Check existing contract extension terms",
            body="Before starting a new procurement, confirm whether the existing contract allows for extension and whether re-tendering is required. Document the basis for renewal vs new procurement.",
            source="core"
        ))
    return checks


def _build_rationale(profile: ProcurementProfile, pathway_id: str) -> list[str]:
    """Build plain-language rationale explaining why this pathway was selected."""
    rationale = []

    if pathway_id == "emergency_procurement":
        if profile.purpose == "emergency":
            rationale.append("Your requirement is an emergency or urgent operational need.")
        if profile.timing == "urgent":
            rationale.append("Your timeframe of under 2 weeks does not allow for a standard competitive process.")
        rationale.append("Emergency procurement allows for direct engagement with a supplier, but requires written justification and appropriate approvals.")

    elif pathway_id == "major_strategic":
        rationale.append(f"The estimated value (over $1 million) triggers major procurement requirements.")
        rationale.append("Major procurements require formal strategy approval, rigorous evaluation, and executive-level sign-off.")

    elif pathway_id == "limited_direct":
        if profile.market == "sole":
            rationale.append("You have identified only one supplier who can provide this — a sole source situation.")
        elif profile.market == "limited" and _impact_gte(profile.impact, "high"):
            rationale.append(f"Market is very limited (2–3 suppliers) and the impact of failure is {profile.impact}.")
        rationale.append("Limited market procurement is an exception state and requires documented justification — including evidence of why the market is limited and how value for money is being achieved.")

    elif pathway_id == "simple_purchase":
        rationale.append("Your requirement is low value and clearly defined.")
        rationale.append("A simple purchase process is proportionate — minimal administration, with appropriate approval and records.")

    elif pathway_id == "quote_based":
        rationale.append(f"Your requirement is {'low' if profile.value == 'low' else 'medium'}-value, clearly defined, and the market has sufficient suppliers to generate competition.")
        rationale.append("A competitive quote process provides value for money with proportionate effort.")

    elif pathway_id == "structured_market":
        if profile.definition in ("exploratory", "partial"):
            rationale.append("Your requirement is not yet fully defined — market engagement will help shape the approach.")
        if profile.interaction == "collaborative":
            rationale.append("The solution needs to be co-designed or refined through supplier engagement.")
        rationale.append("A structured market approach allows flexibility in how the requirement is defined while maintaining competitive discipline.")

    elif pathway_id == "open_market":
        rationale.append("This is a medium-to-high value procurement with a broad enough market for open competition.")
        rationale.append("Open market procurement ensures fair access for all suppliers and maximises competitive tension.")

    return rationale


def _build_steps(pathway_id: str, step_texts: list[str]) -> list[ProcessStep]:
    citations_by_step = PATHWAY_STEP_CITATIONS.get(pathway_id, [])
    steps = []
    for idx, text in enumerate(step_texts):
        citations = citations_by_step[idx] if idx < len(citations_by_step) else []
        steps.append(ProcessStep(text=text, citations=citations))
    return steps


def select_pathway(profile: ProcurementProfile) -> PathwayResult:
    """
    Deterministically select a procurement pathway from the profile tags.
    Priority-ordered — first matching rule wins. Builds rule_trace for explainability.
    """
    pathways = _load_pathways()
    pre_checks = _build_pre_checks(profile)
    trace: list[RuleTrace] = []

    unknown_fields = sum([
        profile.value == "unknown",
        profile.market == "unknown",
        profile.timing == "unknown",
        profile.definition is None,
        profile.impact is None,
    ])
    low_confidence = unknown_fields >= 3

    fv = {
        "purpose": profile.purpose, "timing": profile.timing,
        "value": profile.value, "market": profile.market,
        "impact": profile.impact, "definition": profile.definition,
        "interaction": profile.interaction,
    }

    # --- Priority 1: Emergency ---
    r1_match = profile.purpose == "emergency" or profile.timing == "urgent"
    trace.append(RuleTrace(
        rule_id="R1", description="Emergency or urgent procurement",
        matched=r1_match,
        fields_checked=["purpose", "timing"],
        field_values={"purpose": profile.purpose, "timing": profile.timing},
        policy_citation="NSW Procurement Policy Framework — Emergency Procurement",
        stop_reason=None if r1_match else f"purpose={profile.purpose!r} (not 'emergency') and timing={profile.timing!r} (not 'urgent')",
    ))
    if r1_match:
        pathway_id = "emergency_procurement"
    else:

        # --- Priority 2: Major / Strategic ---
        r2_match = profile.value == "major"
        trace.append(RuleTrace(
            rule_id="R2", description="Major / strategic procurement (value = major)",
            matched=r2_match,
            fields_checked=["value"],
            field_values={"value": profile.value},
            policy_citation="NSW Procurement Policy Framework — Major Procurement",
            stop_reason=None if r2_match else f"value={profile.value!r} (not 'major')",
        ))
        if r2_match:
            pathway_id = "major_strategic"
        else:

            # --- Priority 3: Limited / Direct ---
            r3_match = profile.market == "sole" or (
                profile.market == "limited" and _impact_gte(profile.impact, "high")
            )
            trace.append(RuleTrace(
                rule_id="R3", description="Limited market or sole source",
                matched=r3_match,
                fields_checked=["market", "impact"],
                field_values={"market": profile.market, "impact": profile.impact},
                policy_citation="NSW Procurement Policy Framework — Limited Competition",
                stop_reason=None if r3_match else f"market={profile.market!r} (not 'sole') and not (market='limited' and impact >= 'high')",
            ))
            if r3_match:
                pathway_id = "limited_direct"
            else:

                # --- Priority 4: Simple Purchase ---
                r4_match = profile.value == "micro" and _definition_gte(profile.definition, "mostly_clear")
                trace.append(RuleTrace(
                    rule_id="R4", description="Simple purchase (micro value + clear definition)",
                    matched=r4_match,
                    fields_checked=["value", "definition"],
                    field_values={"value": profile.value, "definition": profile.definition},
                    policy_citation="NSW Procurement Policy Framework — Petty Cash / Simple Purchase",
                    stop_reason=None if r4_match else f"value={profile.value!r} (not 'micro') or definition below 'mostly_clear'",
                ))
                if r4_match:
                    pathway_id = "simple_purchase"
                else:

                    # --- Priority 5: Quote-based (low value) ---
                    r5_match = (
                        profile.value == "low"
                        and profile.market in ("some", "broad")
                        and _definition_gte(profile.definition, "mostly_clear")
                    )
                    trace.append(RuleTrace(
                        rule_id="R5", description="Quote-based (low value, competitive market)",
                        matched=r5_match,
                        fields_checked=["value", "market", "definition"],
                        field_values={"value": profile.value, "market": profile.market, "definition": profile.definition},
                        policy_citation="NSW Procurement Policy Framework — Competitive Quotes",
                        stop_reason=None if r5_match else f"value={profile.value!r} (not 'low'), or market not 'some'/'broad', or definition below 'mostly_clear'",
                    ))
                    if r5_match:
                        pathway_id = "quote_based"
                    else:

                        # --- Priority 6: Quote-based (medium, very clear + broad) ---
                        r6_match = (
                            profile.value == "medium"
                            and profile.market == "broad"
                            and _definition_gte(profile.definition, "clear")
                            and profile.impact in ("low", "medium")
                            and profile.timing not in ("urgent", "compressed")
                        )
                        trace.append(RuleTrace(
                            rule_id="R6", description="Quote-based (medium value, very clear + broad market)",
                            matched=r6_match,
                            fields_checked=["value", "market", "definition", "impact", "timing"],
                            field_values=fv,
                            policy_citation="NSW Procurement Policy Framework — Competitive Quotes",
                            stop_reason=None if r6_match else "value not 'medium', or market not 'broad', or definition below 'clear', or impact/timing prevents quote",
                        ))
                        if r6_match:
                            pathway_id = "quote_based"
                        else:

                            # --- Priority 7: Structured Market ---
                            r7_match = (
                                profile.definition in ("exploratory", "partial")
                                or profile.interaction == "collaborative"
                                or (_value_gte(profile.value, "medium") and profile.definition == "partial")
                            )
                            trace.append(RuleTrace(
                                rule_id="R7", description="Structured market engagement (exploratory need or collaborative interaction)",
                                matched=r7_match,
                                fields_checked=["definition", "interaction", "value"],
                                field_values={"definition": profile.definition, "interaction": profile.interaction, "value": profile.value},
                                policy_citation="NSW Procurement Policy Framework — Market Engagement",
                                stop_reason=None if r7_match else "definition not exploratory/partial, interaction not collaborative",
                            ))
                            if r7_match:
                                pathway_id = "structured_market"
                            else:

                                # --- Default: Open Market ---
                                trace.append(RuleTrace(
                                    rule_id="R8", description="Open market (default competitive tender)",
                                    matched=True,
                                    fields_checked=["value", "market"],
                                    field_values={"value": profile.value, "market": profile.market},
                                    policy_citation="NSW Procurement Policy Framework — Open Advertising",
                                    stop_reason=None,
                                ))
                                pathway_id = "open_market"

    pw = pathways[pathway_id]
    rationale = _build_rationale(profile, pathway_id)

    return PathwayResult(
        pathway_id=pathway_id,
        name=pw["name"],
        label=pw["label"],
        description=pw["description"],
        colour=pw["colour"],
        rationale=rationale,
        pre_checks=pre_checks,
        steps=_build_steps(pathway_id, pw["steps"]),
        exception=pw["exception"],
        requires_justification=pw["requires_justification"],
        low_confidence=low_confidence,
        rule_trace=trace,
    )
