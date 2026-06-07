"""
Decision Engine — orchestrates the deterministic engines and persists a DecisionRecord.
Returns (EvaluateResponse, decision_id).
"""

import uuid
from datetime import datetime, timezone

import audit_logger
from models import ProcurementProfile, AgencyContext, EvaluateResponse
from pathway_engine import select_pathway
from rules_engine import evaluate_obligations
from approval_engine import derive_approvals
from briefing_generator import build_briefing_structure


def evaluate_and_record(
    profile: ProcurementProfile,
    agency: AgencyContext | None = None,
) -> tuple[EvaluateResponse, str]:
    """Run all deterministic engines, persist a DecisionRecord, return (response, decision_id)."""
    pathway = select_pathway(profile)
    obligations = evaluate_obligations(profile)
    approvals = derive_approvals(profile, pathway)
    briefing = build_briefing_structure(profile, pathway, obligations, approvals)

    decision_id = str(uuid.uuid4())
    record = {
        "decision_id": decision_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "profile": profile.model_dump(),
        "pathway_id": pathway.pathway_id,
        "pathway_label": pathway.label,
        "basis": [t.model_dump() for t in pathway.rule_trace],
        "obligation_ids": [o.id for o in obligations.obligations],
        "scheme_ids": [s.scheme_id for s in obligations.matched_schemes],
        "human_override": False,
        "override_decision_id": None,
    }
    audit_logger.write_decision(record)

    response = EvaluateResponse(
        decision_id=decision_id,
        profile=profile,
        pathway=pathway,
        obligations=obligations,
        approvals=approvals,
        briefing_structure=briefing,
    )
    return response, decision_id
