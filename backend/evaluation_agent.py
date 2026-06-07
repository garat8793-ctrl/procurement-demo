"""
Evaluation Support Agent (architecture §4.6).
Ingests supplier responses and scores against evaluation criteria.

GUARDRAIL: Does not make award decisions or compare suppliers with each other.
Supports human evaluators with structured, criteria-aligned evidence.
"""

import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
import anthropic
import audit_logger

SYSTEM_PROMPT = """You are an NSW Government Procurement Evaluation Support Agent.

Your role: help human evaluators assess supplier responses against evaluation criteria. You extract evidence and propose scores — but YOU DO NOT make award decisions or recommend which supplier should win.

CRITICAL RULES:
1. Assess each criterion INDEPENDENTLY — do not compare suppliers against each other
2. Base scores and evidence ONLY on what is in the submission text provided
3. If a criterion is not addressed in the submission, score 0 and note "Not addressed in submission"
4. For mandatory (pass/fail) criteria: score 1 = PASS, 0 = FAIL — no middle ground
5. Flag any claims that cannot be verified from the submission text (e.g. claimed experience with no evidence)
6. Write evidence extracts in the evaluator's voice — you are helping them, not deciding for them
7. Never state "this supplier should be selected" or equivalent

Return JSON only. No markdown fences."""

_evaluation_store: dict[str, list] = {}  # procurement_id -> list of SupplierEvaluation dicts


def evaluate_submission(
    procurement_id: str,
    supplier_id: str,
    supplier_name: str,
    submission_text: str,
    criteria: list,
    profile,
) -> dict:
    """
    Evaluate a single supplier submission against criteria.
    Returns a dict matching SupplierEvaluation model.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile
    criteria_dicts = [c.model_dump() if hasattr(c, "model_dump") else c for c in criteria]

    prompt = f"""Evaluate the following supplier response against the evaluation criteria for this NSW Government procurement.

PROCUREMENT CONTEXT:
{json.dumps(profile_dict, indent=2)}

SUPPLIER: {supplier_name}

EVALUATION CRITERIA:
{json.dumps(criteria_dicts, indent=2)}

SUPPLIER SUBMISSION:
\"\"\"
{submission_text[:8000]}
\"\"\"

For each criterion, extract evidence from the submission and propose a score. Return JSON:
{{
  "scores": {{
    "<criterion_id>": {{
      "score": <0-10, or 0/1 for mandatory>,
      "evidence": "Direct quote or paraphrase of evidence from the submission supporting this score. If not addressed, state 'Not addressed in submission.'",
      "risks": ["Any unverifiable claims or risks noted"],
      "mandatory_pass": true_or_false
    }}
  }},
  "agent_summary": "3-5 sentences summarising the submission's overall strengths and gaps relative to the criteria. Do NOT recommend whether to select this supplier."
}}

Score every criterion listed. Do not skip any."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    parsed = json.loads(raw)

    # Calculate weighted total
    scores = parsed.get("scores", {})
    total = 0.0
    mandatory_pass = True
    for c in criteria_dicts:
        cid = c["criterion_id"]
        if cid not in scores:
            continue
        score_data = scores[cid]
        raw_score = score_data.get("score", 0)
        if c.get("is_mandatory"):
            if raw_score < 1:
                mandatory_pass = False
        else:
            total += (raw_score / 10.0) * c.get("weighting", 0)

    evaluation_id = str(uuid.uuid4())
    result = {
        "evaluation_id": evaluation_id,
        "procurement_id": procurement_id,
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "scores": scores,
        "total_weighted_score": round(total * 10, 2),  # Convert to 0-10 scale
        "mandatory_pass": mandatory_pass,
        "agent_summary": parsed.get("agent_summary", ""),
        "review_required": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if procurement_id not in _evaluation_store:
        _evaluation_store[procurement_id] = []
    _evaluation_store[procurement_id].append(result)

    audit_logger.write_agent_action({
        "agent_action_id": str(uuid.uuid4()),
        "agent": "evaluation_agent",
        "input_reference": procurement_id,
        "output_type": "supplier_evaluation",
        "confidence": 0.78,
        "review_required": True,
        "timestamp": result["timestamp"],
    })
    return result


def get_evaluation_report(procurement_id: str) -> dict:
    """
    Return all evaluations for a procurement, ranked by weighted score.
    Includes comparison grid but NO award recommendation.
    """
    evaluations = _evaluation_store.get(procurement_id, [])
    # Sort by total_weighted_score descending, mandatory_pass True first
    sorted_evals = sorted(
        evaluations,
        key=lambda e: (e["mandatory_pass"], e["total_weighted_score"]),
        reverse=True,
    )
    return {
        "procurement_id": procurement_id,
        "total_submissions": len(evaluations),
        "evaluations": sorted_evals,
        "note": "Ranked by weighted score. Final award decision must be made by the evaluation panel.",
    }


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Extract text from uploaded file for submission processing."""
    try:
        if filename.lower().endswith(".pdf"):
            import pdfplumber
            import io
            text_parts = []
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
        elif filename.lower().endswith(".docx"):
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n".join(p.text for p in doc.paragraphs)
        else:
            return file_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        return f"[Text extraction failed: {e}]"
