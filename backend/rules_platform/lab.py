from __future__ import annotations

import json
from hashlib import sha1

from .domain import (
    CanonicalRule,
    PlatformSimulationCompareRequest,
    PlatformSimulationCompareResult,
    PlatformSimulationRequest,
    ProposedRuleChange,
    RuleSetSnapshot,
    ScenarioDelta,
)
from .simulation import RulesSimulationService


def _effect_counts(result) -> dict[str, int]:
    return {
        "obligations": len(result.obligations),
        "pre_checks": len(result.pre_checks),
        "workflow_steps": len(result.workflow_steps),
        "approvals": len(result.approvals),
        "advisories": len(result.advisories),
    }


class RulesSimulationLab:
    def __init__(self, simulation_service: RulesSimulationService | None = None):
        self.simulation_service = simulation_service or RulesSimulationService()

    def apply_changes(self, snapshot: RuleSetSnapshot, changes: list[ProposedRuleChange]) -> tuple[RuleSetSnapshot, list[dict], list[str]]:
        rules_by_id: dict[str, CanonicalRule] = {rule.rule_id: rule.model_copy(deep=True) for rule in snapshot.rules}
        applied_changes: list[dict] = []
        warnings: list[str] = []

        for index, change in enumerate(changes):
            if change.operation == "add":
                if not change.rule:
                    warnings.append(f"Change {index + 1} is an add operation without a canonical rule payload.")
                    continue
                rules_by_id[change.rule.rule_id] = change.rule.model_copy(deep=True)
                applied_changes.append({
                    "operation": "add",
                    "target_rule_id": change.rule.rule_id,
                    "rationale": change.rationale,
                })
                continue

            if not change.target_rule_id:
                warnings.append(f"Change {index + 1} requires target_rule_id for {change.operation}.")
                continue

            if change.target_rule_id not in rules_by_id:
                warnings.append(f"Target rule {change.target_rule_id} was not found in the baseline snapshot.")
                continue

            if change.operation == "deactivate":
                rules_by_id[change.target_rule_id] = rules_by_id[change.target_rule_id].model_copy(update={"active": False})
                applied_changes.append({
                    "operation": "deactivate",
                    "target_rule_id": change.target_rule_id,
                    "rationale": change.rationale,
                })
            elif change.operation == "replace":
                if not change.rule:
                    warnings.append(f"Change {index + 1} is a replace operation without a canonical rule payload.")
                    continue
                replacement = change.rule.model_copy(deep=True)
                if replacement.rule_id != change.target_rule_id:
                    replacement = replacement.model_copy(update={"rule_id": change.target_rule_id})
                rules_by_id[change.target_rule_id] = replacement
                applied_changes.append({
                    "operation": "replace",
                    "target_rule_id": change.target_rule_id,
                    "rationale": change.rationale,
                })

        proposed_rules = sorted(rules_by_id.values(), key=lambda rule: rule.rule_id)
        fingerprint = sha1(
            json.dumps([rule.model_dump(mode="json") for rule in proposed_rules], sort_keys=True).encode("utf-8")
        ).hexdigest()[:12]
        proposed_snapshot = snapshot.model_copy(
            update={
                "snapshot_id": f"proposal-{fingerprint}",
                "rules": proposed_rules,
            },
            deep=True,
        )
        return proposed_snapshot, applied_changes, warnings

    def compare(self, snapshot: RuleSetSnapshot, request: PlatformSimulationCompareRequest) -> PlatformSimulationCompareResult:
        proposed_snapshot, applied_changes, warnings = self.apply_changes(snapshot, request.proposed_changes)
        scenarios = request.scenarios or [
            PlatformSimulationRequest(
                case_id="default-simulation-case",
                case_name="Default simulation case",
                facts={},
                include_inactive=request.include_inactive_baseline,
            )
        ]

        scenario_deltas: list[ScenarioDelta] = []
        aggregate_delta = {
            "obligations": 0,
            "pre_checks": 0,
            "workflow_steps": 0,
            "approvals": 0,
            "advisories": 0,
            "matched_rules": 0,
        }

        for scenario in scenarios:
            baseline_request = scenario.model_copy(update={"include_inactive": request.include_inactive_baseline})
            proposed_request = scenario.model_copy(update={"include_inactive": False})

            before = self.simulation_service.simulate(snapshot, baseline_request)
            after = self.simulation_service.simulate(proposed_snapshot, proposed_request)

            before_counts = _effect_counts(before)
            after_counts = _effect_counts(after)
            delta_counts = {
                key: after_counts[key] - before_counts[key]
                for key in before_counts
            }
            delta_counts["matched_rules"] = len(after.matched_rules) - len(before.matched_rules)

            for key, value in delta_counts.items():
                aggregate_delta[key] = aggregate_delta.get(key, 0) + value

            before_rule_ids = {rule.rule_id for rule in before.matched_rules}
            after_rule_ids = {rule.rule_id for rule in after.matched_rules}
            scenario_deltas.append(ScenarioDelta(
                case_id=before.case_id,
                case_name=before.case_name,
                matched_rule_count_before=len(before.matched_rules),
                matched_rule_count_after=len(after.matched_rules),
                added_rule_ids=sorted(after_rule_ids - before_rule_ids),
                removed_rule_ids=sorted(before_rule_ids - after_rule_ids),
                counts_before=before_counts,
                counts_after=after_counts,
                delta_counts=delta_counts,
                warnings=before.warnings + after.warnings,
            ))

        return PlatformSimulationCompareResult(
            baseline_snapshot_id=snapshot.snapshot_id,
            proposed_snapshot_id=proposed_snapshot.snapshot_id,
            applied_changes=applied_changes,
            warnings=warnings,
            scenario_deltas=scenario_deltas,
            aggregate_delta=aggregate_delta,
        )
