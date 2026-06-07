from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache
from hashlib import sha1
from pathlib import Path

from .domain import (
    CanonicalCondition,
    CanonicalEffect,
    CanonicalRule,
    PolicyObjective,
    RuleProvenance,
    RuleSetSnapshot,
)


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SCHEMES_DIR = Path(__file__).resolve().parent.parent / "schemes"


def _normalise_trigger_conditions(trigger: dict | None) -> list[CanonicalCondition]:
    if not trigger:
        return []
    conditions: list[CanonicalCondition] = []
    for field, raw_value in trigger.items():
        if raw_value is None:
            continue
        if isinstance(raw_value, list):
            operator = "contains_any" if field == "overlays" else "in"
            conditions.append(CanonicalCondition(field=field, operator=operator, value=raw_value))
        else:
            conditions.append(CanonicalCondition(field=field, operator="eq", value=raw_value))
    return conditions


def _load_core_rules() -> list[dict]:
    with open(DATA_DIR / "obligations.json", encoding="utf-8") as handle:
        return json.load(handle)


def _load_scheme_rules() -> list[dict]:
    schemes: list[dict] = []
    for path in sorted(SCHEMES_DIR.glob("*.json")):
        try:
            scheme = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if scheme.get("audience") == "supplier":
            continue
        schemes.append(scheme)
    return schemes


class RulesPlatformRegistry:
    """Builds canonical rules snapshots from current policy assets."""

    def __init__(self, taxonomy_path: Path | None = None):
        self.taxonomy_path = taxonomy_path or (DATA_DIR / "rules_platform_taxonomy.json")

    def load_taxonomy(self) -> dict:
        if self.taxonomy_path.exists():
            return json.loads(self.taxonomy_path.read_text(encoding="utf-8"))
        return {
            "objectives": [],
            "signals": [],
            "rule_types": [],
        }

    def load_snapshot(self) -> RuleSetSnapshot:
        taxonomy = self.load_taxonomy()
        rules: list[CanonicalRule] = []
        sources: list[dict] = []

        core_rules = _load_core_rules()
        sources.append({
            "source_id": "core_obligations",
            "source_name": "Core obligations",
            "source_type": "core",
            "rule_count": len(core_rules),
        })
        for rule in core_rules:
            if rule.get("audience") == "supplier":
                continue
            rules.append(CanonicalRule(
                rule_id=f"core:{rule['id']}",
                rule_type="obligation",
                source_type="core",
                source_id="core_obligations",
                source_name="Core obligations",
                title=rule["title"],
                summary=rule["body"],
                active=rule.get("active", True),
                priority=rule.get("priority", 50),
                precedence=10,
                tags=["baseline", "deterministic"],
                objectives=["compliance", "consistency"],
                conditions=_normalise_trigger_conditions(rule.get("trigger")),
                effects=[CanonicalEffect(
                    effect_type="obligation",
                    title=rule["title"],
                    detail=rule["body"],
                    metadata={"policy": rule.get("policy", "")},
                )],
                provenance=[RuleProvenance(
                    source_id="core_obligations",
                    source_name="Core obligations",
                    citation=rule.get("policy"),
                    anchor=rule.get("id"),
                    confidence=1.0,
                )],
                metadata={"legacy_id": rule["id"]},
            ))

        schemes = _load_scheme_rules()
        for scheme in schemes:
            if scheme.get("audience") == "supplier":
                continue
            sources.append({
                "source_id": scheme["scheme_id"],
                "source_name": scheme["name"],
                "source_type": "scheme",
                "rule_count": (
                    len(scheme.get("obligations", []))
                    + len(scheme.get("pre_checks", []))
                    + len(scheme.get("step_injections", []))
                    + len(scheme.get("approval_additions", []))
                ),
            })
            conditions = _normalise_trigger_conditions(scheme.get("triggers"))
            provenance = [RuleProvenance(
                source_id=scheme["scheme_id"],
                source_name=scheme["name"],
                citation=scheme.get("source"),
                anchor=scheme.get("scheme_id"),
                confidence=1.0,
            )]

            for obligation in scheme.get("obligations", []):
                if obligation.get("audience") == "supplier":
                    continue
                rules.append(CanonicalRule(
                    rule_id=f"scheme:{scheme['scheme_id']}:obligation:{obligation['id']}",
                    rule_type="obligation",
                    source_type="scheme",
                    source_id=scheme["scheme_id"],
                    source_name=scheme["name"],
                    title=obligation["title"],
                    summary=obligation["body"],
                    active=scheme.get("active", False) and obligation.get("active", True),
                    priority=30,
                    precedence=20,
                    tags=["scheme", "workflow_governance"],
                    objectives=["compliance", "value_for_money"],
                    conditions=conditions,
                    effects=[CanonicalEffect(
                        effect_type="obligation",
                        title=obligation["title"],
                        detail=obligation["body"],
                        metadata={"policy": obligation.get("policy", ""), "citation": obligation.get("citation")},
                    )],
                    provenance=provenance,
                    metadata={"legacy_id": obligation["id"], "scheme_version": scheme.get("version")},
                ))

            for pre_check in scheme.get("pre_checks", []):
                if pre_check.get("audience") == "supplier":
                    continue
                rules.append(CanonicalRule(
                    rule_id=f"scheme:{scheme['scheme_id']}:pre_check:{pre_check['id']}",
                    rule_type="pre_check",
                    source_type="scheme",
                    source_id=scheme["scheme_id"],
                    source_name=scheme["name"],
                    title=pre_check["title"],
                    summary=pre_check["body"],
                    active=scheme.get("active", False) and pre_check.get("active", True),
                    priority=20,
                    precedence=20,
                    tags=["scheme", "early_gate"],
                    objectives=["readiness", "risk_reduction"],
                    conditions=conditions,
                    effects=[CanonicalEffect(
                        effect_type="pre_check",
                        title=pre_check["title"],
                        detail=pre_check["body"],
                        metadata={"link": pre_check.get("link"), "citation": pre_check.get("citation")},
                    )],
                    provenance=provenance,
                    metadata={"legacy_id": pre_check["id"], "scheme_version": scheme.get("version")},
                ))

            for index, injection in enumerate(scheme.get("step_injections", [])):
                steps = injection.get("steps", [])
                rules.append(CanonicalRule(
                    rule_id=f"scheme:{scheme['scheme_id']}:workflow:{index}",
                    rule_type="workflow",
                    source_type="scheme",
                    source_id=scheme["scheme_id"],
                    source_name=scheme["name"],
                    title=f"Workflow modification after step {injection.get('after_step', 0)}",
                    summary=f"{len(steps)} process step(s) are injected by this scheme.",
                    active=scheme.get("active", False),
                    priority=40,
                    precedence=30,
                    tags=["scheme", "workflow"],
                    objectives=["process_control", "assurance"],
                    conditions=conditions,
                    effects=[
                        CanonicalEffect(
                            effect_type="workflow_step",
                            title=f"Injected step {step_index + 1}",
                            detail=raw_step["text"] if isinstance(raw_step, dict) else raw_step,
                            metadata={
                                "after_step": injection.get("after_step", 0),
                                "citation": raw_step.get("citation") if isinstance(raw_step, dict) else None,
                            },
                        )
                        for step_index, raw_step in enumerate(steps)
                    ],
                    provenance=provenance,
                    metadata={"scheme_version": scheme.get("version")},
                ))

            for index, approval in enumerate(scheme.get("approval_additions", [])):
                rules.append(CanonicalRule(
                    rule_id=f"scheme:{scheme['scheme_id']}:approval:{index}",
                    rule_type="approval",
                    source_type="scheme",
                    source_id=scheme["scheme_id"],
                    source_name=scheme["name"],
                    title=approval["role"],
                    summary=approval.get("note", "Additional approval requirement"),
                    active=scheme.get("active", False),
                    priority=40,
                    precedence=30,
                    tags=["scheme", "approval"],
                    objectives=["assurance", "accountability"],
                    conditions=conditions,
                    effects=[CanonicalEffect(
                        effect_type="approval",
                        title=approval["role"],
                        detail=approval.get("note", "Additional approval requirement"),
                        metadata={},
                    )],
                    provenance=provenance,
                    metadata={"scheme_version": scheme.get("version")},
                ))

        fingerprint = sha1(
            json.dumps([rule.model_dump(mode="json") for rule in rules], sort_keys=True).encode("utf-8")
        ).hexdigest()[:12]
        return RuleSetSnapshot(
            snapshot_id=f"snapshot-{fingerprint}",
            generated_at=datetime.now(timezone.utc),
            taxonomy=taxonomy,
            rules=rules,
            sources=sources,
        )

    def load_objectives(self) -> list[PolicyObjective]:
        taxonomy = self.load_taxonomy()
        return [PolicyObjective(**item) for item in taxonomy.get("objectives", [])]


@lru_cache(maxsize=1)
def get_rules_platform_registry() -> RulesPlatformRegistry:
    return RulesPlatformRegistry()
