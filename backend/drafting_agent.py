"""
Drafting Agent (architecture §4.5).
Extends the existing LLM prose generation to cover RFx, evaluation plans, and approval summaries.
"""

import os
import json
import uuid
from datetime import datetime, timezone
import anthropic
import audit_logger

from briefing_generator import build_briefing_structure
from llm_assist import generate_briefing_prose, explain_pathway

SYSTEM_PROMPT = """You are an expert NSW Government procurement drafter. You produce clear, policy-compliant procurement documents.

You write in a formal but accessible style. Documents must:
- Be specific to the procurement described — no generic filler
- Translate policy requirements into plain supplier-facing language (never expose internal policy framework references)
- Use plain English where possible, technical language only where necessary
- Include all mandatory elements required by NSW procurement policy

Return JSON only. No markdown fences outside the JSON strings themselves."""


def _client():
    return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def _safe_json(raw: str) -> dict:
    """Parse JSON, recovering from truncated responses by closing open structures."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Find the last complete key-value pair by walking back from the end
        # and closing any open braces/brackets
        text = raw.rstrip()
        # Remove trailing partial string/value
        for cutoff in [',', '"']:
            idx = text.rfind(cutoff)
            if idx > 0:
                candidate = text[:idx]
                depth_b = candidate.count('{') - candidate.count('}')
                depth_sq = candidate.count('[') - candidate.count(']')
                closing = ']' * max(0, depth_sq) + '}' * max(0, depth_b)
                try:
                    return json.loads(candidate + closing)
                except json.JSONDecodeError:
                    continue
        raise


def _log_action(procurement_id: str, output_type: str, confidence: float = 0.82):
    audit_logger.write_agent_action({
        "agent_action_id": str(uuid.uuid4()),
        "agent": "drafting_agent",
        "input_reference": procurement_id,
        "output_type": output_type,
        "confidence": confidence,
        "review_required": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def draft_rfx(procurement_id: str, profile, strategy, obligations, details=None) -> dict:
    """
    Draft a supplier-facing RFx document.
    This document is sent TO suppliers to complete — it is NOT an internal policy document.
    Policy obligations are translated into supplier requirements; no internal framework references are exposed.
    Returns {"sections": {six supplier-facing string sections}}
    """
    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else (profile or {})
    strategy_dict = (strategy.model_dump() if hasattr(strategy, "model_dump") else strategy) or {}
    obls_dict = (obligations.model_dump() if hasattr(obligations, "model_dump") else obligations) or {}
    details_dict = (details.model_dump() if hasattr(details, "model_dump") else details) or {}

    selected = strategy_dict.get("human_selected_option") or strategy_dict.get("recommended_option", "")
    options = strategy_dict.get("options", [])
    selected_option = next((o for o in options if o.get("label") == selected), options[0] if options else {})

    # Translate obligations into supplier-facing requirement language (strip internal policy names)
    obligation_requirements = [o.get("body", "") for o in obls_dict.get("obligations", []) if o.get("body")]

    # Build specific details block for prompt injection
    details_block = ""
    if details_dict:
        reqs = details_dict.get("key_requirements", [])
        reqs_formatted = "\n".join(f"  • {r}" for r in reqs) if reqs else "  (none specified)"
        data_types = ", ".join(details_dict.get("data_types", [])) or "not specified"
        details_block = f"""
PROCUREMENT DETAILS (use these to make all sections specific — do not use generic placeholders):
- Title: {details_dict.get('title', '[not provided]')}
- What the supplier will deliver: {details_dict.get('deliverables_description', '')}
- Key specific requirements:
{reqs_formatted}
- Indicative budget: {details_dict.get('indicative_budget') or 'not specified'}
- Pricing model: {details_dict.get('pricing_model') or 'to be determined'}
- Contract duration: {details_dict.get('contract_duration') or 'to be determined'}
- Target market release: {details_dict.get('target_market_release') or 'to be confirmed'}
- Incumbent supplier: {details_dict.get('incumbent_supplier') or 'none identified'}
- Hosting requirements: {details_dict.get('hosting_requirements') or 'not applicable'}
- Integration requirements: {details_dict.get('integration_requirements') or 'none specified'}
- AI use case: {details_dict.get('ai_use_case') or 'not applicable'}
- Human oversight level: {details_dict.get('human_oversight_level') or 'not applicable'}
- Data types handled: {data_types}
- Success metrics / KPIs: {details_dict.get('success_metrics') or 'to be defined'}
"""

    prompt = f"""Draft a supplier-facing RFx (Request for Tender/Proposal/Quote) document for an NSW Government procurement.

IMPORTANT: This document will be sent directly to potential suppliers. It must be written entirely from the agency's perspective addressing the supplier.
- Do NOT mention internal policy frameworks, obligation IDs, or compliance processes by name
- DO translate policy requirements into plain supplier obligations (e.g. "You must provide evidence of ISO 27001 certification" not "NSW Cyber Security Policy applies")
- Write as if you are the agency addressing the supplier: "Respondents must...", "Your response should...", "The successful supplier will..."
- Where a procurement title is provided in PROCUREMENT DETAILS, use it throughout — do not write "[Agency]" or "[Procurement]" as placeholders

PROCUREMENT CONTEXT (internal — use to inform content, do not reproduce verbatim):
{json.dumps(profile_dict, indent=2)}
{details_block}
SOURCING APPROACH: {selected}

REQUIREMENTS TO TRANSLATE INTO SUPPLIER OBLIGATIONS (internal source — rewrite in supplier-facing language):
{json.dumps(obligation_requirements, indent=2)}

Draft the following six sections. Return JSON where EVERY value is a plain string (no nested objects or arrays):
{{
  "invitation_and_background": "2-3 paragraphs addressed to the supplier. Open with an invitation to respond (e.g. 'The [Agency] invites suitably qualified organisations to submit a response...'). Describe the agency context, the purpose of this procurement, and what the successful respondent will be engaged to deliver.",

  "scope_of_work": "3-4 paragraphs describing in detail what the successful supplier will be required to deliver: deliverables, timeframes, locations, interfaces with agency staff, and any phasing. Be specific — no generic language.",

  "mandatory_and_desirable_requirements": "A single formatted string listing what respondents must demonstrate. Use M: prefix for mandatory (pass/fail) items and D: prefix for desirable items. Each item on its own line. Cover: technical capability, certifications, security posture, data handling, team qualifications, relevant experience. Example format:\\nM: Respondents must hold current ISO 27001 certification or equivalent, evidenced by a current certificate.\\nM: All data must be stored and processed within Australian data centres.\\nD: Prior experience delivering similar services to NSW Government agencies is highly regarded.",

  "how_to_respond": "A single formatted string with clear instructions to the supplier on how to structure and lodge their response. Cover: required sections and page limits, mandatory attachments (e.g. company profile, referee contacts, pricing schedule, relevant experience examples), file format and lodgement method, closing date placeholder [CLOSING DATE], and contact details placeholder [CONTACT NAME/EMAIL].",

  "evaluation_approach": "2-3 paragraphs telling respondents how their submission will be assessed. Explain that responses will be evaluated by a panel against weighted criteria, name the key criteria areas (without specific weightings), and state that the agency does not bind itself to accept the lowest price or any response. Mention that mandatory requirements are pass/fail gates.",

  "conditions_of_participation": "A single formatted string covering the key conditions suppliers must accept to participate. Cover: conflict of interest declaration requirement, probity obligations, insurance minimums (public liability, professional indemnity), right of the agency to not proceed or accept any response, confidentiality of the process, and any NSW-specific supplier conduct requirements."
}}"""

    response = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=6000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    result = _safe_json(raw)
    _log_action(procurement_id, "rfx_draft", confidence=0.80)
    payload = {"procurement_id": procurement_id, "sections": result}
    audit_logger.write_sourcing_artifact(procurement_id, "rfx_draft", payload)
    return payload


def draft_evaluation_plan(procurement_id: str, profile, strategy, details=None) -> dict:
    """
    Draft a weighted evaluation plan with scoring criteria.
    Returns {"criteria": list[EvaluationCriterion-like dicts], "methodology": str, "mandatory_gates": list}
    """
    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else (profile or {})
    strategy_dict = (strategy.model_dump() if hasattr(strategy, "model_dump") else strategy) or {}
    details_dict = (details.model_dump() if hasattr(details, "model_dump") else details) or {}

    # Load template for the category
    import json as _json
    from pathlib import Path
    templates_path = Path(__file__).parent / "data" / "evaluation_criteria_templates.json"
    with open(templates_path) as f:
        templates = _json.load(f)["templates"]

    category = profile_dict.get("category", "professional_services")
    ai = profile_dict.get("ai_component") or ("ai" in profile_dict.get("overlays", []))
    template_key = "ai_ml" if ai else category if category in templates else "professional_services"
    base_template = templates.get(template_key, templates["professional_services"])

    # Build details injection block
    details_block = ""
    if details_dict:
        reqs = details_dict.get("key_requirements", [])
        reqs_str = "; ".join(reqs) if reqs else "not specified"
        details_block = f"""
SPECIFIC PROCUREMENT DETAILS (use these to make scoring guidance concrete and specific):
- Title: {details_dict.get('title', '[not provided]')}
- What is being delivered: {details_dict.get('deliverables_description', '')}
- Key requirements: {reqs_str}
- Pricing model: {details_dict.get('pricing_model') or 'not specified'}
- Success metrics / KPIs: {details_dict.get('success_metrics') or 'to be defined'}
- AI use case: {details_dict.get('ai_use_case') or 'not applicable'}
- Human oversight level: {details_dict.get('human_oversight_level') or 'not applicable'}
"""

    prompt = f"""Customise this evaluation plan for the specific NSW Government procurement below.

PROCUREMENT PROFILE:
{json.dumps(profile_dict, indent=2)}
{details_block}
STRATEGY: {strategy_dict.get('human_selected_option') or strategy_dict.get('recommended_option', '')}

BASE CRITERIA TEMPLATE:
{json.dumps(base_template, indent=2)}

Customise the criteria for this specific procurement context. You may adjust weightings (must sum to 1.0), scoring guidance, and add/remove criteria as appropriate. Where SPECIFIC PROCUREMENT DETAILS are provided, write scoring guidance that references the actual deliverables, requirements, and success metrics — not generic descriptions. Return JSON:
{{
  "criteria": [
    {{
      "criterion_id": "EC-XXX-001",
      "label": "Criterion name",
      "weighting": 0.XX,
      "scoring_guidance": "How to score 0-10 for this specific procurement.",
      "is_mandatory": false
    }}
  ],
  "methodology": "2-3 sentences describing the evaluation methodology, panel composition, and how scores will be combined.",
  "mandatory_gates": ["criterion_id of any must-pass criteria"],
  "evaluation_panel_guidance": "1-2 sentences on who should sit on the evaluation panel for this procurement."
}}

Weightings must sum to exactly 1.0."""

    response = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    result = _safe_json(raw)
    _log_action(procurement_id, "evaluation_plan", confidence=0.85)
    payload = {"procurement_id": procurement_id, **result}
    audit_logger.write_sourcing_artifact(procurement_id, "eval_plan", payload)
    return payload


def draft_approval_summary(procurement_id: str, profile, pathway, obligations, approvals, details=None) -> dict:
    """
    Draft an executive approval summary briefing.
    Returns {"summary": str, "key_facts": list, "obligations_summary": str, "approval_chain": list, "recommendation": str}
    """
    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile
    pathway_dict = pathway.model_dump() if hasattr(pathway, "model_dump") else pathway
    obls_dict = obligations.model_dump() if hasattr(obligations, "model_dump") else obligations
    approvals_dict = approvals.model_dump() if hasattr(approvals, "model_dump") else approvals
    details_dict = (details.model_dump() if hasattr(details, "model_dump") else details) or {}

    # Build specific facts block so key_facts are populated with real values
    facts_block = ""
    if details_dict:
        facts_block = f"""
SPECIFIC PROCUREMENT FACTS (use these to populate key_facts with real values — not placeholders):
- Procurement title: {details_dict.get('title', '[not provided]')}
- What is being procured: {details_dict.get('deliverables_description', '')}
- Indicative budget: {details_dict.get('indicative_budget') or 'to be confirmed'}
- Contract duration: {details_dict.get('contract_duration') or 'to be confirmed'}
- Target market release: {details_dict.get('target_market_release') or 'to be confirmed'}
- Incumbent supplier: {details_dict.get('incumbent_supplier') or 'none identified'}
- Pricing model: {details_dict.get('pricing_model') or 'to be determined'}
"""

    prompt = f"""Draft an executive approval summary for this NSW Government procurement.

PROFILE:
{json.dumps(profile_dict, indent=2)}
{facts_block}
PATHWAY: {pathway_dict.get('name', '')} — {pathway_dict.get('label', '')}
PATHWAY RATIONALE: {pathway_dict.get('rationale', [])}

OBLIGATIONS TRIGGERED ({len(obls_dict.get('obligations', []))}):
{json.dumps([o.get('title') for o in obls_dict.get('obligations', [])], indent=2)}

APPROVAL CHAIN:
{json.dumps(approvals_dict.get('approval_steps', []), indent=2)}

Draft a concise approval summary for the delegated authority. Where SPECIFIC PROCUREMENT FACTS are provided, use them directly in key_facts (title, exact budget figure, exact duration, release date, incumbent status) — never write "$XXX" or "[TBD]" if actual values are available. Return JSON:
{{
  "executive_summary": "3-4 sentence plain-English summary of what is being procured, why, and what pathway is proposed.",
  "key_facts": [
    "Procurement: [title]",
    "Estimated value: [budget]",
    "Category: ...",
    "Pathway: ...",
    "Contract duration: ...",
    "Target release: ...",
    "Key risk: ..."
  ],
  "obligations_summary": "2-3 sentences summarising the mandatory policy obligations this procurement triggers and how they will be addressed.",
  "value_for_money_statement": "1-2 sentences explaining how value for money will be achieved through the proposed approach.",
  "recommendation": "One clear sentence: the recommended action for the approving delegate."
}}"""

    response = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    result = _safe_json(raw)
    _log_action(procurement_id, "approval_summary", confidence=0.88)
    payload = {"procurement_id": procurement_id, **result}
    audit_logger.write_sourcing_artifact(procurement_id, "approval_summary", payload)
    return payload
