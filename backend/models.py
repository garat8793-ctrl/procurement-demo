from pydantic import BaseModel
from typing import Optional, Any


class AnswerIn(BaseModel):
    question_id: str
    option_ids: list[str]


class AgencyContext(BaseModel):
    agency_id: str
    agency_name: str
    cluster: str
    agency_type: str


class EvaluateRequest(BaseModel):
    answers: list[AnswerIn]
    agency: Optional[AgencyContext] = None


class ProcurementProfile(BaseModel):
    # Agency context (set before the questionnaire)
    agency_id: Optional[str] = None        # e.g. "nsw_transport"
    agency_name: Optional[str] = None      # e.g. "Transport for NSW"
    cluster: Optional[str] = None          # e.g. "Transport"
    agency_type: Optional[str] = None      # e.g. "department", "regulator"
    # Core procurement profile tags
    category: Optional[str] = None
    purpose: Optional[str] = None
    definition: Optional[str] = None
    value: Optional[str] = None
    org: Optional[str] = None
    market: Optional[str] = None
    impact: Optional[str] = None
    overlays: list[str] = []               # includes "sme" if applicable
    interaction: Optional[str] = None
    timing: Optional[str] = None
    not_sure_count: int = 0
    low_confidence: bool = False
    # Extended fields for AI-enabled MVP
    ai_component: Optional[bool] = None
    data_sensitivity: Optional[str] = None      # "public"|"internal"|"sensitive"|"protected"
    technology_component: Optional[bool] = None
    market_maturity: Optional[str] = None        # "emerging"|"developing"|"mature"|"commodity"
    outcome_type: Optional[str] = None           # "output"|"outcome"|"hybrid"
    delivery_criticality: Optional[str] = None   # "deferrable"|"important"|"critical"|"non_negotiable"


class PreCheck(BaseModel):
    id: str
    title: str
    body: str
    link: Optional[str] = None
    source: str = "core"
    citation: Optional[str] = None


class Obligation(BaseModel):
    id: str
    title: str
    body: str
    policy: str
    source: str = "core"
    citation: Optional[str] = None


class ProcessStep(BaseModel):
    text: str
    citations: list[str] = []
    source_name: Optional[str] = None


class StepInjection(BaseModel):
    after_step: int
    steps: list[ProcessStep]
    source: str = "core"
    source_name: Optional[str] = None


class MatchedScheme(BaseModel):
    scheme_id: str
    name: str


class RuleTrace(BaseModel):
    rule_id: str
    description: str
    matched: bool
    fields_checked: list[str]
    field_values: dict
    policy_citation: Optional[str] = None
    stop_reason: Optional[str] = None


class PathwayResult(BaseModel):
    pathway_id: str
    name: str
    label: str
    description: str
    colour: str
    rationale: list[str]
    pre_checks: list[PreCheck]
    steps: list[ProcessStep]
    exception: bool
    requires_justification: bool
    low_confidence: bool
    rule_trace: list[RuleTrace] = []


class ObligationResult(BaseModel):
    obligations: list[Obligation]
    pre_checks: list[PreCheck]
    matched_schemes: list[MatchedScheme]
    step_injections: list[StepInjection] = []


class ApprovalAddition(BaseModel):
    role: str
    note: str
    source: Optional[str] = None
    source_name: Optional[str] = None


class ApprovalStep(BaseModel):
    id: str
    kind: str
    title: str
    note: Optional[str] = None
    is_final: bool = False
    source: Optional[str] = None
    source_name: Optional[str] = None


class ApprovalResult(BaseModel):
    base_tier: str
    approver_role: str
    delegate_level: int
    reviews_required: list[str]
    pathway_note: Optional[str] = None
    requires_justification: bool
    additions: list[ApprovalAddition]
    approval_steps: list[ApprovalStep] = []


class BriefingSection(BaseModel):
    id: str
    heading: str
    data: dict


class BriefingStructure(BaseModel):
    sections: list[BriefingSection]


class EvaluateResponse(BaseModel):
    decision_id: str = ""
    profile: ProcurementProfile
    pathway: PathwayResult
    obligations: ObligationResult
    approvals: ApprovalResult
    briefing_structure: BriefingStructure


class BriefingGenerateRequest(BaseModel):
    briefing_structure: BriefingStructure
    profile: ProcurementProfile
    pathway: PathwayResult


class BriefingGenerateResponse(BaseModel):
    sections: dict[str, str]


class BriefingExportRequest(BaseModel):
    briefing_structure: BriefingStructure
    profile: ProcurementProfile
    pathway: PathwayResult
    approvals: ApprovalResult
    sections: dict[str, str]


class ExplainRequest(BaseModel):
    profile: ProcurementProfile
    pathway: PathwayResult


class ExplainResponse(BaseModel):
    explanation: str


class SchemeInfo(BaseModel):
    scheme_id: str
    name: str
    active: bool
    description: str
    source: str


class ObligationToggleRequest(BaseModel):
    source: str   # "core" or a scheme_id
    obl_id: str


# ---------------------------------------------------------------------------
# Rule Schema — valid trigger key values (source of truth for validation + UI)
# ---------------------------------------------------------------------------

TRIGGER_OPTIONS: dict[str, list[str]] = {
    "category":    ["ict_saas", "ict_hardware", "professional_services", "consulting", "goods", "construction", "labour_hire", "other"],
    "value":       ["micro", "low", "medium", "high", "major"],
    "purpose":     ["new", "renewal", "emergency", "pilot", "replacement"],
    "definition":  ["clear", "mostly_clear", "partial", "exploratory"],
    "market":      ["sole", "limited", "some", "broad", "unknown"],
    "impact":      ["low", "medium", "high", "critical"],
    "overlays":    ["ai", "privacy", "critical_ict", "construction", "overseas", "sme", "aboriginal", "covered_epp", "modern_slavery"],
    "interaction": ["minimal", "quotes", "tender", "collaborative"],
    "timing":      ["urgent", "compressed", "normal", "extended", "unknown"],
    "org":         ["operational", "corporate", "executive", "central"],
}


class TriggerDict(BaseModel):
    """Trigger conditions for a core obligation rule."""
    category:           Optional[list[str]] = None
    value:              Optional[list[str]] = None
    purpose:            Optional[list[str]] = None
    definition:         Optional[list[str]] = None
    market:             Optional[list[str]] = None
    impact:             Optional[list[str]] = None
    overlays:           Optional[list[str]] = None
    interaction:        Optional[list[str]] = None
    timing:             Optional[list[str]] = None
    org:                Optional[list[str]] = None
    agency:             Optional[list[str]] = None
    cluster:            Optional[list[str]] = None
    agency_type:        Optional[list[str]] = None
    ai_component:       Optional[bool] = None
    data_sensitivity:   Optional[list[str]] = None
    market_maturity:    Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Rule creation request models
# ---------------------------------------------------------------------------

class CreateObligationRequest(BaseModel):
    """Add a new obligation to a scheme or to core (obligations.json)."""
    title:  str
    body:   str
    policy: str
    trigger: Optional[TriggerDict] = None   # core only; ignored for scheme obligations
    active: bool = True


class CreatePreCheckRequest(BaseModel):
    """Add a new pre-check to a scheme."""
    title:  str
    body:   str
    link:   Optional[str] = None
    active: bool = True


class CreateStepInjectionRequest(BaseModel):
    """Inject one or more steps into the process flow at a given position."""
    after_step: int          # 0 = before the first step
    steps:      list[str]    # one entry per step to inject


class CreateApprovalAdditionRequest(BaseModel):
    """Add a mandatory additional sign-off role to a scheme."""
    role: str
    note: str


# ---------------------------------------------------------------------------
# Conversational intake models
# ---------------------------------------------------------------------------

class IntakeExtractRequest(BaseModel):
    description: str


class FollowUpOption(BaseModel):
    value: str
    label: str


class FollowUpQuestion(BaseModel):
    field: str
    question: str
    rationale: str
    options: list[FollowUpOption]
    multi: bool = False


class IntakeExtractResponse(BaseModel):
    extracted_profile: dict
    confident_fields: list[str]
    uncertain_fields: list[str]
    interpretation: str
    follow_up_questions: list[FollowUpQuestion]


class DirectEvaluateRequest(BaseModel):
    """Evaluate a pre-built profile directly, bypassing the answer/tag pipeline."""
    profile: ProcurementProfile
    agency: Optional[AgencyContext] = None


# ---------------------------------------------------------------------------
# Audit / Decision records (architecture §7)
# ---------------------------------------------------------------------------

class DecisionRecord(BaseModel):
    decision_id: str
    timestamp: str
    profile: ProcurementProfile
    pathway_id: str
    pathway_label: str
    basis: list[RuleTrace]
    obligation_ids: list[str]
    scheme_ids: list[str]
    human_override: bool = False
    override_decision_id: Optional[str] = None


class AgentActionRecord(BaseModel):
    agent_action_id: str
    agent: str
    input_reference: str
    output_type: str
    confidence: Optional[float] = None
    review_required: bool = True
    timestamp: str


class ExceptionRecord(BaseModel):
    exception_id: str
    decision_id: str
    timestamp: str
    submitted_by: str
    rationale: str
    requested_pathway: str
    status: str = "pending"
    reviewed_by: Optional[str] = None
    review_timestamp: Optional[str] = None
    review_notes: Optional[str] = None


class SubmitExceptionRequest(BaseModel):
    decision_id: str
    rationale: str
    requested_pathway: str
    submitted_by: str


# ---------------------------------------------------------------------------
# Market intelligence + sourcing (architecture §8)
# ---------------------------------------------------------------------------

class MarketAssessment(BaseModel):
    assessment_id: str
    procurement_id: str
    timestamp: str
    supplier_count: int
    market_depth: str                   # "thin" | "moderate" | "deep"
    competition_risk: str               # "low" | "medium" | "high"
    supplier_clusters: list[dict]
    sme_opportunity: bool
    aboriginal_business_present: bool
    incumbent_identified: bool
    incumbents: list[str]
    signals: list[str]


class SourcingStrategyOption(BaseModel):
    label: str
    pathway: str
    pros: list[str]
    cons: list[str]
    timeline_estimate: str
    risk_level: str                     # "low" | "medium" | "high"


class SourcingStrategy(BaseModel):
    strategy_id: str
    procurement_id: str
    timestamp: str
    options: list[SourcingStrategyOption]
    recommended_option: str
    rationale: str
    human_selected_option: Optional[str] = None
    human_selection_timestamp: Optional[str] = None


class Supplier(BaseModel):
    supplier_id: str
    name: str
    classifications: list[str]
    capabilities: list[str]
    panel_memberships: list[str]
    state: Optional[str] = None
    performance_rating: Optional[float] = None


class EvaluationCriterion(BaseModel):
    criterion_id: str
    label: str
    weighting: float
    scoring_guidance: str
    is_mandatory: bool = False


class SupplierEvaluation(BaseModel):
    evaluation_id: str
    procurement_id: str
    supplier_id: str
    supplier_name: str
    scores: dict[str, Any]
    total_weighted_score: float
    mandatory_pass: bool
    agent_summary: str
    review_required: bool = True
    timestamp: str


# ---------------------------------------------------------------------------
# Lifecycle state
# ---------------------------------------------------------------------------

LIFECYCLE_STAGES = [
    "intake",
    "profile_built",
    "details_collected",        # NEW — procurement details form completed
    "pathway_set",
    "strategy_agreed",
    "docs_drafted",
    "approvals_pending",
    "market_active",
    "responses_received",
    "evaluation_complete",
    "award_recommended",
]


class ProcurementState(BaseModel):
    procurement_id: str
    lifecycle_stage: str
    decision_id: Optional[str] = None
    strategy_id: Optional[str] = None
    assessment_id: Optional[str] = None
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Request/response models for new agents
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Procurement Details — specifics captured after assessment, before sourcing
# ---------------------------------------------------------------------------

class ProcurementDetails(BaseModel):
    procurement_id: str

    # Always collected
    title: str
    deliverables_description: str
    key_requirements: list[str] = []          # up to 8 items
    indicative_budget: Optional[str] = None
    pricing_model: Optional[str] = None       # fixed_price|time_and_materials|outcome_based|subscription|tbd
    contract_duration: Optional[str] = None   # 1_year|2_years|3_years|4_years|5_years_plus|tbd
    target_market_release: Optional[str] = None
    incumbent_supplier: Optional[str] = None

    # ICT-conditional (category in ict_saas|ict_infrastructure|ict_development or technology_component=True)
    hosting_requirements: Optional[str] = None   # australian_cloud_only|on_premise|hybrid|no_restriction
    integration_requirements: Optional[str] = None

    # AI-conditional (ai_component=True)
    ai_use_case: Optional[str] = None
    human_oversight_level: Optional[str] = None  # full_review|human_in_loop|automated_with_audit

    # Data-conditional (data_sensitivity not set, or is sensitive|protected)
    data_types: list[str] = []  # personal_information|health_records|financial_data|government_classified|children_data

    # Outcome-conditional (outcome_type not set or != "output")
    success_metrics: Optional[str] = None

    saved_at: Optional[str] = None


class SaveProcurementDetailsRequest(BaseModel):
    details: ProcurementDetails


class MarketAssessRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    agency: Optional[AgencyContext] = None
    details: Optional[ProcurementDetails] = None


class StrategyGenerateRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    pathway: PathwayResult
    market_assessment: Optional[MarketAssessment] = None
    details: Optional[ProcurementDetails] = None


class StrategySelectRequest(BaseModel):
    selected_option: str


class DraftRFxRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    strategy: Optional[SourcingStrategy] = None
    obligations: Optional[ObligationResult] = None
    details: Optional[ProcurementDetails] = None


class DraftEvalPlanRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    strategy: Optional[SourcingStrategy] = None
    details: Optional[ProcurementDetails] = None


class DraftApprovalSummaryRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    pathway: PathwayResult
    obligations: ObligationResult
    approvals: ApprovalResult
    details: Optional[ProcurementDetails] = None


class EvaluationAssessRequest(BaseModel):
    procurement_id: str
    supplier_id: str
    supplier_name: str
    submission_text: str
    criteria: list[EvaluationCriterion]
    profile: ProcurementProfile


class NegotiationBriefRequest(BaseModel):
    procurement_id: str
    profile: ProcurementProfile
    preferred_supplier_id: str
    preferred_supplier_name: str
    evaluation_results: list[SupplierEvaluation]


# ---------------------------------------------------------------------------
# Rules engine simulation lab models
# ---------------------------------------------------------------------------

class SimulationLabPackagePayload(BaseModel):
    proposal_mode: str
    selected_rule_id: Optional[str] = None
    draft_rule: dict = {}
    scenarios: list[dict] = []
    proposed_changes: list[dict] = []


class SimulationLabPackageRecord(BaseModel):
    package_id: str
    package_name: str
    created_at: str
    updated_at: str
    meta: dict = {}
    payload: SimulationLabPackagePayload


class SaveSimulationLabPackageRequest(BaseModel):
    package_id: Optional[str] = None
    package_name: str
    meta: dict = {}
    payload: SimulationLabPackagePayload
