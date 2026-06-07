"""
Negotiation Agent (architecture §4.7).
Prepares negotiation briefs after evaluation is complete and a preferred supplier is identified by the human.
"""

import os
import json
import uuid
from datetime import datetime, timezone
import anthropic
import audit_logger

try:
    from json_repair import loads as repair_json_loads
except Exception:  # pragma: no cover - optional dependency fallback
    repair_json_loads = None

SYSTEM_PROMPT = """You are the NSW Government Procurement Negotiation Support Agent.

Your role: prepare a negotiation brief for a NSW Government procurement officer who is about to negotiate with a preferred supplier.

You must:
1. Identify the agency's leverage points (what makes the supplier want this contract)
2. Identify the supplier's likely leverage points (what the agency depends on them for)
3. Recommend opening positions on key commercial terms
4. Identify a BATNA (best alternative to negotiated agreement)
5. Flag non-standard contract clauses or commercial risks to watch for
6. Note any NSW Government mandatory contract terms that cannot be varied

You are supporting human negotiators — not negotiating automatically. Be specific and actionable.
Use the prepare_negotiation_brief tool to return the structured brief."""


NEGOTIATION_BRIEF_TOOL = {
    "name": "prepare_negotiation_brief",
    "description": "Return a structured negotiation brief for the selected preferred supplier.",
    "input_schema": {
        "type": "object",
        "properties": {
            "executive_context": {"type": "string"},
            "agency_leverage": {"type": "array", "items": {"type": "string"}},
            "supplier_leverage": {"type": "array", "items": {"type": "string"}},
            "opening_positions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "term": {"type": "string"},
                        "agency_position": {"type": "string"},
                        "walk_away": {"type": "string"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["term", "agency_position", "walk_away", "rationale"],
                    "additionalProperties": False,
                },
            },
            "batna": {"type": "string"},
            "non_standard_risks": {"type": "array", "items": {"type": "string"}},
            "mandatory_nsw_terms": {"type": "array", "items": {"type": "string"}},
            "negotiation_strategy": {"type": "string"},
        },
        "required": [
            "executive_context",
            "agency_leverage",
            "supplier_leverage",
            "opening_positions",
            "batna",
            "non_standard_risks",
            "mandatory_nsw_terms",
            "negotiation_strategy",
        ],
        "additionalProperties": False,
    },
}

REQUIRED_BRIEF_KEYS = set(NEGOTIATION_BRIEF_TOOL["input_schema"]["required"])


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return text.strip()


def _parse_json_text(raw: str) -> dict:
    text = _strip_json_fence(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        if repair_json_loads is None:
            raise
        repaired = repair_json_loads(text)
        if not isinstance(repaired, dict):
            raise ValueError("Negotiation brief response was not a JSON object")
        return repaired


def _extract_structured_payload(response) -> dict:
    for block in response.content:
        block_type = getattr(block, "type", None)
        if block_type == "tool_use" and getattr(block, "name", None) == NEGOTIATION_BRIEF_TOOL["name"]:
            payload = getattr(block, "input", None)
            if isinstance(payload, dict):
                return payload
            raise ValueError("Negotiation brief tool payload was not an object")

    text = "".join(getattr(block, "text", "") for block in response.content).strip()
    if not text:
        raise ValueError("Negotiation brief response did not include structured content")
    return _parse_json_text(text)


def _validate_brief_payload(payload: dict) -> dict:
    missing = sorted(REQUIRED_BRIEF_KEYS - payload.keys())
    if missing:
        raise ValueError(f"Negotiation brief response missing required fields: {', '.join(missing)}")
    return payload


def prepare_negotiation_brief(
    procurement_id: str,
    profile,
    preferred_supplier_id: str,
    preferred_supplier_name: str,
    evaluation_results: list,
) -> dict:
    """
    Prepare a negotiation brief for the preferred supplier.
    Returns a structured negotiation brief dict.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile

    # Find preferred supplier's evaluation
    preferred_eval = next(
        (e.model_dump() if hasattr(e, "model_dump") else e
         for e in evaluation_results
         if (e.model_dump() if hasattr(e, "model_dump") else e).get("supplier_id") == preferred_supplier_id),
        {}
    )

    # Find runner-up (for BATNA leverage)
    all_evals = [e.model_dump() if hasattr(e, "model_dump") else e for e in evaluation_results]
    others = [e for e in all_evals if e.get("supplier_id") != preferred_supplier_id and e.get("mandatory_pass")]
    runner_up = others[0] if others else None

    prompt = f"""Prepare a negotiation brief for a NSW Government procurement with the preferred supplier.

PROCUREMENT PROFILE:
{json.dumps(profile_dict, indent=2)}

PREFERRED SUPPLIER: {preferred_supplier_name}
PREFERRED SUPPLIER EVALUATION SUMMARY: {preferred_eval.get('agent_summary', 'Not available')}
PREFERRED SUPPLIER SCORE: {preferred_eval.get('total_weighted_score', 'N/A')}

RUNNER-UP (BATNA): {runner_up['supplier_name'] if runner_up else 'None — sole responsive tenderer'}
RUNNER-UP SCORE: {runner_up.get('total_weighted_score', 'N/A') if runner_up else 'N/A'}

Populate the negotiation brief fields using this guidance:
{{
  "executive_context": "2-3 sentences: procurement context and why we are at negotiation stage.",
  "agency_leverage": [
    "Leverage point 1 (e.g. contract size, reference project opportunity, long-term relationship)",
    "Leverage point 2"
  ],
  "supplier_leverage": [
    "Supplier leverage point 1 (e.g. specialist capability, limited alternatives, incumbency advantage)",
    "Supplier leverage point 2"
  ],
  "opening_positions": [
    {{
      "term": "Commercial term (e.g. price, payment milestones, IP ownership)",
      "agency_position": "What we open with",
      "walk_away": "Our bottom line / walk-away point",
      "rationale": "Why this is important"
    }}
  ],
  "batna": "What we do if negotiation fails — next best option.",
  "non_standard_risks": [
    "Risk or non-standard clause to watch for in this supplier's contracts",
    "..."
  ],
  "mandatory_nsw_terms": [
    "NSW Government mandatory contract clause that cannot be waived",
    "..."
  ],
  "negotiation_strategy": "2-3 sentences: recommended overall negotiation approach."
}}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
        tools=[NEGOTIATION_BRIEF_TOOL],
        tool_choice={"type": "tool", "name": NEGOTIATION_BRIEF_TOOL["name"]},
    )
    result = _validate_brief_payload(_extract_structured_payload(response))

    brief = {
        "brief_id": str(uuid.uuid4()),
        "procurement_id": procurement_id,
        "preferred_supplier_id": preferred_supplier_id,
        "preferred_supplier_name": preferred_supplier_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **result,
    }

    audit_logger.write_agent_action({
        "agent_action_id": str(uuid.uuid4()),
        "agent": "negotiation_agent",
        "input_reference": procurement_id,
        "output_type": "negotiation_brief",
        "confidence": 0.72,
        "review_required": True,
        "timestamp": brief["timestamp"],
    })
    return brief
