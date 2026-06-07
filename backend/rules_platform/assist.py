from __future__ import annotations

import json
import os
import re
from typing import Any

try:
    import anthropic
except Exception:  # pragma: no cover - optional runtime dependency
    anthropic = None

from .domain import (
    AssistedScenario,
    CanonicalCondition,
    CanonicalEffect,
    CanonicalRule,
    EngineFinding,
    PolicyAssistRequest,
    PolicyAssistResponse,
    ProposedRuleChange,
    RuleProvenance,
    RuleSetSnapshot,
)


AI_POLICY_ASSIST_PROMPT = """You are an expert procurement policy modelling assistant.

Convert policy text into candidate canonical rules and modelling scenarios for a governed rules engine.

Return ONLY valid JSON in this exact shape:
{
  "summary": "short plain-English summary",
  "rules": [
    {
      "rule_id": "candidate:...",
      "rule_type": "obligation|pre_check|workflow|approval|advisory",
      "source_type": "policy_candidate",
      "title": "short title",
      "summary": "plain-English rule statement",
      "priority": 50,
      "precedence": 50,
      "tags": ["..."],
      "objectives": ["..."],
      "conditions": [
        { "field": "category", "operator": "eq|in|contains_any", "value": "consulting" }
      ],
      "effects": [
        { "effect_type": "obligation|pre_check|workflow_step|approval|advisory", "title": "short title", "detail": "plain-English effect" }
      ],
      "confidence": 0.75,
      "ambiguity_notes": ["optional note"]
    }
  ],
  "scenarios": [
    {
      "case_id": "scenario-1",
      "case_name": "short scenario name",
      "rationale": "why this case matters",
      "facts": {
        "category": "consulting",
        "value": "medium",
        "purpose": "new",
        "market": "some",
        "impact": "medium",
        "interaction": "tender",
        "timing": "normal",
        "org": "corporate",
        "overlays": []
      }
    }
  ],
  "warnings": ["optional warning"]
}

Rules:
- Extract candidate rules, not final live rules.
- Keep conditions grounded in the signal taxonomy provided by the user.
- Do not invent source citations.
- Prefer 2-6 useful candidate rules and 2-4 useful scenarios.
- If policy language is ambiguous, include an ambiguity note on the affected rule.
"""


AMBIGUOUS_PATTERNS = [
    "where possible",
    "as appropriate",
    "reasonable",
    "where practicable",
    "if needed",
    "if appropriate",
    "consider",
    "may wish to",
]

ACTION_PATTERN = re.compile(
    r"\b(must|required|mandatory|ensure|obtain|submit|review|assess|publish|report|approve|endorse|before|prior to|risk assessment)\b",
    re.IGNORECASE,
)

CATEGORY_ALIASES = {
    "ict_saas": ["saas", "software as a service", "software subscription", "cloud software"],
    "ict_hardware": ["hardware", "device", "laptop", "desktop", "server", "network equipment"],
    "professional_services": ["professional services"],
    "consulting": ["consulting", "consultant", "advisory"],
    "goods": ["goods", "equipment", "products", "product supply"],
    "construction": ["construction", "works", "building", "infrastructure works"],
    "labour_hire": ["labour hire", "temporary staff", "contract staff"],
}

OVERLAY_ALIASES = {
    "ai": ["ai", "artificial intelligence", "machine learning", "automated decision"],
    "privacy": ["privacy", "personal information", "pii", "sensitive information"],
    "critical_ict": ["critical ict", "critical system", "critical infrastructure", "essential system"],
    "construction": ["construction"],
    "overseas": ["overseas", "offshore", "international supplier"],
    "sme": ["sme", "small business", "small and medium enterprise"],
    "aboriginal": ["aboriginal", "indigenous"],
    "covered_epp": ["epp", "employment protection", "covered epp"],
    "modern_slavery": ["modern slavery", "ethical sourcing"],
}


def _normalise(text: str) -> str:
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in (text or "")).split())


def _tokens(text: str) -> set[str]:
    return {token for token in _normalise(text).split(" ") if len(token) > 2}


def _similarity(left: str, right: str) -> float:
    a = _tokens(left)
    b = _tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _condition_signature(rule: CanonicalRule) -> tuple:
    return tuple(sorted((condition.field, condition.operator, str(condition.value)) for condition in rule.conditions))


def _conditions_overlap(left: CanonicalRule, right: CanonicalRule) -> bool:
    left_by_field = {condition.field: condition for condition in left.conditions}
    right_by_field = {condition.field: condition for condition in right.conditions}
    shared = set(left_by_field) & set(right_by_field)
    if not shared:
        return False
    for field in shared:
        a = left_by_field[field].value
        b = right_by_field[field].value
        left_values = a if isinstance(a, list) else [a]
        right_values = b if isinstance(b, list) else [b]
        if not set(map(str, left_values)) & set(map(str, right_values)):
            return False
    return True


def _make_title(text: str) -> str:
    cleaned = re.sub(r"^[\-\*\d\.\)\s]+", "", text.strip())
    parts = re.split(r"[;:\-]", cleaned, maxsplit=1)
    lead = parts[0].strip()
    lead = re.sub(r"[^A-Za-z0-9\s]", " ", lead)
    lead = " ".join(lead.split())
    words = lead.split()
    if len(words) > 8:
        lead = " ".join(words[:8])
    return lead[:1].upper() + lead[1:] if lead else "Candidate policy rule"


def _default_facts() -> dict[str, Any]:
    return {
        "category": "consulting",
        "value": "medium",
        "purpose": "new",
        "market": "some",
        "impact": "medium",
        "interaction": "tender",
        "timing": "normal",
        "org": "corporate",
        "overlays": [],
    }


def _detect_values(text: str, values: list[str], aliases: dict[str, list[str]] | None = None) -> list[str]:
    normalised = _normalise(text)
    detected: list[str] = []
    for value in values:
        search_terms = [value.replace("_", " ")]
        if aliases and value in aliases:
            search_terms.extend(aliases[value])
        if any(term in normalised for term in search_terms):
            detected.append(value)
    return detected


def _infer_value_band(text: str) -> list[str]:
    normalised = text.lower()
    if re.search(r"\$?\s*1\s*m(?:illion)?|\$?\s*[1-9]\d{6,}", normalised):
        return ["major"]
    if re.search(r"\$?\s*250\s*k|\$?\s*500\s*k|\$?\s*750\s*k", normalised):
        return ["high", "major"]
    if re.search(r"\$?\s*50\s*k|\$?\s*100\s*k|\$?\s*150\s*k|\$?\s*200\s*k", normalised):
        return ["medium", "high", "major"]
    if re.search(r"\$?\s*10\s*k|\$?\s*20\s*k|\$?\s*30\s*k", normalised):
        return ["low", "medium", "high", "major"]
    return []


def _infer_conditions(text: str, taxonomy: dict[str, Any]) -> list[CanonicalCondition]:
    signals = {item.get("field"): item.get("values", []) for item in taxonomy.get("signals", [])}
    conditions: list[CanonicalCondition] = []

    category_hits = _detect_values(text, signals.get("category", []), CATEGORY_ALIASES)
    if category_hits:
        conditions.append(CanonicalCondition(
            field="category",
            operator="eq" if len(category_hits) == 1 else "in",
            value=category_hits[0] if len(category_hits) == 1 else category_hits,
        ))

    overlay_hits = _detect_values(text, signals.get("overlays", []), OVERLAY_ALIASES)
    if overlay_hits:
        conditions.append(CanonicalCondition(field="overlays", operator="contains_any", value=overlay_hits))

    for field in ["purpose", "market", "impact", "interaction", "timing", "org"]:
        hits = _detect_values(text, signals.get(field, []))
        if hits:
            conditions.append(CanonicalCondition(
                field=field,
                operator="eq" if len(hits) == 1 else "in",
                value=hits[0] if len(hits) == 1 else hits,
            ))

    value_hits = _detect_values(text, signals.get("value", []))
    threshold_hits = _infer_value_band(text)
    merged_values = []
    for value in [*value_hits, *threshold_hits]:
        if value not in merged_values:
            merged_values.append(value)
    if merged_values:
        conditions.append(CanonicalCondition(
            field="value",
            operator="eq" if len(merged_values) == 1 else "in",
            value=merged_values[0] if len(merged_values) == 1 else merged_values,
        ))

    return conditions[:5]


def _classify_rule_type(text: str) -> tuple[str, str]:
    normalised = _normalise(text)
    if any(term in normalised for term in ["approval", "approve", "endorse", "sign off"]):
        return "approval", "approval"
    if any(term in normalised for term in ["before", "prior to", "check", "review", "assess", "risk assessment"]):
        return "pre_check", "pre_check"
    if any(term in normalised for term in ["step", "workflow", "publish", "report", "escalate", "route"]):
        return "workflow", "workflow_step"
    if any(term in normalised for term in ["consider", "recommended", "should"]):
        return "advisory", "advisory"
    return "obligation", "obligation"


def _extract_candidate_lines(policy_text: str, max_items: int) -> list[str]:
    lines = [line.strip() for line in policy_text.splitlines() if line.strip()]
    bullet_like = [
        line for line in lines
        if ACTION_PATTERN.search(line) or re.match(r"^(\d+[\.\)]|[-*])\s+", line)
    ]
    seed_candidates = bullet_like if bullet_like else re.split(r"(?<=[\.\?!])\s+", policy_text)
    candidates: list[str] = []
    for item in seed_candidates:
        parts = re.split(r"(?<=[\.\?!])\s+", item)
        candidates.extend(part.strip() for part in parts if part.strip())
    cleaned = []
    for raw in candidates:
        line = raw.strip()
        if len(line) < 30:
            continue
        if line not in cleaned:
            cleaned.append(line)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _build_rule(
    line: str,
    request: PolicyAssistRequest,
    taxonomy: dict[str, Any],
    index: int,
) -> CanonicalRule:
    rule_type, effect_type = _classify_rule_type(line)
    confidence = 0.82 if ACTION_PATTERN.search(line) else 0.68
    conditions = _infer_conditions(line, taxonomy) or _infer_conditions(request.policy_text, taxonomy)
    title = _make_title(line)
    return CanonicalRule(
        rule_id=f"candidate:{re.sub(r'[^a-z0-9]+', '-', (request.source_id or request.source_name).lower()).strip('-') or 'policy'}:{index + 1}",
        rule_type=rule_type,
        source_type="policy_candidate",
        source_id=request.source_id or "policy_assist",
        source_name=request.source_name,
        title=title,
        summary=line.strip(),
        active=True,
        priority=45 if rule_type in {"workflow", "approval"} else 50,
        precedence=45 if rule_type in {"approval", "workflow"} else 50,
        tags=["policy_assist", "candidate"],
        objectives=["compliance", "assurance"] if rule_type in {"approval", "workflow"} else ["compliance"],
        conditions=conditions,
        effects=[CanonicalEffect(
            effect_type=effect_type,
            title=title,
            detail=line.strip(),
            metadata={},
        )],
        provenance=[RuleProvenance(
            source_id=request.source_id or "policy_assist",
            source_name=request.source_name,
            citation=None,
            anchor=f"candidate_line_{index + 1}",
            confidence=confidence,
        )],
        metadata={
            "assistant_mode": "heuristic",
            "ambiguity_terms": [term for term in AMBIGUOUS_PATTERNS if term in _normalise(line)],
        },
    )


def _build_scenarios(rules: list[CanonicalRule], max_items: int = 3) -> list[AssistedScenario]:
    scenarios: list[AssistedScenario] = []
    for index, rule in enumerate(rules[:max_items]):
        facts = _default_facts()
        for condition in rule.conditions:
            if condition.operator == "contains_any":
                facts[condition.field] = condition.value if isinstance(condition.value, list) else [condition.value]
            elif condition.operator == "in":
                values = condition.value if isinstance(condition.value, list) else [condition.value]
                facts[condition.field] = values[0] if values else facts.get(condition.field)
            else:
                facts[condition.field] = condition.value
        scenarios.append(AssistedScenario(
            case_id=f"assist-scenario-{index + 1}",
            case_name=f"Stress test {rule.title}",
            facts=facts,
            rationale=f"Tests whether the candidate rule '{rule.title}' fires as intended under a plausible procurement profile.",
        ))
    if not scenarios:
        scenarios.append(AssistedScenario(
            case_id="assist-scenario-1",
            case_name="Baseline procurement",
            facts=_default_facts(),
            rationale="Fallback scenario because no strong candidate rules were extracted.",
        ))
    return scenarios


def _build_findings(snapshot: RuleSetSnapshot, rules: list[CanonicalRule]) -> list[EngineFinding]:
    findings: list[EngineFinding] = []
    active_rules = [rule for rule in snapshot.rules if rule.active]

    for rule in rules:
        ambiguity_terms = rule.metadata.get("ambiguity_terms", [])
        if ambiguity_terms:
            findings.append(EngineFinding(
                finding_id=f"drift:{rule.rule_id}",
                kind="drift",
                severity="warning",
                source="ai",
                summary=f"{rule.title} contains ambiguous policy language",
                rationale=f"Ambiguous terms detected: {', '.join(ambiguity_terms)}.",
                confidence=0.7,
                affected_rule_ids=[rule.rule_id],
                recommendation="Clarify the policy language before promoting this candidate rule into a governed package.",
            ))

        for existing in active_rules:
            title_similarity = _similarity(rule.title, existing.title)
            summary_similarity = _similarity(rule.summary, existing.summary)
            if _condition_signature(rule) == _condition_signature(existing) and (title_similarity > 0.35 or summary_similarity > 0.35):
                findings.append(EngineFinding(
                    finding_id=f"duplicates:{rule.rule_id}:{existing.rule_id}",
                    kind="duplicates",
                    severity="warning" if summary_similarity > 0.55 else "info",
                    source="ai",
                    summary=f"{rule.title} is close to active rule {existing.title}",
                    rationale="The candidate rule overlaps strongly with an existing active rule on both conditions and semantic intent.",
                    confidence=0.74,
                    affected_rule_ids=[rule.rule_id, existing.rule_id],
                    recommendation="Review whether this is a true new control, a refinement, or a duplicate that should be merged.",
                ))
            opposite_language = (
                ("must not" in _normalise(rule.summary) and "must" in _normalise(existing.summary))
                or ("must" in _normalise(rule.summary) and "must not" in _normalise(existing.summary))
                or ("open market" in _normalise(rule.summary) and "arrangement" in _normalise(existing.summary))
                or ("arrangement" in _normalise(rule.summary) and "open market" in _normalise(existing.summary))
            )
            if opposite_language and _conditions_overlap(rule, existing):
                findings.append(EngineFinding(
                    finding_id=f"contradictions:{rule.rule_id}:{existing.rule_id}",
                    kind="contradictions",
                    severity="critical",
                    source="ai",
                    summary=f"{rule.title} may conflict with active rule {existing.title}",
                    rationale="The candidate rule overlaps with an active rule but appears to push the process in an opposing direction.",
                    confidence=0.72,
                    affected_rule_ids=[rule.rule_id, existing.rule_id],
                    recommendation="Model precedence or explicit exception handling before promoting this candidate.",
                ))
    return findings


def _strip_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


class RulesPolicyAssistant:
    def __init__(self):
        self.model_name = "claude-haiku-4-5-20251001"

    def assist(self, snapshot: RuleSetSnapshot, request: PolicyAssistRequest) -> PolicyAssistResponse:
        if request.use_ai and anthropic and os.environ.get("ANTHROPIC_API_KEY"):
            try:
                return self._assist_with_ai(snapshot, request)
            except Exception as exc:
                fallback = self._assist_heuristically(snapshot, request)
                fallback.warnings.append(f"AI extraction failed and fell back to heuristic mode: {type(exc).__name__}.")
                return fallback
        fallback = self._assist_heuristically(snapshot, request)
        if request.use_ai:
            fallback.warnings.append("AI provider is not configured, so the assistant used deterministic heuristic extraction.")
        return fallback

    def _assist_with_ai(self, snapshot: RuleSetSnapshot, request: PolicyAssistRequest) -> PolicyAssistResponse:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        response = client.messages.create(
            model=self.model_name,
            max_tokens=3000,
            system=[{"type": "text", "text": AI_POLICY_ASSIST_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{
                "role": "user",
                "content": (
                    f"Source name: {request.source_name}\n"
                    f"Source id: {request.source_id or 'policy_assist'}\n"
                    f"Signal taxonomy: {json.dumps(snapshot.taxonomy.get('signals', []), ensure_ascii=False)}\n"
                    f"Policy text:\n{request.policy_text}"
                ),
            }],
        )
        raw = _strip_fences(response.content[0].text)
        payload = json.loads(raw)
        rules: list[CanonicalRule] = []
        for index, item in enumerate(payload.get("rules", [])[:request.max_candidate_rules]):
            rules.append(CanonicalRule(
                rule_id=item.get("rule_id") or f"candidate:ai:{index + 1}",
                rule_type=item.get("rule_type") or "obligation",
                source_type="policy_candidate",
                source_id=request.source_id or "policy_assist",
                source_name=request.source_name,
                title=item.get("title") or f"Candidate rule {index + 1}",
                summary=item.get("summary") or "",
                active=True,
                priority=item.get("priority", 50),
                precedence=item.get("precedence", 50),
                tags=item.get("tags") or ["policy_assist", "candidate"],
                objectives=item.get("objectives") or ["compliance"],
                conditions=[CanonicalCondition(**condition) for condition in item.get("conditions", [])],
                effects=[CanonicalEffect(**effect) for effect in item.get("effects", [])],
                provenance=[RuleProvenance(
                    source_id=request.source_id or "policy_assist",
                    source_name=request.source_name,
                    citation=None,
                    anchor=f"candidate_rule_{index + 1}",
                    confidence=float(item.get("confidence", 0.78)),
                )],
                metadata={
                    "assistant_mode": "ai",
                    "ambiguity_terms": item.get("ambiguity_notes") or [],
                },
            ))
        scenarios = [
            AssistedScenario(
                case_id=item.get("case_id") or f"assist-scenario-{index + 1}",
                case_name=item.get("case_name"),
                rationale=item.get("rationale"),
                facts=item.get("facts") or _default_facts(),
            )
            for index, item in enumerate(payload.get("scenarios", [])[:4])
        ] or _build_scenarios(rules)
        findings = _build_findings(snapshot, rules)
        return PolicyAssistResponse(
            mode="ai",
            package_name=f"AI draft - {request.source_name}",
            summary=payload.get("summary") or "AI-assisted extraction completed.",
            source_excerpt=request.policy_text[:400] + ("..." if len(request.policy_text) > 400 else ""),
            proposed_changes=[
                ProposedRuleChange(operation="add", rule=rule, rationale="AI-assisted candidate extraction")
                for rule in rules
            ],
            suggested_scenarios=scenarios,
            findings=findings,
            warnings=payload.get("warnings") or [],
        )

    def _assist_heuristically(self, snapshot: RuleSetSnapshot, request: PolicyAssistRequest) -> PolicyAssistResponse:
        lines = _extract_candidate_lines(request.policy_text, request.max_candidate_rules)
        rules = [_build_rule(line, request, snapshot.taxonomy, index) for index, line in enumerate(lines)]
        scenarios = _build_scenarios(rules)
        findings = _build_findings(snapshot, rules)
        summary = (
            f"Extracted {len(rules)} candidate rule{'s' if len(rules) != 1 else ''} and "
            f"{len(scenarios)} suggested scenario{'s' if len(scenarios) != 1 else ''} from the supplied policy text."
        )
        warnings = []
        if not rules:
            warnings.append("No strong candidate rules were extracted. Try pasting clearer obligation text or using bullet points.")
        return PolicyAssistResponse(
            mode="heuristic",
            package_name=f"Policy draft - {request.source_name}",
            summary=summary,
            source_excerpt=request.policy_text[:400] + ("..." if len(request.policy_text) > 400 else ""),
            proposed_changes=[
                ProposedRuleChange(operation="add", rule=rule, rationale="Heuristic policy extraction")
                for rule in rules
            ],
            suggested_scenarios=scenarios,
            findings=findings,
            warnings=warnings,
        )
