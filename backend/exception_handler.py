import uuid
from datetime import datetime, timezone

import audit_logger
from models import ExceptionRecord


def submit_exception(decision_id: str, rationale: str, requested_pathway: str, submitted_by: str) -> dict:
    existing = audit_logger.read_decision(decision_id)
    if existing is None:
        raise ValueError(f"Decision {decision_id} not found")

    record = {
        "exception_id": str(uuid.uuid4()),
        "decision_id": decision_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "submitted_by": submitted_by,
        "rationale": rationale,
        "requested_pathway": requested_pathway,
        "status": "pending",
        "reviewed_by": None,
        "review_timestamp": None,
        "review_notes": None,
    }
    audit_logger.write_exception(record)
    return record


def get_exception(exception_id: str) -> dict | None:
    records = audit_logger.list_exceptions(limit=1000)
    for r in records:
        if r["exception_id"] == exception_id:
            return r
    return None


def list_exceptions(limit: int = 50) -> list[dict]:
    return audit_logger.list_exceptions(limit=limit)
