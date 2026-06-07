from __future__ import annotations

from .domain import CanonicalCondition, MatchedRule, PlatformSimulationRequest, PlatformSimulationResult, RuleSetSnapshot


def _matches_condition(facts: dict, condition: CanonicalCondition) -> bool:
    actual = facts.get(condition.field)
    expected = condition.value
    if condition.operator == "eq":
        return actual == expected
    if condition.operator == "in":
        return actual in expected if isinstance(expected, list) else actual == expected
    if condition.operator == "contains_any":
        actual_values = actual if isinstance(actual, list) else ([] if actual is None else [actual])
        expected_values = expected if isinstance(expected, list) else [expected]
        return any(value in actual_values for value in expected_values)
    return False


class RulesSimulationService:
    def simulate(self, snapshot: RuleSetSnapshot, request: PlatformSimulationRequest) -> PlatformSimulationResult:
        candidate_rules = snapshot.rules if request.include_inactive else [rule for rule in snapshot.rules if rule.active]
        matched_rules: list[MatchedRule] = []
        obligations = []
        pre_checks = []
        workflow_steps = []
        approvals = []
        advisories = []
        warnings = []

        for rule in sorted(candidate_rules, key=lambda item: (item.precedence, item.priority, item.rule_id)):
            matched_conditions = []
            if rule.conditions:
                all_match = True
                for condition in rule.conditions:
                    if _matches_condition(request.facts, condition):
                        matched_conditions.append(condition.field)
                    else:
                        all_match = False
                        break
                if not all_match:
                    continue

            matched_rules.append(MatchedRule(
                rule_id=rule.rule_id,
                rule_type=rule.rule_type,
                title=rule.title,
                source_name=rule.source_name,
                conditions_matched=matched_conditions,
                effects=rule.effects,
            ))

            for effect in rule.effects:
                item = {
                    "rule_id": rule.rule_id,
                    "source_name": rule.source_name,
                    "title": effect.title,
                    "detail": effect.detail,
                    "metadata": effect.metadata,
                }
                if effect.effect_type == "obligation":
                    obligations.append(item)
                elif effect.effect_type == "pre_check":
                    pre_checks.append(item)
                elif effect.effect_type == "workflow_step":
                    workflow_steps.append(item)
                elif effect.effect_type == "approval":
                    approvals.append(item)
                else:
                    advisories.append(item)

            if any(provenance.confidence < 0.8 for provenance in rule.provenance):
                warnings.append(f"Rule {rule.rule_id} is supported by lower-confidence provenance.")

        return PlatformSimulationResult(
            case_id=request.case_id or "ad-hoc-case",
            case_name=request.case_name,
            matched_rules=matched_rules,
            obligations=obligations,
            pre_checks=pre_checks,
            workflow_steps=workflow_steps,
            approvals=approvals,
            advisories=advisories,
            warnings=warnings,
        )
