"""
LLM support layer — Claude API for prose generation and explanation only.
The system decides. AI explains.
"""

import json
import os
import anthropic
from models import ProcurementProfile, PathwayResult, BriefingStructure

def _client():
    return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert NSW Government procurement advisor supporting a procurement decision system.

Your role is strictly limited to:
1. Writing clear, professional prose based on structured data provided to you
2. Explaining procurement decisions that have already been made by the rules engine
3. Drafting briefing note sections from structured content

You must NOT:
- Make procurement decisions or recommendations beyond what the structured data specifies
- Interpret policy or determine whether rules apply — the system has already done this
- Change, override, or second-guess the pathway or obligations provided
- Add obligations, approvals, or process steps not in the structured data

Write in plain English suitable for a NSW Government briefing note:
- Professional but not bureaucratic
- Clear and direct — avoid jargon where possible
- Accurate to the structured data provided
- Appropriate for a senior public servant audience

When writing briefing note sections, keep each section focused and concise (2-4 paragraphs maximum unless the data requires more)."""

DCS_SYSTEM_PROMPT_ADDITION = """

ADDITIONAL CONTEXT — DEPARTMENT OF CUSTOMER SERVICE (DCS) PROCUREMENT:
This procurement is for the Department of Customer Service or Service NSW. The following DCS-specific rules apply in addition to the NSW Procurement Policy Framework. These rules come from the DCS Procurement Manual (December 2025, v11.82).

When writing the briefing note, the Mandatory Compliance Requirements section must explicitly address:
1. PRN (Procurement Reference Number): State whether a PRN has been or will be obtained from DCS Procurement, and at what stage. ICT and Professional Services require a PRN at any value; all other categories require a PRN at $30k+.
2. PSM Pro (if professional services/consulting): Confirm the engagement will be managed through PSM Pro (SAP Fieldglass via KellyOCG), effective 30 September 2024.
3. Risk Assessment: State which DCS Combined Risk Assessment template tabs are required (Business Risk always; ICT Risk if ICT above $250k) and who will approve the risk assessment.
4. buy.NSW publication: If above $150k incl. GST, confirm the procurement will be published on buy.NSW before going to market, citing PBD-2024-01.
5. GIPA disclosure: State that the contract will be uploaded to the DCS Central Contracts Register and disclosed on Tenders NSW within 21 days of execution.
6. ELT endorsement: If professional services above $50k, confirm ELT endorsement will be obtained before approaching market.
7. Evaluation Committee: If above $250k, state the Chair seniority required (Grade 9/10 for $250k–$1M; SEB1+ or DCS Procurement above $1M).

In the Approvals section, use the exact DCS role names from the structured data provided (Director/Manager, Finance Director, Executive Director, Chief Procurement Officer, Chief Financial Officer, Deputy Secretary, Secretary, Minister as applicable). Do not substitute generic descriptions.

The declaration must reference the DCS Procurement Manual (current version, December 2025) in addition to the NSW Procurement Policy Framework."""


DCS_AGENCY_IDS = {"nsw_dcs", "nsw_service_nsw"}


def _get_effective_system_prompt(profile: "ProcurementProfile") -> str:
    """Return the base system prompt, plus DCS additions if applicable."""
    if profile.agency_id in DCS_AGENCY_IDS:
        return SYSTEM_PROMPT + DCS_SYSTEM_PROMPT_ADDITION
    return SYSTEM_PROMPT


def explain_pathway(profile: ProcurementProfile, pathway: PathwayResult) -> str:
    """Generate a plain-English explanation of why a pathway was selected."""
    profile_summary = {
        "category": profile.category,
        "purpose": profile.purpose,
        "definition": profile.definition,
        "value": profile.value,
        "market": profile.market,
        "impact": profile.impact,
        "overlays": profile.overlays,
        "timing": profile.timing,
    }

    prompt = f"""The procurement decision system has selected the following pathway based on the user's answers:

PATHWAY SELECTED: {pathway.label}
PATHWAY DESCRIPTION: {pathway.description}

SYSTEM RATIONALE (already determined):
{chr(10).join(f'- {r}' for r in pathway.rationale)}

PROCUREMENT PROFILE:
{json.dumps(profile_summary, indent=2)}

Write a clear, 2-3 paragraph explanation for the user explaining why this pathway was recommended for their specific situation.
Reference their specific circumstances (what they're buying, their value range, their market situation).
Do not add new decision rationale — only explain what the system has already determined.
Write in second person ("Your procurement...").
"""

    system_prompt = _get_effective_system_prompt(profile)
    response = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def generate_briefing_prose(
    briefing_structure: BriefingStructure,
    profile: ProcurementProfile,
    pathway: PathwayResult,
) -> dict[str, str]:
    """
    Generate professional prose for each briefing note section.
    Returns a dict mapping section_id to prose string.
    """
    sections_data = {
        s.id: {"heading": s.heading, "data": s.data}
        for s in briefing_structure.sections
    }
    from briefing_template import get_template_prompt_guidance
    template_guidance = get_template_prompt_guidance()

    prompt = f"""Write a complete NSW Government briefing note based on the following structured data.

PROCUREMENT PROFILE SUMMARY:
- Category: {profile.category}
- Estimated Value: {profile.value}
- Purpose: {profile.purpose}
- Recommended Pathway: {pathway.label}
- Exception pathway: {pathway.exception}

BRIEFING NOTE SECTIONS TO WRITE:
{json.dumps(sections_data, indent=2)}

TEMPLATE AUTHORING GUIDANCE:
{json.dumps({section_id: template_guidance.get(section_id, {}) for section_id in sections_data.keys()}, indent=2)}

For each section, write clear, professional prose appropriate for a NSW Government briefing note.
Where template guidance is provided, follow it.
Return your response as a JSON object where the keys are the section IDs and the values are the prose text for each section.
Keep each section focused. For the "justification" section (if present), write a placeholder indicating that the officer must document specific justification.

Return ONLY valid JSON — no markdown, no explanation outside the JSON.
Format: {{"section_id": "prose text", ...}}"""

    system_prompt = _get_effective_system_prompt(profile)
    response = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return structured placeholder text
        return {s.id: f"[Draft text for: {s.heading}]" for s in briefing_structure.sections}
