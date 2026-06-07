"""
Procurement Strategy Agent (architecture §4.3).
Generates sourcing strategy options with trade-offs.
"""

import os
import json
import uuid
from datetime import datetime, timezone
import anthropic
import audit_logger

SYSTEM_PROMPT = """You are the NSW Government Procurement Strategy Agent.

Your role: generate a structured set of sourcing strategy options for a procurement, with clear trade-offs, so the procurement officer can make an informed decision.

You understand NSW procurement pathways:
- Panel calldown: fastest, lowest risk, but limited to panel suppliers and may not maximise competition
- Open tender (1-stage): maximum competition, highest cost/time, best for complex/high-value
- Open tender (2-stage EOI + RFT): good for complex requirements needing shortlisting, adds 4-8 weeks
- Restricted tender (pre-qualified): balance of competition and efficiency, requires justification
- Direct negotiation: fastest, highest risk, exception only — sole source or emergency

Always produce 2-3 realistic options. Mark one as recommended.
Return JSON only. No markdown fences."""


_strategy_store: dict[str, dict] = {}


def generate_strategy(procurement_id: str, profile, pathway, market_assessment=None, details=None) -> dict:
    """
    Generate a SourcingStrategy for the given profile + pathway.
    Returns a dict matching SourcingStrategy model.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile
    pathway_dict = pathway.model_dump() if hasattr(pathway, "model_dump") else pathway
    market_dict = market_assessment.model_dump() if (market_assessment and hasattr(market_assessment, "model_dump")) else market_assessment
    details_dict = (details.model_dump() if hasattr(details, "model_dump") else details) or {}

    details_block = ""
    if details_dict:
        details_block = f"""
PROCUREMENT DETAILS:
{json.dumps(details_dict, indent=2)}
"""

    prompt = f"""Generate sourcing strategy options for this NSW Government procurement.

PROCUREMENT PROFILE:
{json.dumps(profile_dict, indent=2)}

SELECTED PATHWAY: {pathway_dict.get('name', pathway_dict.get('pathway_id', 'Unknown'))}
PATHWAY RATIONALE: {pathway_dict.get('rationale', [])}

MARKET CONTEXT:
{json.dumps(market_dict, indent=2) if market_dict else 'No market assessment provided — estimate from profile.'}
{details_block}
Generate 2-3 sourcing strategy options appropriate to this procurement. Return JSON:
{{
  "options": [
    {{
      "label": "Short descriptive name (e.g. 'Panel calldown — DIGITAL_SERVICES_PANEL')",
      "pathway": "pathway_id this aligns to (e.g. 'open_market', 'limited_direct', 'quote_based')",
      "pros": ["Benefit 1", "Benefit 2"],
      "cons": ["Risk or drawback 1", "Risk or drawback 2"],
      "timeline_estimate": "e.g. '6-8 weeks'",
      "risk_level": "low|medium|high"
    }}
  ],
  "recommended_option": "Label of the recommended option (exactly matching one of the labels above)",
  "rationale": "1-2 sentences explaining why this option is recommended for this specific procurement."
}}

Make options specific to the procurement context. Where PROCUREMENT DETAILS are provided, reference the title, budget, timeline, and key requirements in the option descriptions and rationale."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    parsed = json.loads(raw)

    strategy_id = str(uuid.uuid4())
    result = {
        "strategy_id": strategy_id,
        "procurement_id": procurement_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "options": parsed["options"],
        "recommended_option": parsed["recommended_option"],
        "rationale": parsed["rationale"],
        "human_selected_option": None,
        "human_selection_timestamp": None,
    }
    _strategy_store[strategy_id] = result

    audit_logger.write_agent_action({
        "agent_action_id": str(uuid.uuid4()),
        "agent": "strategy_agent",
        "input_reference": procurement_id,
        "output_type": "sourcing_strategy",
        "confidence": 0.80,
        "review_required": True,
        "timestamp": result["timestamp"],
    })
    audit_logger.write_sourcing_artifact(procurement_id, "strategy", result)
    return result


def record_strategy_selection(strategy_id: str, selected_option: str) -> dict:
    """Record the human's strategy selection. Falls back to SQLite if not in memory."""
    strategy = _strategy_store.get(strategy_id)
    if strategy is None:
        # Look up from persisted artifacts by scanning for this strategy_id
        import sqlite3
        from pathlib import Path
        db_path = str((Path(__file__).resolve().parent / "procurement.db").resolve())
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT artifact_json FROM sourcing_artifacts WHERE artifact_type = 'strategy' AND json_extract(artifact_json, '$.strategy_id') = ?",
            (strategy_id,),
        ).fetchone()
        conn.close()
        if row is None:
            raise ValueError(f"Strategy {strategy_id} not found")
        import json as _json
        strategy = _json.loads(row["artifact_json"])
        _strategy_store[strategy_id] = strategy

    strategy["human_selected_option"] = selected_option
    strategy["human_selection_timestamp"] = datetime.now(timezone.utc).isoformat()
    # Persist updated selection
    audit_logger.write_sourcing_artifact(strategy["procurement_id"], "strategy", strategy)
    return strategy
