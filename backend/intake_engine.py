"""
Conversational intake engine.
Extracts a ProcurementProfile from a free-text description and returns only the
follow-up questions that are genuinely pathway-determinative.

The system prompt is grounded in the exact pathway selection rules from pathway_engine.py
so Claude knows precisely which uncertain fields change the outcome.
"""

import json
import os
import anthropic

# ---------------------------------------------------------------------------
# System prompt — embeds the real pathway rules so follow-up questions are
# grounded in what the rules engine will actually do with the answers.
# ---------------------------------------------------------------------------

INTAKE_SYSTEM_PROMPT = """You are an expert NSW Government procurement classifier embedded in the NSW Procurement Decision System.

Your job: extract a structured procurement profile from a free-text description, then identify the minimum set of follow-up questions needed to confidently determine the correct procurement pathway.

═══════════════════════════════════════════════════
PROFILE FIELDS — extract every field you can infer
═══════════════════════════════════════════════════
category            : ict_saas | ict_hardware | professional_services | consulting | goods | construction | labour_hire | other
purpose             : new | renewal | emergency | pilot | replacement
definition          : clear | mostly_clear | partial | exploratory  (how well-specified the requirement is today)
value               : micro (<$10k) | low ($10k–$50k) | medium ($50k–$250k) | high ($250k–$1M) | major (>$1M)
org                 : operational | corporate | executive | central
market              : sole | limited | some | broad  (estimated number of capable suppliers)
impact              : low | medium | high | critical  (if this procurement fails or is delayed)
overlays            : array — include any of: ai, privacy, critical_ict, construction, overseas, sme, aboriginal, covered_epp, modern_slavery
interaction         : minimal | quotes | tender | collaborative
timing              : urgent (<2 wks) | compressed (2–8 wks) | normal (2–6 mths) | extended (6+ mths)

Extended fields (also extract if evident):
ai_component        : true | false  (true if AI, ML, or automated decision-making is involved)
data_sensitivity    : public | internal | sensitive | protected  (sensitivity of data the system will handle)
technology_component: true | false  (true if ICT is a significant component of a non-ICT category purchase)
market_maturity     : emerging | developing | mature | commodity  (how established the supplier market is)
outcome_type        : output | outcome | hybrid  (is the contract for outputs, outcomes, or both)
delivery_criticality: deferrable | important | critical | non_negotiable  (impact of failure or delay)

═══════════════════════════════════════════════════
PATHWAY SELECTION RULES — exact logic, priority order
═══════════════════════════════════════════════════
These rules are applied deterministically in this exact order. First match wins.

Rule 1: purpose=emergency  OR  timing=urgent
        → EMERGENCY PROCUREMENT  [exception pathway — written justification mandatory]

Rule 2: value=major
        → MAJOR / STRATEGIC PROCUREMENT  [highest governance, Gateway Review may apply]

Rule 3: market=sole
        → LIMITED / DIRECT PROCUREMENT  [exception — sole supplier justification required]

Rule 4: market=limited  AND  impact∈{high, critical}
        → LIMITED / DIRECT PROCUREMENT  [exception — limited market + high stakes]

Rule 5: value=micro  AND  definition∈{clear, mostly_clear}
        → SIMPLE PURCHASE  [minimal process]

Rule 6: value∈{low, medium}  AND  market∈{some, broad}  AND  definition∈{clear, mostly_clear}
        → QUOTE-BASED  [3+ quotes, streamlined]

Rule 7: definition∈{exploratory, partial}  OR  interaction=collaborative
        → STRUCTURED MARKET ENGAGEMENT  [market dialogue to refine requirement]

Rule 8: (all other cases)
        → OPEN MARKET  [competitive tender, open advertising on NSW eTendering]

═══════════════════════════════════════════════════
WHICH FIELDS ARE PATHWAY-CRITICAL
═══════════════════════════════════════════════════
ASK a follow-up question for a field when BOTH are true:
  a) You cannot extract it confidently from the description
  b) Its uncertain values would route to DIFFERENT pathways

Critical fields (ask if uncertain):
  • market  — sole/limited can trigger exception pathway (Rule 3/4); broad keeps competitive
  • value   — major=Rule 2; micro=Rule 5; the rest determine quote vs open market
  • purpose / timing — emergency/urgent triggers Rule 1 (exception)
  • definition — exploratory/partial triggers Rule 7 (Structured Market Engagement)
  • impact  — only critical when market=limited (Rule 4 vs Rule 6)
  • overlays — ai and privacy trigger mandatory statutory obligations regardless of pathway
  • ai_component — if uncertain, ask: determines if AIAF and AI procurement obligations apply
  • data_sensitivity — if uncertain, ask: determines if Privacy Impact Assessment is mandatory

Less critical (only ask if truly ambiguous AND no other questions remain under the 4-question cap):
  • org          — affects approval tier routing, not pathway selection
  • interaction  — usually inferable from other fields

═══════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY valid JSON, no markdown
═══════════════════════════════════════════════════
{
  "extracted_profile": {
    "category":             "...",
    "purpose":              "...",
    "definition":           "...",
    "value":                "...",
    "org":                  "...",
    "market":               "...",
    "impact":               "...",
    "overlays":             [],
    "interaction":          "...",
    "timing":               "...",
    "ai_component":         null,
    "data_sensitivity":     null,
    "technology_component": null,
    "market_maturity":      null,
    "outcome_type":         null,
    "delivery_criticality": null
  },
  "confident_fields":  ["field", ...],   // extracted with high confidence
  "uncertain_fields":  ["field", ...],   // absent or ambiguous in the description
  "interpretation":    "1–2 sentence plain-English summary of what this procurement is.",
  "follow_up_questions": [
    {
      "field":    "market",
      "question": "Plain-language question phrased specifically to their situation — reference what they described.",
      "rationale": "One sentence: which policy rule this affects and why it matters for pathway selection.",
      "options": [
        {"value": "...", "label": "..."}
      ]
    }
  ]
}

Rules:
• Maximum 4 follow-up questions — only for pathway-critical uncertain fields
• Option values must EXACTLY match the valid values listed above
• For the overlays field, add "multi": true to the question object
• overlays options: ai, privacy, critical_ict, construction, overseas, sme — and always include {"value": "none", "label": "None of these apply"}
• Return ONLY valid JSON — no markdown fences, no commentary outside the JSON"""


def extract_intake(description: str) -> dict:
    """
    Extract a procurement profile and follow-up questions from a free-text description.
    Returns the full JSON response dict from Claude.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    prompt = f"""A NSW Government procurement officer has described their procurement need. Extract the profile and identify any follow-up questions needed.

OFFICER'S DESCRIPTION:
\"\"\"{description}\"\"\"

Extract all profile fields you can confidently infer. For fields that are ambiguous or missing AND pathway-determinative, include a targeted follow-up question grounded in the specific rules above.

Return only valid JSON matching the schema above."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=[{"type": "text", "text": INTAKE_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]

    return json.loads(raw)
