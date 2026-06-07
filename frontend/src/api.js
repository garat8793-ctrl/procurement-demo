const BASE = '/api';

async function _json(res) {
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail.slice(0, 200));
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server: ${text.slice(0, 100)}`);
  }
}

export async function fetchQuestions() {
  const res = await fetch(`${BASE}/questions`);
  return _json(res);
}

export async function evaluateProfile(answers, agency = null) {
  const body = { answers };
  if (agency) body.agency = agency;
  const res = await fetch(`${BASE}/profile/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return _json(res);
}

export async function generateBriefingProse(briefingStructure, profile, pathway, userContext = {}) {
  const res = await fetch(`${BASE}/briefing/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_structure: briefingStructure, profile, pathway, user_context: userContext }),
  });
  return _json(res);
}

export async function exportBriefingDocx(briefingStructure, profile, pathway, approvals, sections) {
  const res = await fetch(`${BASE}/briefing/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      briefing_structure: briefingStructure,
      profile,
      pathway,
      approvals,
      sections,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail.slice(0, 200));
  }

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename=\"?([^"]+)\"?/i);
  const filename = match ? match[1] : 'briefing-note.docx';
  const blob = await res.blob();
  return { blob, filename };
}

export async function extractIntake(description) {
  const res = await fetch(`${BASE}/intake/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  return _json(res);
}

export async function evaluateDirect(profile, agency = null) {
  const body = { profile };
  if (agency) body.agency = agency;
  const res = await fetch(`${BASE}/profile/evaluate-direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return _json(res);
}

export async function explainPathway(profile, pathway) {
  const res = await fetch(`${BASE}/pathway/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, pathway }),
  });
  return _json(res);
}

export async function fetchRules() {
  const res = await fetch(`${BASE}/rules`);
  return _json(res);
}

export async function toggleScheme(schemeId) {
  const res = await fetch(`${BASE}/rules/scheme/${schemeId}/toggle`, { method: 'POST' });
  return _json(res);
}

export async function toggleObligation(source, oblId) {
  const res = await fetch(`${BASE}/rules/obligation/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, obl_id: oblId }),
  });
  return _json(res);
}

export async function fetchRulesSchema() {
  const res = await fetch(`${BASE}/rules/schema`);
  return _json(res);
}

export async function addCoreObligation(data) {
  const res = await fetch(`${BASE}/rules/core/obligation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function addSchemeObligation(schemeId, data) {
  const res = await fetch(`${BASE}/rules/scheme/${encodeURIComponent(schemeId)}/obligation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function addSchemePreCheck(schemeId, data) {
  const res = await fetch(`${BASE}/rules/scheme/${encodeURIComponent(schemeId)}/pre_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function addSchemeStepInjection(schemeId, data) {
  const res = await fetch(`${BASE}/rules/scheme/${encodeURIComponent(schemeId)}/step_injection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function addSchemeApprovalAddition(schemeId, data) {
  const res = await fetch(`${BASE}/rules/scheme/${encodeURIComponent(schemeId)}/approval_addition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

// --- Rules platform ---

export async function fetchPlatformRules(activeOnly = false) {
  const res = await fetch(`${BASE}/platform/engine/rules?active_only=${activeOnly ? 'true' : 'false'}`);
  return _json(res);
}

export async function fetchPlatformGraph() {
  const res = await fetch(`${BASE}/platform/engine/graph`);
  return _json(res);
}

export async function comparePlatformSimulationLab(data) {
  const res = await fetch(`${BASE}/platform/engine/simulation-lab/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function assistPlatformPolicyDraft(data) {
  const res = await fetch(`${BASE}/platform/engine/assist/policy-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function fetchSimulationLabPackages(limit = 100) {
  const res = await fetch(`${BASE}/platform/engine/simulation-lab/packages?limit=${limit}`);
  return _json(res);
}

export async function saveSimulationLabPackage(data) {
  const res = await fetch(`${BASE}/platform/engine/simulation-lab/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return _json(res);
}

export async function deleteSimulationLabPackage(packageId) {
  const res = await fetch(`${BASE}/platform/engine/simulation-lab/package/${encodeURIComponent(packageId)}`, {
    method: 'DELETE',
  });
  return _json(res);
}

// --- Decision & Audit ---

export async function fetchDecisionRecord(decisionId) {
  const res = await fetch(`${BASE}/decision/${encodeURIComponent(decisionId)}`);
  return _json(res);
}

export async function fetchAuditDecisions() {
  const res = await fetch(`${BASE}/audit/decisions`);
  return _json(res);
}

export async function fetchAssessments() {
  const res = await fetch(`${BASE}/audit/assessments`);
  return _json(res);
}

export async function fetchAuditAgentActions() {
  const res = await fetch(`${BASE}/audit/agent-actions`);
  return _json(res);
}

// --- Exceptions ---

export async function submitException({ decision_id, rationale, requested_pathway, submitted_by }) {
  const res = await fetch(`${BASE}/exception/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision_id, rationale, requested_pathway, submitted_by }),
  });
  return _json(res);
}

export async function fetchExceptions() {
  const res = await fetch(`${BASE}/exceptions`);
  return _json(res);
}

// --- Procurement lifecycle ---

export async function fetchProcurementState(procurementId) {
  const res = await fetch(`${BASE}/procurement/${encodeURIComponent(procurementId)}/state`);
  return _json(res);
}

export async function advanceProcurementState(procurementId, toStage) {
  const res = await fetch(`${BASE}/procurement/${encodeURIComponent(procurementId)}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_stage: toStage }),
  });
  return _json(res);
}

// --- Procurement details ---

export async function saveProcurementDetails(procurementId, details) {
  const res = await fetch(`${BASE}/procurement/${encodeURIComponent(procurementId)}/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ details }),
  });
  return _json(res);
}

export async function fetchProcurementDetails(procurementId) {
  const res = await fetch(`${BASE}/procurement/${encodeURIComponent(procurementId)}/details`);
  return _json(res);
}

export async function fetchProcurementArtifacts(procurementId) {
  const res = await fetch(`${BASE}/procurement/${encodeURIComponent(procurementId)}/artifacts`);
  return _json(res);
}

export async function saveArtifact(procurementId, artifactType, data) {
  const res = await fetch(
    `${BASE}/procurement/${encodeURIComponent(procurementId)}/artifact/${encodeURIComponent(artifactType)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  return _json(res);
}

// --- Market intelligence ---

export async function assessMarket({ procurement_id, profile, agency_context, details }) {
  const res = await fetch(`${BASE}/market/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, agency_context, details }),
  });
  return _json(res);
}

// --- Strategy ---

export async function generateStrategy({ procurement_id, profile, pathway, market_assessment, details }) {
  const res = await fetch(`${BASE}/strategy/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, pathway, market_assessment, details }),
  });
  return _json(res);
}

export async function selectStrategy(strategyId, selectedOption) {
  const res = await fetch(`${BASE}/strategy/${encodeURIComponent(strategyId)}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selected_option: selectedOption }),
  });
  return _json(res);
}

// --- Drafting ---

export async function draftRFx({ procurement_id, profile, strategy, obligations, details }) {
  const res = await fetch(`${BASE}/drafting/rfx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, strategy, obligations, details }),
  });
  return _json(res);
}

export async function draftEvalPlan({ procurement_id, profile, strategy, details }) {
  const res = await fetch(`${BASE}/drafting/evaluation-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, strategy, details }),
  });
  return _json(res);
}

export async function draftApprovalSummary({ procurement_id, profile, pathway, obligations, approvals, details }) {
  const res = await fetch(`${BASE}/drafting/approval-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, pathway, obligations, approvals, details }),
  });
  return _json(res);
}

// --- Evaluation ---

export async function assessSubmission(formData) {
  const res = await fetch(`${BASE}/evaluation/assess`, {
    method: 'POST',
    body: formData,
  });
  return _json(res);
}

export async function getEvaluationReport(procurementId) {
  const res = await fetch(`${BASE}/evaluation/${encodeURIComponent(procurementId)}/report`);
  return _json(res);
}

// --- Negotiation ---

export async function getNegotiationBrief({ procurement_id, profile, preferred_supplier_id, preferred_supplier_name, evaluation_results }) {
  const res = await fetch(`${BASE}/negotiation/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ procurement_id, profile, preferred_supplier_id, preferred_supplier_name, evaluation_results }),
  });
  return _json(res);
}
