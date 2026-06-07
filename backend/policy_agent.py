"""
Policy Interpretation Agent (architecture §4.2).
Retrieves and explains policy obligations in plain English with mandatory citations.
Cannot invent requirements — must cite encoded obligation.policy fields.
"""

import os
import json
import anthropic

SYSTEM_PROMPT = """You are the NSW Government Procurement Policy Interpretation Agent.

Your role: explain procurement policy obligations clearly and accurately to NSW Government procurement officers.

CRITICAL RULES:
1. You MUST cite the specific policy source for every statement you make. Only cite sources that appear in the obligation data provided to you.
2. You MUST NOT invent, extrapolate, or imply requirements that are not in the obligation data provided.
3. If asked something outside the provided obligations, say: "This is outside the scope of the obligations provided — please consult your agency's procurement team or the relevant policy directly."
4. Write in plain English. No jargon. Assume the reader is a capable government officer who needs clarity, not expertise.
5. Each explanation should: (a) state what the obligation requires in 1-2 sentences, (b) explain why it exists in 1 sentence, (c) state what the officer needs to do next (concrete next step).

Format: Return JSON only. No markdown fences."""


def explain_obligations(obligations: list[dict], profile: dict) -> dict:
    """
    Generate plain-English explanations for a set of triggered obligations.
    Returns {obligation_id: {"plain_english": str, "next_step": str, "citation": str}}
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    obls_text = json.dumps(obligations, indent=2)
    profile_text = json.dumps(profile, indent=2)

    prompt = f"""You are explaining the following procurement policy obligations to a NSW Government procurement officer.

PROCUREMENT CONTEXT:
{profile_text}

OBLIGATIONS TO EXPLAIN:
{obls_text}

For each obligation, produce a plain-English explanation. Return JSON in this exact format:
{{
  "<obligation_id>": {{
    "plain_english": "1-2 sentences: what does this require in plain language?",
    "why": "1 sentence: why does this rule exist?",
    "next_step": "Concrete action the officer should take now.",
    "citation": "Exact policy source from the obligation's 'policy' field."
  }}
}}

Include ALL obligations listed. Do not skip any. Return ONLY valid JSON."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)


def answer_policy_question(question: str, obligations: list[dict], profile: dict) -> dict:
    """
    Answer a one-off policy question with mandatory citations.
    Returns {"answer": str, "citations": list[str], "out_of_scope": bool}
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    prompt = f"""A NSW Government procurement officer has a policy question about their procurement.

PROCUREMENT CONTEXT:
{json.dumps(profile, indent=2)}

AVAILABLE POLICY OBLIGATIONS (your only source of truth):
{json.dumps(obligations, indent=2)}

OFFICER'S QUESTION: {question}

Answer the question using ONLY the obligation data above. If the answer is not in the obligations, set out_of_scope to true.

Return JSON:
{{
  "answer": "Plain-English answer with specific citations.",
  "citations": ["Policy source 1", "Policy source 2"],
  "out_of_scope": false
}}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)
