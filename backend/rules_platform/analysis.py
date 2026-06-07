from __future__ import annotations

from collections import Counter, defaultdict

from .domain import CanonicalRule, EngineFinding, RuleSetSnapshot


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
        if not set(left_values) & set(right_values):
            return False
    return True


class RulesAnalysisService:
    def analyze(self, snapshot: RuleSetSnapshot) -> dict:
        findings: list[EngineFinding] = []
        active_rules = [rule for rule in snapshot.rules if rule.active]
        trigger_fields = snapshot.taxonomy.get("signals", [])
        active_conditions = defaultdict(Counter)

        for rule in active_rules:
            for condition in rule.conditions:
                values = condition.value if isinstance(condition.value, list) else [condition.value]
                for value in values:
                    active_conditions[condition.field][str(value)] += 1

        for signal in trigger_fields:
            field = signal.get("field")
            values = [str(value) for value in signal.get("values", [])]
            counts = active_conditions.get(field, Counter())
            missing = [value for value in values if counts[value] == 0]
            sparse = [value for value in values if counts[value] == 1]
            if missing:
                findings.append(EngineFinding(
                    finding_id=f"gaps:{field}:missing",
                    kind="gaps",
                    severity="warning" if len(missing) > max(1, len(values) // 2) else "info",
                    source="heuristic",
                    summary=f"{field} has uncovered values in the active ruleset",
                    rationale=f"No active canonical rules currently reference: {', '.join(missing)}.",
                    confidence=0.98,
                    affected_rule_ids=[],
                    recommendation=f"Review whether {field} needs broader policy coverage or explicit exclusion.",
                ))
            if sparse:
                findings.append(EngineFinding(
                    finding_id=f"gaps:{field}:sparse",
                    kind="gaps",
                    severity="info",
                    source="heuristic",
                    summary=f"{field} has sparse rule coverage",
                    rationale=f"The following values only appear once across active rules: {', '.join(sparse)}.",
                    confidence=0.9,
                    affected_rule_ids=[],
                    recommendation=f"Check whether sparse {field} values should be normalized, merged, or expanded.",
                ))

        active_sorted = list(active_rules)
        for index, left in enumerate(active_sorted):
            for right in active_sorted[index + 1:]:
                if left.rule_type != right.rule_type:
                    continue
                title_similarity = _similarity(left.title, right.title)
                summary_similarity = _similarity(left.summary, right.summary)
                same_signature = _condition_signature(left) == _condition_signature(right)
                if same_signature and (title_similarity > 0.5 or summary_similarity > 0.45):
                    findings.append(EngineFinding(
                        finding_id=f"duplicates:{left.rule_id}:{right.rule_id}",
                        kind="duplicates",
                        severity="warning" if title_similarity > 0.8 else "info",
                        source="heuristic",
                        summary=f"{left.title} may duplicate {right.title}",
                        rationale="These rules share the same condition footprint and similar semantic intent.",
                        confidence=0.84,
                        affected_rule_ids=[left.rule_id, right.rule_id],
                        recommendation="Review whether these rules should be merged, narrowed, or turned into explicit variants.",
                    ))

                opposite_language = (
                    ("must not" in _normalise(left.summary) and "must" in _normalise(right.summary))
                    or ("must" in _normalise(left.summary) and "must not" in _normalise(right.summary))
                    or ("open market" in _normalise(left.summary) and "arrangement" in _normalise(right.summary))
                    or ("arrangement" in _normalise(left.summary) and "open market" in _normalise(right.summary))
                )
                if opposite_language and _conditions_overlap(left, right):
                    findings.append(EngineFinding(
                        finding_id=f"contradictions:{left.rule_id}:{right.rule_id}",
                        kind="contradictions",
                        severity="critical",
                        source="heuristic",
                        summary=f"{left.title} may conflict with {right.title}",
                        rationale="These rules overlap on conditions but push decisioning or workflow in different directions.",
                        confidence=0.78,
                        affected_rule_ids=[left.rule_id, right.rule_id],
                        recommendation="Model precedence, narrow scope, or formalize the exception relationship.",
                    ))

        workflow_counts = Counter(rule.source_name for rule in active_rules if rule.rule_type in {"workflow", "approval"})
        for source_name, count in workflow_counts.most_common():
            findings.append(EngineFinding(
                finding_id=f"workflow:{source_name}",
                kind="workflow",
                severity="warning" if count >= 3 else "info",
                source="heuristic",
                summary=f"{source_name} materially changes the operating workflow",
                rationale=f"This source contributes {count} active workflow or approval modifiers.",
                confidence=1.0,
                affected_rule_ids=[rule.rule_id for rule in active_rules if rule.source_name == source_name and rule.rule_type in {"workflow", "approval"}],
                recommendation="Use simulation to test whether this governance load is proportionate to risk and value.",
            ))

        return {
            "snapshot_id": snapshot.snapshot_id,
            "summary": {
                "rule_count": len(snapshot.rules),
                "active_rule_count": len(active_rules),
                "finding_count": len(findings),
            },
            "findings": [finding.model_dump(mode="json") for finding in findings],
        }
