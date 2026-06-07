"""
Market Intelligence Agent (architecture §4.4).
Scans the supplier store and produces a MarketAssessment.
"""

import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
import anthropic
import audit_logger

SUPPLIERS_PATH = Path(__file__).parent / "data" / "suppliers.json"

SYSTEM_PROMPT = """You are the NSW Government Market Intelligence Agent.

Your role: analyse a filtered list of suppliers and produce a market intelligence assessment for a NSW Government procurement.

You must:
1. Identify distinct supplier clusters (e.g. 'Tier 1 multinationals', 'NSW-based SMEs', 'AI specialists', 'Panel members')
2. Assess market depth (thin = <4 capable suppliers, moderate = 4-8, deep = 9+)
3. Assess competition risk (high = thin market or few competitors likely to respond; medium; low = deep market)
4. Flag SME opportunity (true if 3+ SME-classified suppliers are capable)
5. Flag Aboriginal business presence (true if any aboriginal-classified suppliers are capable)
6. Identify incumbent risk (if profile hints at renewal, flag likely incumbents)
7. Produce 2-4 narrative signal sentences (key observations about this market)

Return JSON only. No markdown fences."""


def _load_suppliers() -> list[dict]:
    with open(SUPPLIERS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _filter_suppliers(profile, suppliers: list[dict]) -> list[dict]:
    """Filter supplier list to those with relevant capabilities for the profile."""
    cap_map = {
        "ict_saas": ["ict_saas", "cloud", "ict_development"],
        "ict_hardware": ["ict_infrastructure", "managed_services"],
        "ict_development": ["ict_development", "digital_transformation", "agile_delivery"],
        "professional_services": ["professional_services", "consulting", "digital_transformation"],
        "consulting": ["consulting", "professional_services", "research"],
        "goods": ["goods"],
        "construction": ["construction"],
        "labour_hire": ["professional_services"],
        "other": [],
    }
    target_caps = cap_map.get(profile.category or "other", [])

    # Also include AI capability if ai_component is true
    if profile.ai_component or "ai" in (profile.overlays or []):
        target_caps.append("ai_ml")

    # Cybersecurity if critical_ict
    if "critical_ict" in (profile.overlays or []):
        target_caps.append("cybersecurity")

    if not target_caps:
        return suppliers[:15]  # Return first 15 if no filter

    return [
        s for s in suppliers
        if any(cap in s.get("capabilities", []) for cap in target_caps)
    ]


def assess_market(procurement_id: str, profile, agency=None, details=None) -> dict:
    """
    Assess the supplier market for a given profile.
    Returns a dict matching MarketAssessment model.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    all_suppliers = _load_suppliers()
    filtered = _filter_suppliers(profile, all_suppliers)

    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile
    details_dict = (details.model_dump() if hasattr(details, "model_dump") else details) or {}

    # Build focused context block from details most relevant to market analysis
    details_block = ""
    if details_dict:
        items = []
        if details_dict.get("title"):
            items.append(f"Procurement title: {details_dict['title']}")
        if details_dict.get("indicative_budget"):
            items.append(f"Indicative budget: {details_dict['indicative_budget']}")
        if details_dict.get("key_requirements"):
            items.append(f"Key requirements: {'; '.join(details_dict['key_requirements'])}")
        if details_dict.get("incumbent_supplier"):
            items.append(f"Known incumbent: {details_dict['incumbent_supplier']}")
        if details_dict.get("data_types"):
            items.append(f"Data types handled: {', '.join(details_dict['data_types'])}")
        if details_dict.get("hosting_requirements"):
            items.append(f"Hosting requirement: {details_dict['hosting_requirements']}")
        if details_dict.get("ai_use_case"):
            items.append(f"AI use case: {details_dict['ai_use_case']}")
        if items:
            details_block = "\nPROCUREMENT CONTEXT:\n" + "\n".join(items) + "\n"

    prompt = f"""Analyse the following supplier market for a NSW Government procurement.

PROCUREMENT PROFILE:
{json.dumps(profile_dict, indent=2)}
{details_block}
RELEVANT SUPPLIERS ({len(filtered)} found):
{json.dumps(filtered, indent=2)}

Produce a market intelligence assessment. Return JSON:
{{
  "supplier_count": {len(filtered)},
  "market_depth": "thin|moderate|deep",
  "competition_risk": "low|medium|high",
  "supplier_clusters": [
    {{
      "name": "Cluster name (e.g. 'Tier 1 multinationals')",
      "suppliers": ["Supplier Name 1", "Supplier Name 2"],
      "tags": ["tag1", "tag2"]
    }}
  ],
  "sme_opportunity": true_or_false,
  "aboriginal_business_present": true_or_false,
  "incumbent_identified": true_or_false,
  "incumbents": ["Supplier name if incumbent risk identified"],
  "signals": [
    "Signal 1: Key market observation in one sentence.",
    "Signal 2: ...",
    "Signal 3: ..."
  ]
}}

Base clusters on actual supplier classifications and capabilities. Make signals specific and actionable."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    parsed = json.loads(raw)

    assessment_id = str(uuid.uuid4())
    result = {
        "assessment_id": assessment_id,
        "procurement_id": procurement_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **parsed,
    }
    # Ensure supplier_count is accurate from the actual filter
    result["supplier_count"] = len(filtered)

    audit_logger.write_agent_action({
        "agent_action_id": str(uuid.uuid4()),
        "agent": "market_agent",
        "input_reference": procurement_id,
        "output_type": "market_assessment",
        "confidence": 0.75,
        "review_required": True,
        "timestamp": result["timestamp"],
    })
    audit_logger.write_sourcing_artifact(procurement_id, "market_assessment", result)
    return result
