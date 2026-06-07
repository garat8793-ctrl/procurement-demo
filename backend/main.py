"""
NSW Government Procurement Decision System — FastAPI backend (Greenfield MVP)
Deterministic rules engine + multi-agent layer + Claude LLM for prose generation.
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

load_dotenv()

from models import (
    EvaluateRequest, EvaluateResponse,
    BriefingGenerateRequest, BriefingGenerateResponse, BriefingExportRequest,
    ExplainRequest, ExplainResponse,
    ProcurementProfile, SchemeInfo, AgencyContext,
    ObligationToggleRequest,
    CreateObligationRequest, CreatePreCheckRequest,
    CreateStepInjectionRequest, CreateApprovalAdditionRequest,
    TRIGGER_OPTIONS, LIFECYCLE_STAGES,
    IntakeExtractRequest, IntakeExtractResponse,
    DirectEvaluateRequest,
    SubmitExceptionRequest,
    MarketAssessRequest, StrategyGenerateRequest, StrategySelectRequest,
    DraftRFxRequest, DraftEvalPlanRequest, DraftApprovalSummaryRequest,
    EvaluationAssessRequest, NegotiationBriefRequest,
    ProcurementDetails, SaveProcurementDetailsRequest,
    SaveSimulationLabPackageRequest,
)
from pathway_engine import select_pathway
from rules_engine import evaluate_obligations
from approval_engine import derive_approvals
from briefing_generator import build_briefing_structure
from scheme_loader import load_schemes
from rules_platform import (
    PlatformSimulationCompareRequest,
    PlatformSimulationRequest,
    PolicyAssistRequest,
    RulesAnalysisService,
    RulesGraphService,
    RulesPolicyAssistant,
    RulesSimulationLab,
    RulesSimulationService,
    get_rules_platform_registry,
)
import audit_logger

app = FastAPI(title="NSW Procurement Decision System — Greenfield MVP", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    audit_logger.init_db()

DATA_DIR = Path(__file__).parent / "data"
TEMPLATES_DIR = Path(__file__).parent / "templates"
rules_platform_registry = get_rules_platform_registry()
rules_platform_analysis = RulesAnalysisService()
rules_platform_graph = RulesGraphService()
rules_platform_assistant = RulesPolicyAssistant()
rules_platform_simulation = RulesSimulationService()
rules_platform_lab = RulesSimulationLab(rules_platform_simulation)


def _load_questions() -> list[dict]:
    with open(DATA_DIR / "questions.json", encoding="utf-8") as f:
        return json.load(f)


def _build_profile(answers: list) -> ProcurementProfile:
    """Map answer option IDs to tags and accumulate into a ProcurementProfile."""
    questions = _load_questions()
    option_map: dict[str, dict] = {}
    for q in questions:
        for opt in q["options"]:
            option_map[opt["id"]] = {"tags": opt.get("tags", {}), "not_sure": opt.get("not_sure", False)}

    profile_dict: dict = {
        "overlays": [],
        "not_sure_count": 0,
    }

    for answer in answers:
        for opt_id in answer.option_ids:
            opt = option_map.get(opt_id)
            if not opt:
                continue
            if opt.get("not_sure"):
                profile_dict["not_sure_count"] += 1
            tags = opt["tags"]
            for key, value in tags.items():
                if key == "overlays":
                    if value != "none" and value not in profile_dict["overlays"]:
                        profile_dict["overlays"].append(value)
                else:
                    profile_dict[key] = value

    not_sure_count = profile_dict.get("not_sure_count", 0)
    unknown_count = sum([
        profile_dict.get("value") == "unknown",
        profile_dict.get("market") == "unknown",
        profile_dict.get("timing") == "unknown",
        profile_dict.get("definition") is None,
        profile_dict.get("impact") is None,
    ])
    profile_dict["low_confidence"] = (not_sure_count + unknown_count) >= 3

    return ProcurementProfile(**profile_dict)


def _apply_agency_context(profile: ProcurementProfile, agency: AgencyContext) -> ProcurementProfile:
    """Merge agency context fields into the profile."""
    return profile.model_copy(update={
        "agency_id": agency.agency_id,
        "agency_name": agency.agency_name,
        "cluster": agency.cluster,
        "agency_type": agency.agency_type,
    })


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/agencies")
def get_agencies():
    """Return all NSW Government agencies, grouped by cluster."""
    with open(DATA_DIR / "NSW_Gov_agencies.json", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/questions")
def get_questions():
    """Return all questions from questions.json."""
    return _load_questions()


@app.post("/api/profile/evaluate", response_model=EvaluateResponse)
def evaluate_profile(req: EvaluateRequest):
    """
    Core evaluation endpoint. Runs deterministic engines and persists a DecisionRecord.
    Returns full result including decision_id for audit linkage.
    """
    from decision_engine import evaluate_and_record
    profile = _build_profile(req.answers)
    if req.agency:
        profile = _apply_agency_context(profile, req.agency)
    response, _ = evaluate_and_record(profile, req.agency)
    # Persist full evaluation result so the Assessments Library can reload it
    if response.decision_id:
        audit_logger.write_sourcing_artifact(
            response.decision_id, "evaluation_result", response.model_dump(mode="json")
        )
    return response


@app.post("/api/briefing/generate", response_model=BriefingGenerateResponse)
def generate_briefing(req: BriefingGenerateRequest):
    """
    LLM endpoint — generates prose for the briefing note sections.
    Called separately so the deterministic results are shown first.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    from llm_assist import generate_briefing_prose
    sections = generate_briefing_prose(req.briefing_structure, req.profile, req.pathway)
    return BriefingGenerateResponse(sections=sections)


@app.post("/api/briefing/export")
def export_briefing(req: BriefingExportRequest):
    """
    Render the generated briefing prose into the DCS Word template and return a .docx file.
    """
    from briefing_template import render_briefing_note

    try:
        filename, file_bytes = render_briefing_note(
            req.briefing_structure,
            req.sections,
            req.profile,
            req.pathway,
            req.approvals,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Template mapping error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Briefing export error: {type(e).__name__}: {e}")

    return StreamingResponse(
        iter([file_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/briefing/template-preview")
def get_briefing_template_preview():
    preview_path = TEMPLATES_DIR / "BN_preview.png"
    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="Briefing template preview not found")
    return FileResponse(preview_path, media_type="image/png")


@app.post("/api/intake/extract")
def intake_extract(req: IntakeExtractRequest):
    """
    LLM endpoint — extract a procurement profile from a free-text description.
    Returns extracted profile fields, confidence indicators, and targeted follow-up questions
    grounded in the actual pathway selection rules.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from intake_engine import extract_intake
    try:
        result = extract_intake(req.description)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intake extraction error: {type(e).__name__}: {e}")


@app.post("/api/profile/evaluate-direct", response_model=EvaluateResponse)
def evaluate_profile_direct(req: DirectEvaluateRequest):
    """
    Evaluate a pre-built ProcurementProfile directly (used by the conversational intake).
    Bypasses the answer/tag pipeline and runs the profile straight through the engines.
    """
    from decision_engine import evaluate_and_record
    profile = req.profile
    if req.agency:
        profile = _apply_agency_context(profile, req.agency)
    response, _ = evaluate_and_record(profile, req.agency)
    # Persist full evaluation result so the Assessments Library can reload it
    if response.decision_id:
        audit_logger.write_sourcing_artifact(
            response.decision_id, "evaluation_result", response.model_dump(mode="json")
        )
    return response


@app.post("/api/pathway/explain", response_model=ExplainResponse)
def explain_pathway_endpoint(req: ExplainRequest):
    """
    LLM endpoint — generates a plain-English explanation of the selected pathway.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    from llm_assist import explain_pathway
    explanation = explain_pathway(req.profile, req.pathway)
    return ExplainResponse(explanation=explanation)


@app.get("/api/schemes", response_model=list[SchemeInfo])
def list_schemes():
    """List all registered schemes and their status. Useful for admin visibility."""
    all_schemes = load_schemes()
    return [
        SchemeInfo(
            scheme_id=s["scheme_id"],
            name=s["name"],
            active=s.get("active", False),
            description=s.get("description", ""),
            source=s.get("source", ""),
        )
        for s in all_schemes
    ]


@app.post("/api/artifacts/extract")
async def extract_artifact(
    pasted_text: str = Form(default=""),
    file: UploadFile = File(default=None),
):
    """
    LLM artifact ingestion endpoint.
    Accepts pasted policy text and/or an uploaded file (PDF, DOCX, TXT).
    Returns extracted scheme JSON + warnings.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    file_bytes = b""
    filename = ""
    if file and file.filename:
        file_bytes = await file.read()
        filename = file.filename

    if not pasted_text.strip() and not file_bytes:
        raise HTTPException(status_code=400, detail="Provide pasted text and/or upload a file.")

    from artifact_ingester import ingest_artifact
    try:
        result = ingest_artifact(
            pasted_text=pasted_text,
            filename=filename,
            file_bytes=file_bytes,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction error: {type(e).__name__}: {e}")


@app.post("/api/artifacts/save")
def save_artifact(scheme: dict):
    """
    Save a validated scheme JSON to the schemes/ directory.
    The scheme_id is used as the filename.
    """
    scheme_id = scheme.get("scheme_id", "").strip()
    if not scheme_id:
        raise HTTPException(status_code=400, detail="scheme_id is required")

    # Sanitise filename
    safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in scheme_id).lower()
    schemes_dir = Path(__file__).parent / "schemes"
    target = schemes_dir / f"{safe_id}.json"

    # Don't silently overwrite — return conflict if exists and active
    if target.exists():
        existing = json.loads(target.read_text(encoding="utf-8"))
        if existing.get("active") and existing.get("scheme_id") == scheme_id:
            # Allow overwrite but flag it
            pass  # caller is aware they're updating

    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "saved": True,
        "path": f"schemes/{safe_id}.json",
        "scheme_id": scheme_id,
        "active": scheme.get("active", True),
    }


@app.get("/api/rules")
def get_all_rules():
    """Return all rules: every scheme (active + inactive) and all core obligations. Supplier-audience items excluded."""
    all_schemes = [s for s in load_schemes(active_only=False) if s.get("audience") != "supplier"]
    for scheme in all_schemes:
        scheme["obligations"] = [o for o in scheme.get("obligations", []) if o.get("audience") != "supplier"]
        scheme["pre_checks"] = [pc for pc in scheme.get("pre_checks", []) if pc.get("audience") != "supplier"]
    with open(DATA_DIR / "obligations.json", encoding="utf-8") as f:
        core_obligations = [o for o in json.load(f) if o.get("audience") != "supplier"]
    return {"schemes": all_schemes, "core_obligations": core_obligations}


@app.post("/api/rules/scheme/{scheme_id}/toggle")
def toggle_scheme(scheme_id: str):
    """Toggle a scheme's active flag on/off."""
    schemes_dir = Path(__file__).parent / "schemes"
    safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in scheme_id).lower()
    target = schemes_dir / f"{safe_id}.json"
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found")
    scheme = json.loads(target.read_text(encoding="utf-8"))
    scheme["active"] = not scheme.get("active", True)
    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"scheme_id": scheme_id, "active": scheme["active"]}


@app.post("/api/rules/obligation/toggle")
def toggle_obligation(req: ObligationToggleRequest):
    """Toggle an individual obligation's active flag. source='core' targets obligations.json; otherwise targets a scheme file."""
    if req.source == "core":
        path = DATA_DIR / "obligations.json"
        rules = json.loads(path.read_text(encoding="utf-8"))
        for rule in rules:
            if rule["id"] == req.obl_id:
                rule["active"] = not rule.get("active", True)
                path.write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")
                return {"id": req.obl_id, "active": rule["active"]}
        raise HTTPException(status_code=404, detail=f"Obligation '{req.obl_id}' not found in core rules")
    else:
        schemes_dir = Path(__file__).parent / "schemes"
        safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in req.source).lower()
        target = schemes_dir / f"{safe_id}.json"
        if not target.exists():
            raise HTTPException(status_code=404, detail=f"Scheme '{req.source}' not found")
        scheme = json.loads(target.read_text(encoding="utf-8"))
        for obl in scheme.get("obligations", []):
            if obl["id"] == req.obl_id:
                obl["active"] = not obl.get("active", True)
                target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
                return {"id": req.obl_id, "active": obl["active"]}
        raise HTTPException(status_code=404, detail=f"Obligation '{req.obl_id}' not found in scheme '{req.source}'")


@app.get("/api/rules/schema")
def get_rules_schema():
    """
    Return the canonical trigger option values and rule field definitions.
    Used by the frontend rule editor to render valid trigger selectors.
    """
    return {
        "trigger_options": TRIGGER_OPTIONS,
        "rule_types": {
            "obligation":        {"fields": ["title", "body", "policy"], "supports_trigger": False},
            "core_obligation":   {"fields": ["title", "body", "policy", "trigger"], "supports_trigger": True},
            "pre_check":         {"fields": ["title", "body", "link"], "supports_trigger": False},
            "step_injection":    {"fields": ["after_step", "steps"], "supports_trigger": False},
            "approval_addition": {"fields": ["role", "note"], "supports_trigger": False},
        },
    }


# ---------------------------------------------------------------------------
# Rule creation helpers
# ---------------------------------------------------------------------------

def _load_scheme_file(scheme_id: str) -> tuple[Path, dict]:
    """Load a scheme JSON file and return (path, dict). Raises 404 if not found."""
    schemes_dir = Path(__file__).parent / "schemes"
    safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in scheme_id).lower()
    target = schemes_dir / f"{safe_id}.json"
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found")
    return target, json.loads(target.read_text(encoding="utf-8"))


def _next_scheme_item_id(scheme: dict, list_key: str, type_code: str) -> str:
    """
    Auto-generate the next ID for a scheme rule item.
    Format: {SCHEME_ID}-{OBL|PC}-{N:03d}
    """
    existing = [item.get("id", "") for item in scheme.get(list_key, [])]
    nums = [int(m.group(1)) for eid in existing if (m := re.search(r'(\d+)$', eid))]
    next_n = (max(nums) + 1) if nums else 1
    return f"{scheme['scheme_id']}-{type_code}-{next_n:03d}"


def _next_core_obl_id(rules: list) -> str:
    """Auto-generate the next ID for a core obligation. Format: OBL-{N:03d}"""
    nums = [int(m.group(1)) for r in rules if (m := re.search(r'(\d+)$', r.get("id", "")))]
    next_n = (max(nums) + 1) if nums else 1
    return f"OBL-{next_n:03d}"


# ---------------------------------------------------------------------------
# Rule creation endpoints
# ---------------------------------------------------------------------------

@app.post("/api/rules/core/obligation")
def add_core_obligation(req: CreateObligationRequest):
    """Append a new obligation (with optional trigger) to obligations.json."""
    path = DATA_DIR / "obligations.json"
    rules = json.loads(path.read_text(encoding="utf-8"))
    new_item: dict = {
        "id":     _next_core_obl_id(rules),
        "title":  req.title,
        "body":   req.body,
        "policy": req.policy,
        "active": req.active,
    }
    if req.trigger:
        trigger_dict = {k: v for k, v in req.trigger.model_dump().items() if v}
        if trigger_dict:
            new_item["trigger"] = trigger_dict
    rules.append(new_item)
    path.write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_item


@app.post("/api/rules/scheme/{scheme_id}/obligation")
def add_scheme_obligation(scheme_id: str, req: CreateObligationRequest):
    """Append a new obligation to a scheme file."""
    target, scheme = _load_scheme_file(scheme_id)
    new_item = {
        "id":     _next_scheme_item_id(scheme, "obligations", "OBL"),
        "title":  req.title,
        "body":   req.body,
        "policy": req.policy,
        "active": req.active,
    }
    scheme.setdefault("obligations", []).append(new_item)
    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_item


@app.post("/api/rules/scheme/{scheme_id}/pre_check")
def add_scheme_pre_check(scheme_id: str, req: CreatePreCheckRequest):
    """Append a new pre-check to a scheme file."""
    target, scheme = _load_scheme_file(scheme_id)
    new_item: dict = {
        "id":    _next_scheme_item_id(scheme, "pre_checks", "PC"),
        "title": req.title,
        "body":  req.body,
        "active": req.active,
    }
    if req.link:
        new_item["link"] = req.link
    scheme.setdefault("pre_checks", []).append(new_item)
    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_item


@app.post("/api/rules/scheme/{scheme_id}/step_injection")
def add_scheme_step_injection(scheme_id: str, req: CreateStepInjectionRequest):
    """Append a new step injection to a scheme file."""
    target, scheme = _load_scheme_file(scheme_id)
    new_item = {"after_step": req.after_step, "steps": req.steps}
    if not isinstance(scheme.get("step_injections"), list):
        scheme["step_injections"] = []
    scheme["step_injections"].append(new_item)
    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_item


@app.post("/api/rules/scheme/{scheme_id}/approval_addition")
def add_scheme_approval_addition(scheme_id: str, req: CreateApprovalAdditionRequest):
    """Append a new approval addition to a scheme file."""
    target, scheme = _load_scheme_file(scheme_id)
    new_item = {"role": req.role, "note": req.note}
    scheme.setdefault("approval_additions", []).append(new_item)
    target.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_item


# ---------------------------------------------------------------------------
# Rules platform foundation
# ---------------------------------------------------------------------------

@app.get("/api/platform/engine/overview")
def get_rules_platform_overview():
    snapshot = rules_platform_registry.load_snapshot()
    analysis = rules_platform_analysis.analyze(snapshot)
    objective_labels = [
        {"objective_id": objective.objective_id, "label": objective.label}
        for objective in rules_platform_registry.load_objectives()
    ]
    return {
        "snapshot_id": snapshot.snapshot_id,
        "generated_at": snapshot.generated_at,
        "summary": {
            "source_count": len(snapshot.sources),
            "rule_count": len(snapshot.rules),
            "active_rule_count": len([rule for rule in snapshot.rules if rule.active]),
            "analysis_findings": analysis["summary"]["finding_count"],
        },
        "objectives": objective_labels,
        "sources": snapshot.sources,
        "taxonomy": snapshot.taxonomy,
    }


@app.get("/api/platform/engine/rules")
def get_rules_platform_rules(active_only: bool = False):
    snapshot = rules_platform_registry.load_snapshot()
    rules = snapshot.rules if not active_only else [rule for rule in snapshot.rules if rule.active]
    return {
        "snapshot_id": snapshot.snapshot_id,
        "rules": [rule.model_dump(mode="json") for rule in rules],
    }


@app.get("/api/platform/engine/findings")
def get_rules_platform_findings():
    snapshot = rules_platform_registry.load_snapshot()
    return rules_platform_analysis.analyze(snapshot)


@app.get("/api/platform/engine/graph")
def get_rules_platform_graph():
    snapshot = rules_platform_registry.load_snapshot()
    return rules_platform_graph.build(snapshot)


@app.post("/api/platform/engine/simulate")
def simulate_rules_platform_case(req: PlatformSimulationRequest):
    snapshot = rules_platform_registry.load_snapshot()
    return rules_platform_simulation.simulate(snapshot, req)


@app.post("/api/platform/engine/simulation-lab/compare")
def compare_rules_platform_scenarios(req: PlatformSimulationCompareRequest):
    snapshot = rules_platform_registry.load_snapshot()
    return rules_platform_lab.compare(snapshot, req)


@app.post("/api/platform/engine/assist/policy-draft")
def assist_rules_platform_policy_draft(req: PolicyAssistRequest):
    snapshot = rules_platform_registry.load_snapshot()
    return rules_platform_assistant.assist(snapshot, req)


@app.get("/api/platform/engine/simulation-lab/packages")
def list_simulation_lab_packages(limit: int = 100):
    return audit_logger.list_simulation_lab_packages(limit=limit)


@app.get("/api/platform/engine/simulation-lab/package/{package_id}")
def get_simulation_lab_package(package_id: str):
    record = audit_logger.read_simulation_lab_package(package_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Simulation lab package {package_id} not found")
    return record


@app.post("/api/platform/engine/simulation-lab/package")
def save_simulation_lab_package(req: SaveSimulationLabPackageRequest):
    now = datetime.now(timezone.utc).isoformat()
    existing = audit_logger.read_simulation_lab_package(req.package_id) if req.package_id else None
    record = {
        "package_id": req.package_id or f"simlab-{uuid4().hex[:12]}",
        "package_name": req.package_name.strip() or "Untitled package",
        "created_at": existing["created_at"] if existing else now,
        "updated_at": now,
        "meta": req.meta or {},
        "payload": req.payload.model_dump(mode="json"),
    }
    audit_logger.write_simulation_lab_package(record)
    return record


@app.delete("/api/platform/engine/simulation-lab/package/{package_id}")
def delete_simulation_lab_package(package_id: str):
    deleted = audit_logger.delete_simulation_lab_package(package_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Simulation lab package {package_id} not found")
    return {"deleted": True, "package_id": package_id}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Audit / Decision records
# ---------------------------------------------------------------------------

@app.get("/api/decision/{decision_id}")
def get_decision(decision_id: str):
    record = audit_logger.read_decision(decision_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found")
    return record


@app.get("/api/audit/decisions")
def list_decisions(limit: int = 50):
    return audit_logger.list_decisions(limit=limit)


@app.get("/api/audit/assessments")
def list_assessments(limit: int = 100):
    """Enriched decision records with artifact inventory and procurement title — for the Assessments Library."""
    return audit_logger.list_assessments(limit=limit)


@app.get("/api/audit/agent-actions")
def list_agent_actions(limit: int = 100):
    return audit_logger.list_agent_actions(limit=limit)


# ---------------------------------------------------------------------------
# Exception / override
# ---------------------------------------------------------------------------

@app.post("/api/exception/submit")
def submit_exception(req: SubmitExceptionRequest):
    import exception_handler
    try:
        record = exception_handler.submit_exception(
            req.decision_id, req.rationale, req.requested_pathway, req.submitted_by
        )
        return record
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/exceptions")
def list_exceptions(limit: int = 50):
    import exception_handler
    return exception_handler.list_exceptions(limit=limit)


# ---------------------------------------------------------------------------
# Procurement lifecycle state
# ---------------------------------------------------------------------------

@app.get("/api/procurement/{procurement_id}/state")
def get_procurement_state(procurement_id: str):
    state = audit_logger.get_procurement_state(procurement_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Procurement {procurement_id} not found")
    return state


@app.post("/api/procurement/{procurement_id}/advance")
def advance_lifecycle(procurement_id: str, body: dict):
    state = audit_logger.get_procurement_state(procurement_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Procurement {procurement_id} not found")
    current = state["lifecycle_stage"]
    try:
        idx = LIFECYCLE_STAGES.index(current)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown stage: {current}")
    if idx >= len(LIFECYCLE_STAGES) - 1:
        raise HTTPException(status_code=400, detail="Already at final stage")
    new_stage = body.get("to_stage") or body.get("stage") or LIFECYCLE_STAGES[idx + 1]
    from datetime import datetime, timezone
    state["lifecycle_stage"] = new_stage
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    audit_logger.write_procurement_state(state)
    return state


# ---------------------------------------------------------------------------
# Market intelligence agent
# ---------------------------------------------------------------------------

@app.post("/api/market/assess")
def market_assess(req: MarketAssessRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from market_agent import assess_market
    try:
        result = assess_market(req.procurement_id, req.profile, req.agency, req.details)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Market assessment error: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Strategy agent
# ---------------------------------------------------------------------------

@app.post("/api/strategy/generate")
def strategy_generate(req: StrategyGenerateRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from strategy_agent import generate_strategy
    try:
        result = generate_strategy(req.procurement_id, req.profile, req.pathway, req.market_assessment, req.details)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Strategy generation error: {type(e).__name__}: {e}")


@app.post("/api/strategy/{strategy_id}/select")
def strategy_select(strategy_id: str, req: StrategySelectRequest):
    from strategy_agent import record_strategy_selection
    try:
        return record_strategy_selection(strategy_id, req.selected_option)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Drafting agent
# ---------------------------------------------------------------------------

@app.post("/api/drafting/rfx")
def draft_rfx(req: DraftRFxRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from drafting_agent import draft_rfx as _draft
    try:
        return _draft(req.procurement_id, req.profile, req.strategy, req.obligations, req.details)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RFx drafting error: {type(e).__name__}: {e}")


@app.post("/api/drafting/evaluation-plan")
def draft_evaluation_plan(req: DraftEvalPlanRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from drafting_agent import draft_evaluation_plan as _draft
    try:
        return _draft(req.procurement_id, req.profile, req.strategy, req.details)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation plan drafting error: {type(e).__name__}: {e}")


@app.post("/api/drafting/approval-summary")
def draft_approval_summary(req: DraftApprovalSummaryRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from drafting_agent import draft_approval_summary as _draft
    try:
        return _draft(req.procurement_id, req.profile, req.pathway, req.obligations, req.approvals, req.details)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval summary drafting error: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Procurement details
# ---------------------------------------------------------------------------

@app.post("/api/procurement/{procurement_id}/details")
def save_procurement_details(procurement_id: str, req: SaveProcurementDetailsRequest):
    """Upsert procurement details (title, deliverables, requirements, timeline etc.)."""
    from datetime import datetime, timezone
    details_dict = req.details.model_dump()
    details_dict["procurement_id"] = procurement_id
    details_dict["saved_at"] = datetime.now(timezone.utc).isoformat()
    audit_logger.write_procurement_details(details_dict)
    return {"saved": True, "procurement_id": procurement_id}


@app.get("/api/procurement/{procurement_id}/details")
def get_procurement_details_route(procurement_id: str):
    """Retrieve stored procurement details."""
    details = audit_logger.get_procurement_details(procurement_id)
    if details is None:
        raise HTTPException(status_code=404, detail=f"No details found for {procurement_id}")
    return details


@app.post("/api/procurement/{procurement_id}/artifact/{artifact_type}")
async def upsert_procurement_artifact(procurement_id: str, artifact_type: str, req: Request):
    """
    Persist an edited sourcing artifact (rfx_draft, eval_plan, approval_summary, etc.).
    Accepts arbitrary JSON body; overwrites the existing stored artifact.
    """
    data = await req.json()
    audit_logger.write_sourcing_artifact(procurement_id, artifact_type, data)
    return {"saved": True, "procurement_id": procurement_id, "artifact_type": artifact_type}


@app.get("/api/procurement/{procurement_id}/artifacts")
def get_procurement_artifacts(procurement_id: str):
    """
    Return all persisted sourcing artifacts for a procurement in a single call.
    Keyed by artifact_type: strategy, market_assessment, rfx_draft, eval_plan, approval_summary.
    Also includes procurement_details if saved.
    """
    artifacts = audit_logger.read_all_sourcing_artifacts(procurement_id)
    details = audit_logger.get_procurement_details(procurement_id)
    if details:
        artifacts["procurement_details"] = details
    return artifacts


# ---------------------------------------------------------------------------
# Evaluation agent
# ---------------------------------------------------------------------------

@app.post("/api/evaluation/assess")
async def evaluate_submission(
    procurement_id: str = Form(...),
    supplier_id: str = Form(...),
    supplier_name: str = Form(...),
    criteria_json: str = Form(...),
    profile_json: str = Form(...),
    file: UploadFile = File(default=None),
    pasted_text: str = Form(default=""),
):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    file_bytes = b""
    filename = ""
    if file and file.filename:
        file_bytes = await file.read()
        filename = file.filename

    submission_text = pasted_text
    if file_bytes:
        from artifact_ingester import extract_text
        submission_text += "\n\n" + extract_text(filename, file_bytes)

    if not submission_text.strip():
        raise HTTPException(status_code=400, detail="Provide submission text or upload a file")

    criteria = json.loads(criteria_json)
    profile_data = json.loads(profile_json)
    from models import EvaluationCriterion, ProcurementProfile as PP
    criteria_objs = [EvaluationCriterion(**c) for c in criteria]
    profile_obj = PP(**profile_data)

    from evaluation_agent import evaluate_submission as _eval
    try:
        return _eval(procurement_id, supplier_id, supplier_name, submission_text, criteria_objs, profile_obj)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {type(e).__name__}: {e}")


@app.get("/api/evaluation/{procurement_id}/report")
def evaluation_report(procurement_id: str):
    from evaluation_agent import get_evaluation_report
    return get_evaluation_report(procurement_id)


# ---------------------------------------------------------------------------
# Negotiation agent
# ---------------------------------------------------------------------------

@app.post("/api/negotiation/brief")
def negotiation_brief(req: NegotiationBriefRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    from negotiation_agent import prepare_negotiation_brief
    try:
        return prepare_negotiation_brief(
            req.procurement_id, req.profile,
            req.preferred_supplier_id, req.preferred_supplier_name,
            req.evaluation_results,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Negotiation brief error: {type(e).__name__}: {e}")
