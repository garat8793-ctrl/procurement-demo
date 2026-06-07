from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


RuleType = Literal[
    "obligation",
    "pre_check",
    "workflow",
    "approval",
    "advisory",
]

EffectType = Literal[
    "obligation",
    "pre_check",
    "workflow_step",
    "approval",
    "advisory",
]

ConditionOperator = Literal["eq", "in", "contains_any"]


class PolicyObjective(BaseModel):
    objective_id: str
    label: str
    description: str


class RuleProvenance(BaseModel):
    source_id: str
    source_name: str
    citation: Optional[str] = None
    anchor: Optional[str] = None
    confidence: float = 1.0


class CanonicalCondition(BaseModel):
    field: str
    operator: ConditionOperator
    value: Any


class CanonicalEffect(BaseModel):
    effect_type: EffectType
    title: str
    detail: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanonicalRule(BaseModel):
    rule_id: str
    rule_type: RuleType
    source_type: Literal["core", "scheme", "policy_candidate"]
    source_id: str
    source_name: str
    title: str
    summary: str
    active: bool = True
    priority: int = 50
    precedence: int = 50
    tags: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)
    conditions: list[CanonicalCondition] = Field(default_factory=list)
    effects: list[CanonicalEffect] = Field(default_factory=list)
    provenance: list[RuleProvenance] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RuleSetSnapshot(BaseModel):
    snapshot_id: str
    generated_at: datetime
    taxonomy: dict[str, Any]
    rules: list[CanonicalRule]
    sources: list[dict[str, Any]]


class EngineFinding(BaseModel):
    finding_id: str
    kind: Literal["gaps", "duplicates", "contradictions", "workflow", "drift"]
    severity: Literal["info", "warning", "critical"]
    source: Literal["heuristic", "ai"] = "heuristic"
    summary: str
    rationale: str
    confidence: float
    affected_rule_ids: list[str] = Field(default_factory=list)
    recommendation: Optional[str] = None


class GraphNode(BaseModel):
    node_id: str
    node_type: str
    label: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    edge_id: str
    source: str
    target: str
    relation: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class PlatformSimulationRequest(BaseModel):
    case_id: Optional[str] = None
    case_name: Optional[str] = None
    facts: dict[str, Any] = Field(default_factory=dict)
    include_inactive: bool = False


class MatchedRule(BaseModel):
    rule_id: str
    rule_type: str
    title: str
    source_name: str
    conditions_matched: list[str] = Field(default_factory=list)
    effects: list[CanonicalEffect] = Field(default_factory=list)


class PlatformSimulationResult(BaseModel):
    case_id: str
    case_name: Optional[str] = None
    matched_rules: list[MatchedRule] = Field(default_factory=list)
    obligations: list[dict[str, Any]] = Field(default_factory=list)
    pre_checks: list[dict[str, Any]] = Field(default_factory=list)
    workflow_steps: list[dict[str, Any]] = Field(default_factory=list)
    approvals: list[dict[str, Any]] = Field(default_factory=list)
    advisories: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProposedRuleChange(BaseModel):
    operation: Literal["add", "replace", "deactivate"]
    target_rule_id: Optional[str] = None
    rule: Optional[CanonicalRule] = None
    rationale: Optional[str] = None


class PolicyAssistRequest(BaseModel):
    source_name: str = "Working policy note"
    source_id: Optional[str] = None
    policy_text: str
    use_ai: bool = True
    max_candidate_rules: int = 6


class AssistedScenario(BaseModel):
    case_id: str
    case_name: Optional[str] = None
    facts: dict[str, Any] = Field(default_factory=dict)
    rationale: Optional[str] = None


class PolicyAssistResponse(BaseModel):
    mode: Literal["ai", "heuristic"]
    package_name: str
    summary: str
    source_excerpt: str
    proposed_changes: list[ProposedRuleChange] = Field(default_factory=list)
    suggested_scenarios: list[AssistedScenario] = Field(default_factory=list)
    findings: list[EngineFinding] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PlatformSimulationCompareRequest(BaseModel):
    scenarios: list[PlatformSimulationRequest] = Field(default_factory=list)
    proposed_changes: list[ProposedRuleChange] = Field(default_factory=list)
    include_inactive_baseline: bool = False


class ScenarioDelta(BaseModel):
    case_id: str
    case_name: Optional[str] = None
    matched_rule_count_before: int
    matched_rule_count_after: int
    added_rule_ids: list[str] = Field(default_factory=list)
    removed_rule_ids: list[str] = Field(default_factory=list)
    counts_before: dict[str, int] = Field(default_factory=dict)
    counts_after: dict[str, int] = Field(default_factory=dict)
    delta_counts: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class PlatformSimulationCompareResult(BaseModel):
    baseline_snapshot_id: str
    proposed_snapshot_id: str
    applied_changes: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    scenario_deltas: list[ScenarioDelta] = Field(default_factory=list)
    aggregate_delta: dict[str, int] = Field(default_factory=dict)
