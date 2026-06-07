import React, { useEffect, useState, useCallback, useContext, useMemo } from 'react';
import { CitationsContext } from '../CitationsContext';
import {
  fetchRules, fetchRulesSchema,
  toggleScheme, toggleObligation,
  addCoreObligation, addSchemeObligation,
  addSchemePreCheck, addSchemeStepInjection, addSchemeApprovalAddition,
  fetchPlatformRules, fetchPlatformGraph, comparePlatformSimulationLab, assistPlatformPolicyDraft,
  fetchSimulationLabPackages, saveSimulationLabPackage, deleteSimulationLabPackage,
} from '../api';

// ── Trigger key colours ──────────────────────────────────────────────────────
const TRIGGER_COLOURS = {
  category:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  value:       { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  impact:      { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  overlays:    { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  purpose:     { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  market:      { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  interaction: { bg: '#ECFEFF', text: '#0F766E', border: '#A5F3FC' },
  timing:      { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  definition:  { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  org:         { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' },
  agency:      { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  cluster:     { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  agency_type: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

const TRIGGER_KEY_LABELS = {
  category: 'category', value: 'value', impact: 'impact',
  overlays: 'overlay', purpose: 'purpose', market: 'market',
  interaction: 'interaction', timing: 'timing', definition: 'definition', org: 'org',
  agency: 'agency', cluster: 'cluster', agency_type: 'agency type',
};

function humaniseTriggerValue(value) {
  return String(value)
    .split('_')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

const SCHEME_COLOURS = {
  ICT_WOG:           '#2563EB',
  CONSTRUCTION:      '#D97706',
  GOODS_BUYNSW:      '#059669',
  TRANSPORT_SME_ICT: '#0891B2',
};

const MODEL_TABS = {
  EXPLORER: 'explorer',
  MODEL: 'model',
  VISUALISE: 'visualise',
};

const FINDING_KIND_LABELS = {
  gaps: 'Coverage / Gaps',
  duplicates: 'Potential Duplicates',
  contradictions: 'Potential Contradictions',
  workflow: 'Process / Workflow Impact',
};

const FINDING_SEVERITY_COLOURS = {
  info: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  warning: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  critical: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
};

const GRAPH_NODE_STYLES = {
  source: { fill: '#E0F2FE', stroke: '#0284C7', text: '#0F172A' },
  signal: { fill: '#FDF4FF', stroke: '#C084FC', text: '#4C1D95' },
  rule: { fill: '#ECFDF5', stroke: '#10B981', text: '#0F172A' },
  objective: { fill: '#FEF3C7', stroke: '#F59E0B', text: '#78350F' },
};

const GRAPH_RELATION_STYLES = {
  contains_rule: { color: '#475569', label: 'Source -> Rule' },
  triggers_rule: { color: '#A855F7', label: 'Signal -> Rule' },
  supports_objective: { color: '#D97706', label: 'Rule -> Objective' },
  shares_source: { color: '#0F766E', label: 'Rules In Same Source' },
  similar_rule: { color: '#2563EB', label: 'Similar Rules' },
  conflicts_with: { color: '#DC2626', label: 'Potential Conflict' },
};

const MODEL_USAGE_INSTRUCTIONS = [
  'Open the app, go to Rules Explorer, then switch from Explorer to Model. This tab is the rules-engine workspace, separate from the procurement pathway demo.',
  'Use the filters at the top of the page to narrow findings by source, scheme, active state, or finding type.',
  'Read the findings sections to identify gaps, duplicates, contradictions, and workflow impacts in the current rules.',
  'Create one or more scenarios in the Scenario set area. Each scenario represents a hypothetical procurement profile with category, value, purpose, market, impact, interaction, timing, org, and overlays.',
  'Build a modelling package by giving it a name and optionally setting status, owner, and a working note.',
  'In the Rule workbench, choose whether you want to deactivate a rule, replace an existing rule, or add a new candidate rule.',
  'For replace or deactivate, select the target canonical rule. For add or replace, complete the draft rule details, conditions, and effects.',
  'Use Clone selected rule into candidate if you want to start from an existing rule instead of creating one from scratch.',
  'Click Add change to add the proposed rule change to the current package. You can add multiple changes before running the comparison.',
  'Click Run comparison to compare the current live canonical rules snapshot against your proposed package across all defined scenarios.',
  'Read the comparison results to see matched rule deltas, obligation deltas, workflow deltas, approval deltas, plus added and removed matched rules for each scenario.',
  'Save the package if you want to keep your modelling work. You can also load saved packages, export them to JSON, or import them later.',
  'This page is for modelling and comparison only. It does not automatically activate rule changes in the live engine.',
];

function normaliseText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenise(text) {
  return normaliseText(text)
    .split(' ')
    .filter(word => word.length > 2);
}

function jaccardSimilarity(a, b) {
  const left = new Set(tokenise(a));
  const right = new Set(tokenise(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const word of left) {
    if (right.has(word)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function normaliseTriggers(triggers) {
  if (!triggers || typeof triggers !== 'object') return {};
  return Object.fromEntries(
    Object.entries(triggers).filter(([, value]) => {
      if (value == null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    })
  );
}

function triggerSignature(triggers) {
  const normalised = normaliseTriggers(triggers);
  return JSON.stringify(
    Object.keys(normalised)
      .sort()
      .map(key => [
        key,
        Array.isArray(normalised[key]) ? [...normalised[key]].sort() : normalised[key],
      ])
  );
}

function triggersOverlap(a, b) {
  const left = normaliseTriggers(a);
  const right = normaliseTriggers(b);
  const sharedKeys = Object.keys(left).filter(key => key in right);
  if (sharedKeys.length === 0) return false;
  return sharedKeys.every(key => {
    const leftVals = Array.isArray(left[key]) ? left[key] : [left[key]];
    const rightVals = Array.isArray(right[key]) ? right[key] : [right[key]];
    return leftVals.some(val => rightVals.includes(val));
  });
}

function detectContradictoryIntent(text) {
  const normalised = normaliseText(text);
  const negative = /(must not|cannot|mustn't|not required|do not|should not|without)/.test(normalised);
  const positive = /(must|required|mandatory|ensure|include|apply|use|publish|obtain|report)/.test(normalised);
  const openMarket = /(open market|open tender|approach to market)/.test(normalised);
  const arrangement = /(use .*arrangement|use .*scheme|whole of government arrangement)/.test(normalised);
  return { negative, positive, openMarket, arrangement };
}

function getSchemeColour(schemeId) {
  return SCHEME_COLOURS[schemeId] || 'var(--navy)';
}

function buildAnalysisRecord(partial) {
  return {
    ...partial,
    effectiveTriggers: normaliseTriggers(partial.effectiveTriggers),
    triggerSignature: triggerSignature(partial.effectiveTriggers),
    analysis: partial.analysis || { findings: [], aiInsights: [] },
  };
}

function buildRulesModel(data, schema) {
  const schemes = data?.schemes || [];
  const core = data?.core_obligations || [];
  const triggerOptions = schema?.trigger_options || {};
  const records = [];

  core.forEach(rule => {
    records.push(buildAnalysisRecord({
      stableId: `core:${rule.id}`,
      recordType: 'core_obligation',
      sourceType: 'core',
      sourceId: 'core',
      schemeId: null,
      schemeName: 'Core obligations',
      title: rule.title,
      summary: rule.body,
      detail: rule.body,
      policyNote: rule.policy || '',
      active: rule.active !== false,
      effectiveActive: rule.active !== false,
      effectiveTriggers: rule.trigger || {},
      workflowImpact: null,
    }));
  });

  schemes.forEach(scheme => {
    const schemeTriggers = normaliseTriggers(scheme.triggers);
    const sourceActive = scheme.active !== false;

    (scheme.obligations || []).forEach(rule => {
      records.push(buildAnalysisRecord({
        stableId: `scheme_obligation:${scheme.scheme_id}:${rule.id}`,
        recordType: 'scheme_obligation',
        sourceType: 'scheme',
        sourceId: scheme.scheme_id,
        schemeId: scheme.scheme_id,
        schemeName: scheme.name,
        title: rule.title,
        summary: rule.body,
        detail: rule.body,
        policyNote: rule.policy || '',
        active: rule.active !== false,
        effectiveActive: sourceActive && rule.active !== false,
        effectiveTriggers: schemeTriggers,
        workflowImpact: null,
      }));
    });

    (scheme.pre_checks || []).forEach(rule => {
      records.push(buildAnalysisRecord({
        stableId: `pre_check:${scheme.scheme_id}:${rule.id}`,
        recordType: 'pre_check',
        sourceType: 'scheme',
        sourceId: scheme.scheme_id,
        schemeId: scheme.scheme_id,
        schemeName: scheme.name,
        title: rule.title,
        summary: rule.body,
        detail: rule.body,
        policyNote: rule.link || rule.citation || '',
        active: rule.active !== false,
        effectiveActive: sourceActive && rule.active !== false,
        effectiveTriggers: schemeTriggers,
        workflowImpact: null,
      }));
    });

    (scheme.step_injections || []).forEach((injection, index) => {
      const steps = injection.steps || [];
      records.push(buildAnalysisRecord({
        stableId: `step_injection:${scheme.scheme_id}:${index}`,
        recordType: 'step_injection',
        sourceType: 'scheme',
        sourceId: scheme.scheme_id,
        schemeId: scheme.scheme_id,
        schemeName: scheme.name,
        title: `Process steps injected after step ${injection.after_step}`,
        summary: `${steps.length} workflow step${steps.length === 1 ? '' : 's'} injected`,
        detail: steps.map(step => (typeof step === 'object' ? step.text : step)).join(' | '),
        policyNote: scheme.source || '',
        active: true,
        effectiveActive: sourceActive,
        effectiveTriggers: schemeTriggers,
        workflowImpact: {
          impactType: 'step_injection',
          afterStep: injection.after_step,
          count: steps.length,
          steps: steps.map(step => (typeof step === 'object' ? step.text : step)),
        },
      }));
    });

    (scheme.approval_additions || []).forEach((approval, index) => {
      records.push(buildAnalysisRecord({
        stableId: `approval_addition:${scheme.scheme_id}:${index}`,
        recordType: 'approval_addition',
        sourceType: 'scheme',
        sourceId: scheme.scheme_id,
        schemeId: scheme.scheme_id,
        schemeName: scheme.name,
        title: approval.role,
        summary: approval.note || 'Additional approval requirement',
        detail: approval.note || '',
        policyNote: scheme.source || '',
        active: true,
        effectiveActive: sourceActive,
        effectiveTriggers: schemeTriggers,
        workflowImpact: {
          impactType: 'approval_addition',
          role: approval.role,
        },
      }));
    });
  });

  const findings = [];
  const activeRecords = records.filter(record => record.effectiveActive);
  const contentRecords = activeRecords.filter(record => ['core_obligation', 'scheme_obligation', 'pre_check'].includes(record.recordType));

  Object.entries(triggerOptions).forEach(([dimension, values]) => {
    const counts = {};
    values.forEach(value => { counts[value] = 0; });
    activeRecords.forEach(record => {
      const dimensionValues = record.effectiveTriggers[dimension];
      if (!dimensionValues) return;
      const list = Array.isArray(dimensionValues) ? dimensionValues : [dimensionValues];
      list.forEach(value => {
        counts[value] = (counts[value] || 0) + 1;
      });
    });

    const missing = values.filter(value => !counts[value]);
    const sparse = values.filter(value => (counts[value] || 0) > 0 && (counts[value] || 0) <= 1);

    if (missing.length > 0) {
      findings.push({
        finding_id: `gaps:${dimension}:missing`,
        kind: 'gaps',
        severity: missing.length >= Math.ceil(values.length / 2) ? 'warning' : 'info',
        confidence: 0.98,
        source: 'heuristic',
        summary: `${humaniseTriggerValue(dimension)} has uncovered trigger values`,
        rationale: `No active rules currently reference: ${missing.map(humaniseTriggerValue).join(', ')}.`,
        affected_rule_ids: [],
        recommendation: `Add or review rules for ${humaniseTriggerValue(dimension)} so the engine has intentional coverage across that policy dimension.`,
      });
    }

    if (sparse.length > 0) {
      findings.push({
        finding_id: `gaps:${dimension}:sparse`,
        kind: 'gaps',
        severity: 'info',
        confidence: 0.9,
        source: 'heuristic',
        summary: `${humaniseTriggerValue(dimension)} has sparse coverage`,
        rationale: `${sparse.map(humaniseTriggerValue).join(', ')} only appear in one active rule path.`,
        affected_rule_ids: [],
        recommendation: `Check whether sparse ${humaniseTriggerValue(dimension)} values need broader policy representation or deliberate exclusion.`,
      });
    }
  });

  for (let i = 0; i < contentRecords.length; i += 1) {
    for (let j = i + 1; j < contentRecords.length; j += 1) {
      const left = contentRecords[i];
      const right = contentRecords[j];
      const titleSimilarity = jaccardSimilarity(left.title, right.title);
      const bodySimilarity = jaccardSimilarity(left.summary, right.summary);
      const sameTriggers = left.triggerSignature === right.triggerSignature;
      const exactTitle = normaliseText(left.title) === normaliseText(right.title);

      if (exactTitle || (sameTriggers && bodySimilarity >= 0.55) || (titleSimilarity >= 0.75 && bodySimilarity >= 0.42)) {
        findings.push({
          finding_id: `duplicates:${left.stableId}:${right.stableId}`,
          kind: 'duplicates',
          severity: exactTitle ? 'warning' : 'info',
          confidence: exactTitle ? 0.97 : 0.82,
          source: 'heuristic',
          summary: `${left.title} may duplicate ${right.title}`,
          rationale: sameTriggers
            ? 'These records share the same effective trigger footprint and materially similar rule text.'
            : 'These records use very similar titles or action language and may represent overlapping policy intent.',
          affected_rule_ids: [left.stableId, right.stableId],
          recommendation: 'Review whether these rules should be merged, narrowed, or explicitly differentiated.',
        });
      }

      const leftIntent = detectContradictoryIntent(`${left.title} ${left.summary}`);
      const rightIntent = detectContradictoryIntent(`${right.title} ${right.summary}`);
      const subjectSimilarity = Math.max(titleSimilarity, bodySimilarity);
      const polarityConflict = (leftIntent.negative && rightIntent.positive) || (leftIntent.positive && rightIntent.negative);
      const routingConflict = (leftIntent.openMarket && rightIntent.arrangement) || (leftIntent.arrangement && rightIntent.openMarket);

      if (triggersOverlap(left.effectiveTriggers, right.effectiveTriggers) && subjectSimilarity >= 0.28 && (polarityConflict || routingConflict)) {
        findings.push({
          finding_id: `contradictions:${left.stableId}:${right.stableId}`,
          kind: 'contradictions',
          severity: 'critical',
          confidence: routingConflict ? 0.88 : 0.76,
          source: 'heuristic',
          summary: `${left.title} may conflict with ${right.title}`,
          rationale: routingConflict
            ? 'The same trigger space appears to point toward different procurement workflow directions.'
            : 'The records overlap on trigger conditions but the action language points in opposite directions.',
          affected_rule_ids: [left.stableId, right.stableId],
          recommendation: 'Confirm precedence, narrow the trigger conditions, or state the exception relationship explicitly.',
        });
      }
    }
  }

  const workflowByScheme = schemes
    .map(scheme => {
      const active = scheme.active !== false;
      const stepInjections = (scheme.step_injections || []).length;
      const approvalAdditions = (scheme.approval_additions || []).length;
      return {
        schemeId: scheme.scheme_id,
        schemeName: scheme.name,
        active,
        stepInjections,
        approvalAdditions,
        total: stepInjections + approvalAdditions,
      };
    })
    .filter(scheme => scheme.active && scheme.total > 0)
    .sort((a, b) => b.total - a.total);

  workflowByScheme.forEach(scheme => {
    findings.push({
      finding_id: `workflow:${scheme.schemeId}`,
      kind: 'workflow',
      severity: scheme.total >= 4 ? 'warning' : 'info',
      confidence: 1,
      source: 'heuristic',
      summary: `${scheme.schemeName} materially changes the workflow`,
      rationale: `${scheme.stepInjections} step injection${scheme.stepInjections === 1 ? '' : 's'} and ${scheme.approvalAdditions} approval addition${scheme.approvalAdditions === 1 ? '' : 's'} apply when the scheme matches.`,
      affected_rule_ids: activeRecords
        .filter(record => record.schemeId === scheme.schemeId && record.workflowImpact)
        .map(record => record.stableId),
      recommendation: 'Use this as a baseline process burden signal when assessing new policy overlays.',
    });
  });

  const findingsByRecord = new Map();
  findings.forEach(finding => {
    finding.affected_rule_ids.forEach(recordId => {
      const bucket = findingsByRecord.get(recordId) || [];
      bucket.push(finding);
      findingsByRecord.set(recordId, bucket);
    });
  });

  const recordsWithAnalysis = records.map(record => ({
    ...record,
    analysis: {
      findings: findingsByRecord.get(record.stableId) || [],
      aiInsights: [],
    },
  }));

  return {
    records: recordsWithAnalysis,
    findings,
    findingsByKind: {
      gaps: findings.filter(finding => finding.kind === 'gaps'),
      duplicates: findings.filter(finding => finding.kind === 'duplicates'),
      contradictions: findings.filter(finding => finding.kind === 'contradictions'),
      workflow: findings.filter(finding => finding.kind === 'workflow'),
    },
    summaries: {
      totalRecords: recordsWithAnalysis.length,
      activeRecords: recordsWithAnalysis.filter(record => record.effectiveActive).length,
      workflowSchemes: workflowByScheme,
      triggerDimensions: Object.keys(triggerOptions).length,
    },
  };
}

function TriggerPill({ triggerKey, value }) {
  const c = TRIGGER_COLOURS[triggerKey] || TRIGGER_COLOURS.org;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: '99px', border: `1px solid ${c.border}`,
      background: c.bg, color: c.text,
      whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {TRIGGER_KEY_LABELS[triggerKey] || triggerKey}: {humaniseTriggerValue(value)}
    </span>
  );
}

function TriggerBlock({ triggers }) {
  if (!triggers || Object.keys(triggers).length === 0) return null;
  const pills = [];
  for (const [key, values] of Object.entries(triggers)) {
    for (const v of (Array.isArray(values) ? values : [values])) {
      pills.push(<TriggerPill key={`${key}-${v}`} triggerKey={key} value={v} />);
    }
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {pills}
    </div>
  );
}

function Toggle({ active, onToggle, disabled = false, size = 'sm' }) {
  const h = size === 'sm' ? 20 : 24;
  const w = h * 1.9;
  const knob = h - 4;
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!disabled) onToggle(); }}
      title={active ? 'Deactivate' : 'Activate'}
      style={{
        width: w, height: h, borderRadius: h,
        background: active ? 'var(--teal)' : '#CBD5E1',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: active ? w - knob - 2 : 2,
        width: knob, height: knob,
        borderRadius: '50%', background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function SourceBadge({ source, schemeColour }) {
  const colour = schemeColour || 'var(--navy)';
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px',
      borderRadius: '4px', letterSpacing: '0.06em', textTransform: 'uppercase',
      background: source === 'core' ? 'var(--navy-light)' : `${colour}18`,
      color: source === 'core' ? 'var(--navy)' : colour,
      border: `1px solid ${source === 'core' ? 'var(--border)' : `${colour}40`}`,
      whiteSpace: 'nowrap',
    }}>
      {source === 'core' ? 'CORE' : source}
    </span>
  );
}

// ── Rule card ────────────────────────────────────────────────────────────────
function RuleCard({ rule, source, schemeActive = true, schemeColour, onToggle, effectiveTriggers, triggerSourceLabel }) {
  const [flipped, setFlipped] = useState(false);
  const showCitations = useContext(CitationsContext);
  const isActive = rule.active !== false;
  const canToggle = schemeActive; // can't toggle individual rules inside an inactive scheme
  const hasTriggers = effectiveTriggers && Object.keys(effectiveTriggers).length > 0;
  const triggerIntro = hasTriggers
    ? (triggerSourceLabel
      ? `This card appears when the procurement profile matches these inputs from ${triggerSourceLabel}.`
      : 'This card appears when the procurement profile matches these inputs.')
    : 'No specific trigger inputs are defined for this card.';

  return (
    <div style={{ perspective: '1200px', minHeight: '255px' }}>
      <div
        onClick={() => setFlipped(v => !v)}
        role="button"
        tabIndex={0}
        aria-label={`Flip ${rule.title} card`}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped(v => !v);
          }
        }}
        style={{
          position: 'relative',
          minHeight: '255px',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--white)',
          border: `1px solid ${isActive && schemeActive ? 'var(--border)' : '#E2E8F0'}`,
          borderRadius: '10px',
          padding: '1rem 1.1rem',
          opacity: (!isActive || !schemeActive) ? 0.55 : 1,
          transition: 'all 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          boxSizing: 'border-box',
          backfaceVisibility: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)',
                  letterSpacing: '0.05em', fontFamily: 'monospace',
                }}>
                  {rule.id}
                </span>
                <SourceBadge source={source} schemeColour={schemeColour} />
                {!isActive && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    disabled
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '0.88rem', fontWeight: 700,
                color: isActive && schemeActive ? 'var(--navy)' : 'var(--text-muted)',
                lineHeight: 1.3,
              }}>
                {rule.title}
              </div>
            </div>
            <div onClick={e => e.stopPropagation()}>
              <Toggle active={isActive} onToggle={onToggle} disabled={!canToggle} />
            </div>
          </div>

          <p style={{
            fontSize: '0.78rem', color: 'var(--text-secondary)',
            lineHeight: 1.55, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {rule.body}
          </p>

          {showCitations && rule.policy && (
            <div style={{
              fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic',
              borderTop: '1px solid var(--off-white)', paddingTop: '0.45rem',
              marginTop: 'auto',
            }}>
              {rule.policy}
            </div>
          )}

          <div style={{ fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 700, marginTop: '0.1rem' }}>
            Click to see trigger inputs
          </div>
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          background: hasTriggers ? '#F8FAFC' : '#FFF7ED',
          border: `1px solid ${hasTriggers ? 'var(--border)' : '#FED7AA'}`,
          borderRadius: '10px',
          padding: '1rem 1.1rem',
          opacity: (!isActive || !schemeActive) ? 0.55 : 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxSizing: 'border-box',
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
                {rule.id}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.3, marginTop: '0.2rem' }}>
                Trigger Inputs
              </div>
            </div>
            <div onClick={e => e.stopPropagation()}>
              <SourceBadge source={source} schemeColour={schemeColour} />
            </div>
          </div>

          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {triggerIntro}
          </p>

          {hasTriggers ? (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Match all active dimensions
              </div>
              <TriggerBlock triggers={effectiveTriggers} />
            </>
          ) : (
            <div style={{
              fontSize: '0.75rem', lineHeight: 1.5, color: '#9A3412',
              background: '#FFF7ED', border: '1px solid #FED7AA',
              borderRadius: '8px', padding: '0.7rem 0.8rem',
            }}>
              This card does not have a stored trigger definition to display.
            </div>
          )}

          <div style={{ fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 700, marginTop: 'auto' }}>
            Click to return to the rule summary
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'var(--white)',
      border: `1px solid ${isActive && schemeActive ? 'var(--border)' : '#E2E8F0'}`,
      borderRadius: '10px',
      padding: '1rem 1.1rem',
      opacity: (!isActive || !schemeActive) ? 0.55 : 1,
      transition: 'all 0.15s',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)',
              letterSpacing: '0.05em', fontFamily: 'monospace',
            }}>
              {rule.id}
            </span>
            <SourceBadge source={source} schemeColour={schemeColour} />
            {!isActive && (
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                disabled
              </span>
            )}
          </div>
          <div style={{
            fontSize: '0.88rem', fontWeight: 700,
            color: isActive && schemeActive ? 'var(--navy)' : 'var(--text-muted)',
            lineHeight: 1.3,
          }}>
            {rule.title}
          </div>
        </div>
        <Toggle active={isActive} onToggle={onToggle} disabled={!canToggle} />
      </div>

      {/* Triggers */}
      {rule.trigger && <TriggerBlock triggers={rule.trigger} />}

      {/* Body — collapsed by default, expand on click */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer' }}
      >
        <p style={{
          fontSize: '0.78rem', color: 'var(--text-secondary)',
          lineHeight: 1.55, margin: 0,
          display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {rule.body}
        </p>
        {rule.body && rule.body.length > 180 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
            {expanded ? '▲ Less' : '▼ More'}
          </span>
        )}
      </div>

      {/* Policy reference */}
      {rule.policy && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--off-white)', paddingTop: '0.4rem' }}>
          {rule.policy}
        </div>
      )}
    </div>
  );
}

// ── Pre-check card (informational, no toggle) ────────────────────────────────
function PreCheckCard({ pc, schemeColour }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: '#FFFBEB',
      border: '1px solid #FDE68A',
      borderRadius: '10px',
      padding: '1rem 1.1rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#92400E', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {pc.id}
        </span>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          PRE-CHECK
        </span>
      </div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#78350F', lineHeight: 1.3 }}>{pc.title}</div>
      <div onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <p style={{
          fontSize: '0.78rem', color: '#92400E', lineHeight: 1.55, margin: 0,
          display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{pc.body}</p>
        {pc.body && pc.body.length > 140 && (
          <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
            {expanded ? '▲ Less' : '▼ More'}
          </span>
        )}
      </div>
      {pc.link && (
        <a href={pc.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#D97706', borderTop: '1px solid #FDE68A', paddingTop: '0.4rem', textDecoration: 'none' }}>
          {pc.link} ↗
        </a>
      )}
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────────────────────
function SectionDivider({ label, count, activeCount }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0 0.25rem' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {activeCount !== undefined ? `${activeCount} / ${count} active` : `${count}`}
      </span>
    </div>
  );
}

// ── Sidebar source item ──────────────────────────────────────────────────────
function SourceItem({ label, sublabel, active, selected, oblCount, activeOblCount, onClick, onToggleScheme, isCore }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: selected ? 'var(--teal-light)' : 'none',
        border: 'none', borderLeft: selected ? '3px solid var(--teal)' : '3px solid transparent',
        borderRadius: selected ? '0 8px 8px 0' : '0',
        padding: '0.6rem 0.75rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--off-white)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'none'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8rem', fontWeight: selected ? 700 : 600,
          color: (!isCore && !active) ? 'var(--text-muted)' : (selected ? 'var(--teal-dark)' : 'var(--navy)'),
          lineHeight: 1.25,
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem', lineHeight: 1.3 }}>
            {sublabel}
          </div>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {activeOblCount} / {oblCount} rules active
        </div>
      </div>
      {!isCore && (
        <Toggle active={active} onToggle={e => { onToggleScheme(); }} size="sm" />
      )}
    </button>
  );
}

// ── Add rule button ──────────────────────────────────────────────────────────
function AddButton({ label, onClick, colour }) {
  const c = colour || 'var(--teal)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        background: 'none', border: `1px dashed ${c}80`,
        borderRadius: '7px', padding: '0.35rem 0.75rem',
        fontSize: '0.75rem', fontWeight: 600, color: c,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${c}10`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      + {label}
    </button>
  );
}

// ── Inline add-rule form ─────────────────────────────────────────────────────
function AddRuleForm({ type, triggerOptions, schemeColour, onSubmit, onCancel }) {
  const accent = schemeColour || 'var(--teal)';
  const [f, setF] = useState({ title: '', body: '', policy: '', link: '', role: '', note: '', after_step: '0', steps_raw: '' });
  const [triggers, setTriggers] = useState({});  // { key: [value, ...] }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [showTriggers, setShowTriggers] = useState(false);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const toggleTriggerVal = (key, val) => {
    setTriggers(prev => {
      const cur = prev[key] || [];
      const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
      const updated = { ...prev };
      if (next.length === 0) delete updated[key]; else updated[key] = next;
      return updated;
    });
  };

  const handleSubmit = async () => {
    setSaving(true); setErr(null);
    try {
      let data = {};
      if (type === 'obligation' || type === 'core_obligation') {
        if (!f.title.trim() || !f.body.trim() || !f.policy.trim())
          throw new Error('Title, description, and policy reference are all required.');
        data = { title: f.title.trim(), body: f.body.trim(), policy: f.policy.trim(), active: true };
        if (type === 'core_obligation') {
          const t = Object.fromEntries(Object.entries(triggers).filter(([, v]) => v.length > 0));
          if (Object.keys(t).length > 0) data.trigger = t;
        }
      } else if (type === 'pre_check') {
        if (!f.title.trim() || !f.body.trim())
          throw new Error('Title and description are required.');
        data = { title: f.title.trim(), body: f.body.trim(), active: true };
        if (f.link.trim()) data.link = f.link.trim();
      } else if (type === 'step_injection') {
        const steps = f.steps_raw.split('\n').map(s => s.trim()).filter(Boolean);
        if (steps.length === 0) throw new Error('At least one step is required.');
        data = { after_step: parseInt(f.after_step, 10) || 0, steps };
      } else if (type === 'approval_addition') {
        if (!f.role.trim()) throw new Error('Role is required.');
        data = { role: f.role.trim(), note: f.note.trim() };
      }
      await onSubmit(data);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const TYPE_LABELS = {
    obligation: 'Add Obligation',
    core_obligation: 'Add Core Rule',
    pre_check: 'Add Pre-check',
    step_injection: 'Add Step Injection',
    approval_addition: 'Add Approval Requirement',
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid var(--border)', borderRadius: '6px',
    padding: '0.5rem 0.625rem', fontSize: '0.82rem',
    color: 'var(--text-primary)', background: 'var(--white)',
    outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle = {
    fontSize: '0.68rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block',
  };

  return (
    <div style={{
      background: 'var(--white)', border: `1px solid ${accent}40`,
      borderLeft: `3px solid ${accent}`, borderRadius: '0 10px 10px 0',
      padding: '1rem 1.1rem', marginTop: '0.5rem',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: accent, marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {TYPE_LABELS[type] || 'Add Rule'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

        {/* Common: title */}
        {['obligation', 'core_obligation', 'pre_check'].includes(type) && (
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={f.title} onChange={e => set('title', e.target.value)} placeholder="Short descriptive title" />
          </div>
        )}

        {/* Common: body / description */}
        {['obligation', 'core_obligation', 'pre_check'].includes(type) && (
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={f.body} onChange={e => set('body', e.target.value)}
              placeholder="Plain English — what must be done"
            />
          </div>
        )}

        {/* Obligation: policy reference */}
        {['obligation', 'core_obligation'].includes(type) && (
          <div>
            <label style={labelStyle}>Policy / Act reference *</label>
            <input style={inputStyle} value={f.policy} onChange={e => set('policy', e.target.value)} placeholder="e.g. Procurement Policy Framework s4.2" />
          </div>
        )}

        {/* Pre-check: optional link */}
        {type === 'pre_check' && (
          <div>
            <label style={labelStyle}>Link (optional)</label>
            <input style={inputStyle} value={f.link} onChange={e => set('link', e.target.value)} placeholder="https://..." />
          </div>
        )}

        {/* Step injection */}
        {type === 'step_injection' && (
          <>
            <div>
              <label style={labelStyle}>Insert after step #</label>
              <input style={{ ...inputStyle, width: '100px' }} type="number" min="0" value={f.after_step} onChange={e => set('after_step', e.target.value)} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Use 0 to inject before the process starts.</div>
            </div>
            <div>
              <label style={labelStyle}>Steps to inject (one per line) *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }}
                value={f.steps_raw} onChange={e => set('steps_raw', e.target.value)}
                placeholder={"Step one text\nStep two text"}
              />
            </div>
          </>
        )}

        {/* Approval addition */}
        {type === 'approval_addition' && (
          <>
            <div>
              <label style={labelStyle}>Role / Sign-off required *</label>
              <input style={inputStyle} value={f.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Privacy Team clearance" />
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input style={inputStyle} value={f.note} onChange={e => set('note', e.target.value)} placeholder="Why this sign-off is required" />
            </div>
          </>
        )}

        {/* Core obligation: optional trigger builder */}
        {type === 'core_obligation' && triggerOptions && (
          <div>
            <button
              type="button"
              onClick={() => setShowTriggers(t => !t)}
              style={{ background: 'none', border: 'none', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {showTriggers ? '▼' : '▶'} Trigger conditions {Object.keys(triggers).length > 0 ? `(${Object.values(triggers).flat().length} selected)` : '(optional)'}
            </button>
            {showTriggers && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--off-white)', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Rule applies when procurement profile matches <strong>any selected value</strong> in <strong>all active dimensions</strong>.
                </div>
                {Object.entries(triggerOptions).map(([key, vals]) => {
                  const c = TRIGGER_COLOURS[key] || TRIGGER_COLOURS.org;
                  const selected = triggers[key] || [];
                  return (
                    <div key={key}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                        {TRIGGER_KEY_LABELS[key] || key}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {vals.map(v => {
                          const active = selected.includes(v);
                          return (
                            <button
                              key={v} type="button"
                              onClick={() => toggleTriggerVal(key, v)}
                              style={{
                                fontSize: '0.68rem', fontWeight: active ? 700 : 500,
                                padding: '3px 8px', borderRadius: '99px',
                                border: `1px solid ${active ? c.border : 'var(--border)'}`,
                                background: active ? c.bg : 'var(--white)',
                                color: active ? c.text : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.1s',
                              }}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {err && (
          <div style={{ fontSize: '0.78rem', color: '#DC2626', background: '#FEF2F2', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.125rem' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              background: accent, color: 'white', border: 'none', borderRadius: '6px',
              padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.45rem 0.875rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InternalTabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        borderBottom: active ? '3px solid var(--teal)' : '3px solid transparent',
        background: active ? 'rgba(0,178,169,0.08)' : 'transparent',
        color: active ? 'var(--navy)' : 'var(--text-muted)',
        fontSize: '0.78rem',
        fontWeight: active ? 800 : 700,
        padding: '0.8rem 1rem 0.65rem',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function FindingCard({ finding, recordsById }) {
  const severity = FINDING_SEVERITY_COLOURS[finding.severity] || FINDING_SEVERITY_COLOURS.info;
  const affected = (finding.affected_rule_ids || [])
    .slice(0, 4)
    .map(id => recordsById[id] ? { label: recordsById[id].title, key: recordsById[id].stableId } : { label: id, key: id });

  return (
    <div style={{
      background: 'var(--white)',
      border: `1px solid ${severity.border}`,
      borderLeft: `4px solid ${severity.text}`,
      borderRadius: '10px',
      padding: '0.95rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: severity.text,
          background: severity.bg,
          border: `1px solid ${severity.border}`,
          borderRadius: '99px',
          padding: '2px 8px',
        }}>
          {finding.severity}
        </span>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: finding.source === 'ai' ? '#7C3AED' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {finding.source === 'ai' ? 'AI insight' : 'Deterministic heuristic'}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Confidence {Math.round((finding.confidence || 0) * 100)}%
        </span>
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.35 }}>
        {finding.summary}
      </div>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {finding.rationale}
      </p>
      {affected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {affected.map(record => (
            <span key={record.key} style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '99px',
              background: 'var(--navy-light)',
              color: 'var(--navy)',
              border: '1px solid var(--border)',
            }}>
              {record.label}
            </span>
          ))}
        </div>
      )}
      {finding.recommendation && (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Recommendation: {finding.recommendation}
        </div>
      )}
    </div>
  );
}

function SectionEmpty({ text }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px dashed var(--border)',
      borderRadius: '10px',
      padding: '1rem',
      fontSize: '0.78rem',
      color: 'var(--text-muted)',
    }}>
      {text}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 31, 61, 0.56)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 2000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 'min(860px, 100%)',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--white)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.15rem',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'var(--white)',
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.45rem 0.7rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function buildScenarioSeed(index = 1) {
  return {
    id: `scenario-${Date.now()}-${index}`,
    case_id: `scenario-${index}`,
    case_name: `Scenario ${index}`,
    facts: {
      category: 'consulting',
      value: 'medium',
      purpose: 'new',
      market: 'unknown',
      impact: 'medium',
      interaction: 'tender',
      timing: 'normal',
      org: 'corporate',
      overlays: [],
    },
  };
}

function buildScenarioFromFacts(facts = {}, index = 1, caseName = `Scenario ${index}`) {
  return {
    ...buildScenarioSeed(index),
    case_name: caseName,
    facts: {
      category: 'consulting',
      value: 'medium',
      purpose: 'new',
      market: 'some',
      impact: 'medium',
      interaction: 'tender',
      timing: 'normal',
      org: 'corporate',
      overlays: [],
      ...facts,
    },
  };
}

function deriveFactsFromConditions(conditions = []) {
  const facts = {};
  conditions.forEach(condition => {
    if (!condition?.field) return;
    const rawValue = condition.value;
    if (condition.operator === 'contains_any') {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      facts[condition.field] = values.filter(Boolean);
      return;
    }
    if (condition.operator === 'in') {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      if (values.length > 0) facts[condition.field] = values[0];
      return;
    }
    if (rawValue != null && rawValue !== '') {
      facts[condition.field] = rawValue;
    }
  });
  return facts;
}

function deriveClusterScenariosFromRules(ruleIds = [], platformRules = []) {
  const rules = ruleIds
    .map(ruleId => platformRules.find(rule => rule.rule_id === ruleId))
    .filter(Boolean);

  if (rules.length === 0) {
    return [buildScenarioSeed(1)];
  }

  const scenarioSeeds = [];
  const firstRuleFacts = deriveFactsFromConditions(rules[0].conditions || []);
  scenarioSeeds.push(buildScenarioFromFacts(firstRuleFacts, 1, `Lead rule scenario: ${rules[0].title}`));

  if (rules.length > 1) {
    const overlapFacts = {};
    const byField = {};
    rules.forEach(rule => {
      (rule.conditions || []).forEach(condition => {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        byField[condition.field] = byField[condition.field] || [];
        byField[condition.field].push(values.filter(Boolean).map(String));
      });
    });
    Object.entries(byField).forEach(([field, entries]) => {
      if (entries.length < 2) return;
      const shared = entries.reduce((acc, values) => acc.filter(value => values.includes(value)));
      if (shared.length === 0) return;
      overlapFacts[field] = field === 'overlays' ? shared : shared[0];
    });
    if (Object.keys(overlapFacts).length > 0) {
      scenarioSeeds.push(buildScenarioFromFacts(overlapFacts, 2, 'Cluster overlap scenario'));
    }
  }

  const unionFacts = {};
  rules.forEach(rule => {
    const facts = deriveFactsFromConditions(rule.conditions || []);
    Object.entries(facts).forEach(([field, value]) => {
      if (field === 'overlays') {
        const current = Array.isArray(unionFacts.overlays) ? unionFacts.overlays : [];
        const next = Array.isArray(value) ? value : [value];
        unionFacts.overlays = [...new Set([...current, ...next.filter(Boolean)])];
      } else if (!(field in unionFacts) && value != null && value !== '') {
        unionFacts[field] = value;
      }
    });
  });
  unionFacts.market = unionFacts.market || 'limited';
  unionFacts.impact = unionFacts.impact || 'high';
  unionFacts.timing = unionFacts.timing || 'compressed';
  unionFacts.value = unionFacts.value || 'high';
  scenarioSeeds.push(buildScenarioFromFacts(unionFacts, 3, 'Cluster stress scenario'));

  return scenarioSeeds.slice(0, 3);
}

const SIM_LAB_STORAGE_KEY = 'rules-simulation-lab-packages-v1';

function buildPackageMeta() {
  return {
    status: 'draft',
    owner: '',
    note: '',
  };
}

function buildDraftFromRule(rule) {
  return {
    rule_id: rule?.rule_id || `candidate:${Date.now()}`,
    rule_type: rule?.rule_type || 'obligation',
    source_type: rule?.source_type || 'policy_candidate',
    source_id: rule?.source_id || 'simulation_lab',
    source_name: rule?.source_name || 'Simulation Lab',
    title: rule?.title || '',
    summary: rule?.summary || '',
    active: rule?.active ?? true,
    priority: rule?.priority ?? 50,
    precedence: rule?.precedence ?? 50,
    tags: rule?.tags?.join(', ') || '',
    objectives: rule?.objectives?.join(', ') || '',
    conditions: rule?.conditions?.length ? rule.conditions.map(condition => ({
      field: condition.field,
      operator: condition.operator,
      value: Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value ?? ''),
    })) : [{ field: 'category', operator: 'in', value: '' }],
    effects: rule?.effects?.length ? rule.effects.map(effect => ({
      effect_type: effect.effect_type,
      title: effect.title,
      detail: effect.detail,
    })) : [{ effect_type: 'obligation', title: '', detail: '' }],
    provenance: {
      source_id: rule?.provenance?.[0]?.source_id || 'simulation_lab',
      source_name: rule?.provenance?.[0]?.source_name || 'Simulation Lab',
      citation: rule?.provenance?.[0]?.citation || '',
      confidence: rule?.provenance?.[0]?.confidence ?? 0.75,
    },
  };
}

function serialiseDraftRule(draft) {
  return {
    rule_id: draft.rule_id.trim(),
    rule_type: draft.rule_type,
    source_type: draft.source_type,
    source_id: draft.source_id.trim(),
    source_name: draft.source_name.trim(),
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    active: draft.active,
    priority: Number(draft.priority) || 50,
    precedence: Number(draft.precedence) || 50,
    tags: draft.tags.split(',').map(item => item.trim()).filter(Boolean),
    objectives: draft.objectives.split(',').map(item => item.trim()).filter(Boolean),
    conditions: draft.conditions
      .map(condition => {
        const raw = condition.value.split(',').map(item => item.trim()).filter(Boolean);
        const value = condition.operator === 'eq' ? (raw[0] || '') : raw;
        return condition.field && (Array.isArray(value) ? value.length : value)
          ? { field: condition.field, operator: condition.operator, value }
          : null;
      })
      .filter(Boolean),
    effects: draft.effects
      .map(effect => effect.title.trim() && effect.detail.trim()
        ? { effect_type: effect.effect_type, title: effect.title.trim(), detail: effect.detail.trim(), metadata: {} }
        : null)
      .filter(Boolean),
    provenance: [{
      source_id: draft.provenance.source_id.trim() || 'simulation_lab',
      source_name: draft.provenance.source_name.trim() || 'Simulation Lab',
      citation: draft.provenance.citation.trim() || null,
      confidence: Number(draft.provenance.confidence) || 0.75,
    }],
    metadata: {},
  };
}

function ScenarioEditor({ scenario, triggerOptions, onChange, onRemove }) {
  const setField = (field, value) => onChange({
    ...scenario,
    facts: { ...scenario.facts, [field]: value },
  });

  const toggleOverlay = overlay => {
    const current = scenario.facts.overlays || [];
    const next = current.includes(overlay)
      ? current.filter(item => item !== overlay)
      : [...current, overlay];
    setField('overlays', next);
  };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input value={scenario.case_name} onChange={e => onChange({ ...scenario, case_name: e.target.value })} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.84rem' }} />
        <button onClick={onRemove} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>Remove</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
        {['category', 'value', 'purpose', 'market', 'impact', 'interaction', 'timing', 'org'].map(field => (
          <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {field}
            <select value={scenario.facts[field] || ''} onChange={e => setField(field, e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--white)' }}>
              <option value="">Unset</option>
              {(triggerOptions?.[field] || []).map(value => <option key={value} value={value}>{humaniseTriggerValue(value)}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          Overlays
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {(triggerOptions?.overlays || []).map(overlay => {
            const active = (scenario.facts.overlays || []).includes(overlay);
            return (
              <button
                key={overlay}
                type="button"
                onClick={() => toggleOverlay(overlay)}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: active ? 700 : 500,
                  padding: '4px 8px',
                  borderRadius: '99px',
                  border: `1px solid ${active ? '#C7D2FE' : 'var(--border)'}`,
                  background: active ? '#EEF2FF' : 'var(--white)',
                  color: active ? '#3730A3' : 'var(--text-muted)',
                }}
              >
                {humaniseTriggerValue(overlay)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RuleDraftEditor({ draft, setDraft, triggerOptions }) {
  const setCondition = (index, key, value) => {
    const next = [...draft.conditions];
    next[index] = { ...next[index], [key]: value };
    setDraft({ ...draft, conditions: next });
  };
  const setEffect = (index, key, value) => {
    const next = [...draft.effects];
    next[index] = { ...next[index], [key]: value };
    setDraft({ ...draft, effects: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
        {[
          ['rule_id', 'Rule ID'],
          ['source_id', 'Source ID'],
          ['source_name', 'Source name'],
          ['title', 'Title'],
        ].map(([field, label]) => (
          <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
            <input value={draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.value })} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }} />
          </label>
        ))}
      </div>
      <textarea value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="Rule summary / policy statement" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.7rem 0.8rem', fontSize: '0.82rem', minHeight: '84px', resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Rule type
          <select value={draft.rule_type} onChange={e => setDraft({ ...draft, rule_type: e.target.value })} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}>
            {['obligation', 'pre_check', 'workflow', 'approval', 'advisory'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Source type
          <select value={draft.source_type} onChange={e => setDraft({ ...draft, source_type: e.target.value })} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}>
            {['core', 'scheme', 'policy_candidate'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Priority
          <input type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Precedence
          <input type="number" value={draft.precedence} onChange={e => setDraft({ ...draft, precedence: e.target.value })} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }} />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
        <input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="Tags, comma separated" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }} />
        <input value={draft.objectives} onChange={e => setDraft({ ...draft, objectives: e.target.value })} placeholder="Objectives, comma separated" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conditions</div>
          <button type="button" onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, { field: 'category', operator: 'in', value: '' }] })} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.35rem 0.55rem', fontSize: '0.72rem', color: 'var(--teal-dark)', fontWeight: 700 }}>+ condition</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {draft.conditions.map((condition, index) => (
            <div key={`cond-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 1.4fr auto', gap: '0.45rem' }}>
              <select value={condition.field} onChange={e => setCondition(index, 'field', e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }}>
                {Object.keys(triggerOptions || {}).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={condition.operator} onChange={e => setCondition(index, 'operator', e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }}>
                {['eq', 'in', 'contains_any'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <input value={condition.value} onChange={e => setCondition(index, 'value', e.target.value)} placeholder="value or comma-separated values" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }} />
              <button type="button" onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, itemIndex) => itemIndex !== index) })} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '0.45rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>x</button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Effects</div>
          <button type="button" onClick={() => setDraft({ ...draft, effects: [...draft.effects, { effect_type: 'obligation', title: '', detail: '' }] })} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.35rem 0.55rem', fontSize: '0.72rem', color: 'var(--teal-dark)', fontWeight: 700 }}>+ effect</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {draft.effects.map((effect, index) => (
            <div key={`eff-${index}`} style={{ display: 'grid', gridTemplateColumns: '0.9fr 1fr 1.7fr auto', gap: '0.45rem' }}>
              <select value={effect.effect_type} onChange={e => setEffect(index, 'effect_type', e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }}>
                {['obligation', 'pre_check', 'workflow_step', 'approval', 'advisory'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <input value={effect.title} onChange={e => setEffect(index, 'title', e.target.value)} placeholder="effect title" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }} />
              <input value={effect.detail} onChange={e => setEffect(index, 'detail', e.target.value)} placeholder="effect detail" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.48rem 0.6rem', fontSize: '0.8rem' }} />
              <button type="button" onClick={() => setDraft({ ...draft, effects: draft.effects.filter((_, itemIndex) => itemIndex !== index) })} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '0.45rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>x</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareResultCard({ result }) {
  if (!result) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Stat label="Matched rules delta" value={result.aggregate_delta.matched_rules || 0} total={0} />
          <Stat label="Obligation delta" value={result.aggregate_delta.obligations || 0} total={0} />
          <Stat label="Workflow delta" value={result.aggregate_delta.workflow_steps || 0} total={0} />
          <Stat label="Approval delta" value={result.aggregate_delta.approvals || 0} total={0} />
        </div>
      </div>
      {result.scenario_deltas.map(delta => (
        <div key={delta.case_id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--navy)' }}>{delta.case_name || delta.case_id}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.55rem' }}>
            {Object.entries(delta.delta_counts).map(([key, value]) => (
              <div key={key} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{key.replace('_', ' ')}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: value > 0 ? '#B91C1C' : value < 0 ? '#15803D' : 'var(--navy)' }}>
                  {value > 0 ? `+${value}` : value}
                </div>
              </div>
            ))}
          </div>
          {(delta.added_rule_ids.length > 0 || delta.removed_rule_ids.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Added matched rules</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {delta.added_rule_ids.length > 0 ? delta.added_rule_ids.map(ruleId => <span key={ruleId} style={{ fontSize: '0.68rem', padding: '3px 7px', borderRadius: '99px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>{ruleId}</span>) : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Removed matched rules</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {delta.removed_rule_ids.length > 0 ? delta.removed_rule_ids.map(ruleId => <span key={ruleId} style={{ fontSize: '0.68rem', padding: '3px 7px', borderRadius: '99px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>{ruleId}</span>) : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AssistResultCard({ result, recordsById, onApply }) {
  if (!result) return null;
  const suggestedRules = result.proposed_changes || [];
  const suggestedScenarios = result.suggested_scenarios || [];
  const findings = result.findings || [];

  return (
    <div style={{
      background: result.mode === 'ai' ? '#F5F3FF' : '#EFF6FF',
      border: `1px solid ${result.mode === 'ai' ? '#DDD6FE' : '#BFDBFE'}`,
      borderRadius: '12px',
      padding: '1rem 1.1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: result.mode === 'ai' ? '#6D28D9' : '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {result.mode === 'ai' ? 'AI-assisted extraction' : 'Heuristic extraction'}
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--navy)', marginTop: '0.2rem' }}>{result.package_name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.55 }}>
            {result.summary}
          </div>
        </div>
        <button
          onClick={onApply}
          disabled={suggestedRules.length === 0}
          style={{
            background: 'var(--navy)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            opacity: suggestedRules.length === 0 ? 0.6 : 1,
          }}
        >
          Load Into Simulation Lab
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
        <Stat label="Candidate rules" value={suggestedRules.length} total={0} />
        <Stat label="Suggested scenarios" value={suggestedScenarios.length} total={0} />
        <Stat label="AI findings" value={findings.length} total={0} />
      </div>
      {result.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {result.warnings.map((warning, index) => (
            <div key={`assist-warning-${index}`} style={{ fontSize: '0.76rem', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '0.55rem 0.7rem' }}>
              {warning}
            </div>
          ))}
        </div>
      )}
      {suggestedRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate rules</div>
          {suggestedRules.map((change, index) => (
            <div key={`assist-rule-${index}`} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 0.8rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--navy)' }}>{change.rule?.title || change.rule?.rule_id || `Candidate ${index + 1}`}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>{change.rule?.summary || change.rationale}</div>
            </div>
          ))}
        </div>
      )}
      {findings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.7rem' }}>
          {findings.map(finding => (
            <FindingCard key={finding.finding_id} finding={finding} recordsById={recordsById} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildConnectedComponents(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map(nodeId => [nodeId, new Set()]));
  edges.forEach(edge => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });
  const visited = new Set();
  const components = [];

  nodeIds.forEach(nodeId => {
    if (visited.has(nodeId)) return;
    const stack = [nodeId];
    const component = [];
    visited.add(nodeId);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      (adjacency.get(current) || []).forEach(next => {
        if (visited.has(next)) return;
        visited.add(next);
        stack.push(next);
      });
    }
    components.push(component);
  });

  return components.sort((a, b) => b.length - a.length);
}

function RulesVisualisationView({ onOpenClusterInModel }) {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusNodeId, setFocusNodeId] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [groupingMode, setGroupingMode] = useState('type');
  const [relationFilter, setRelationFilter] = useState({
    contains_rule: true,
    triggers_rule: true,
    supports_objective: true,
    shares_source: false,
    similar_rule: true,
    conflicts_with: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlatformGraph()
      .then(payload => {
        if (cancelled) return;
        setGraph(payload);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Unable to load rules graph');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRelations = useMemo(
    () => Object.entries(relationFilter).filter(([, enabled]) => enabled).map(([key]) => key),
    [relationFilter]
  );

  const prepared = useMemo(() => {
    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];
    const allowedNodes = new Map(
      nodes
        .filter(node => {
          if (!activeOnly) return true;
          if (node.node_type !== 'rule') return true;
          return node.metadata?.active !== false;
        })
        .map(node => [node.node_id, node])
    );
    const filteredEdges = edges.filter(edge =>
      visibleRelations.includes(edge.relation)
      && allowedNodes.has(edge.source)
      && allowedNodes.has(edge.target)
    );
    let selectedEdges = filteredEdges;
    let selectedNodes = new Map(allowedNodes);

    if (focusNodeId) {
      const connectedIds = new Set([focusNodeId]);
      filteredEdges.forEach(edge => {
        if (edge.source === focusNodeId || edge.target === focusNodeId) {
          connectedIds.add(edge.source);
          connectedIds.add(edge.target);
        }
      });
      selectedEdges = filteredEdges.filter(edge => connectedIds.has(edge.source) && connectedIds.has(edge.target));
      selectedNodes = new Map([...allowedNodes.entries()].filter(([nodeId]) => connectedIds.has(nodeId)));
    }

    const selectedNodeList = [...selectedNodes.values()];
    const nodeMap = new Map(selectedNodeList.map(node => [node.node_id, node]));
    const sourceNodes = selectedNodeList.filter(node => node.node_type === 'source').sort((a, b) => a.label.localeCompare(b.label));
    const signalNodes = selectedNodeList.filter(node => node.node_type === 'signal').sort((a, b) => a.label.localeCompare(b.label));
    const ruleNodes = selectedNodeList.filter(node => node.node_type === 'rule').sort((a, b) => a.label.localeCompare(b.label));
    const objectiveNodes = selectedNodeList.filter(node => node.node_type === 'objective').sort((a, b) => a.label.localeCompare(b.label));

    const ruleSourceMap = {};
    const ruleSignalFields = {};
    selectedEdges.forEach(edge => {
      if (edge.relation === 'contains_rule' && nodeMap.get(edge.target)?.node_type === 'rule') {
        ruleSourceMap[edge.target] = edge.source;
      }
      if (edge.relation === 'triggers_rule' && nodeMap.get(edge.target)?.node_type === 'rule') {
        const field = edge.metadata?.field || nodeMap.get(edge.source)?.metadata?.field || 'other';
        ruleSignalFields[edge.target] = ruleSignalFields[edge.target] || {};
        ruleSignalFields[edge.target][field] = (ruleSignalFields[edge.target][field] || 0) + 1;
      }
    });

    const nodesByType = { source: [], signal: [], rule: [], objective: [] };
    selectedNodeList.forEach(node => {
      if (nodesByType[node.node_type]) nodesByType[node.node_type].push(node);
    });
    Object.values(nodesByType).forEach(list => list.sort((a, b) => a.label.localeCompare(b.label)));
    const nodePositions = {};
    let graphWidth = 1240;
    let graphHeight = Math.max(720, Math.max(selectedNodeList.length, 1) * 46 + 160);
    const analytics = { groups: 0, groupLabel: 'Type lanes', dominantGroup: 'Rules by type', clusters: [] };

    if (groupingMode === 'type') {
      const xPositions = { source: 110, signal: 390, rule: 750, objective: 1110 };
      const maxCount = Math.max(...Object.values(nodesByType).map(list => Math.max(list.length, 1)));
      graphHeight = Math.max(720, maxCount * 76 + 120);
      const topPadding = 70;
      Object.entries(nodesByType).forEach(([type, list]) => {
        const gap = list.length > 1 ? Math.max(72, (graphHeight - topPadding * 2) / (list.length - 1)) : 0;
        list.forEach((node, index) => {
          nodePositions[node.node_id] = {
            x: xPositions[type],
            y: list.length > 1 ? topPadding + index * gap : graphHeight / 2,
          };
        });
      });
      analytics.groups = 4;
    } else if (groupingMode === 'scheme') {
      const groups = sourceNodes.map(sourceNode => ({
        sourceNode,
        rules: ruleNodes.filter(rule => ruleSourceMap[rule.node_id] === sourceNode.node_id),
      })).filter(group => group.rules.length > 0 || nodeMap.has(group.sourceNode.node_id));
      const fallbackRules = ruleNodes.filter(rule => !ruleSourceMap[rule.node_id]);
      if (fallbackRules.length > 0) {
        groups.push({ sourceNode: null, rules: fallbackRules, label: 'Unmapped rules' });
      }
      const columnWidth = 220;
      graphWidth = Math.max(1240, 260 + groups.length * columnWidth + 260);
      graphHeight = Math.max(760, Math.max(...groups.map(group => 220 + group.rules.length * 84), 0), Math.max(signalNodes.length, objectiveNodes.length) * 70 + 140);
      const leftRailX = 90;
      const rightRailX = graphWidth - 90;
      signalNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: leftRailX, y: 90 + index * 64 };
      });
      objectiveNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: rightRailX, y: 90 + index * 64 };
      });
      groups.forEach((group, groupIndex) => {
        const x = 220 + groupIndex * columnWidth;
        if (group.sourceNode) {
          nodePositions[group.sourceNode.node_id] = { x, y: 100 };
        }
        group.rules.forEach((rule, ruleIndex) => {
          nodePositions[rule.node_id] = { x, y: 220 + ruleIndex * 84 };
        });
      });
      analytics.groups = groups.length;
      analytics.groupLabel = 'Scheme groups';
      analytics.dominantGroup = groups[0]?.sourceNode?.label || groups[0]?.label || 'No source groups';
    } else if (groupingMode === 'trigger') {
      const triggerOrder = ['category', 'value', 'purpose', 'market', 'impact', 'interaction', 'timing', 'org', 'overlays', 'other'];
      const groups = triggerOrder.map(field => ({
        field,
        label: field === 'other' ? 'Other triggers' : field,
        signals: signalNodes.filter(node => (node.metadata?.field || 'other') === field),
        rules: ruleNodes.filter(rule => {
          const counts = ruleSignalFields[rule.node_id] || {};
          const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
          return dominant === field;
        }),
      })).filter(group => group.signals.length > 0 || group.rules.length > 0);
      const columnWidth = 220;
      graphWidth = Math.max(1240, 220 + groups.length * columnWidth + 220);
      graphHeight = Math.max(760, Math.max(...groups.map(group => 250 + Math.max(group.signals.length, group.rules.length) * 82), 0), sourceNodes.length * 62 + 160, objectiveNodes.length * 62 + 160);
      sourceNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: 90, y: 100 + index * 60 };
      });
      objectiveNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: graphWidth - 90, y: 100 + index * 60 };
      });
      groups.forEach((group, groupIndex) => {
        const x = 220 + groupIndex * columnWidth;
        group.signals.forEach((node, signalIndex) => {
          nodePositions[node.node_id] = { x, y: 110 + signalIndex * 62 };
        });
        group.rules.forEach((node, ruleIndex) => {
          nodePositions[node.node_id] = { x, y: 300 + ruleIndex * 82 };
        });
      });
      analytics.groups = groups.length;
      analytics.groupLabel = 'Trigger groups';
      analytics.dominantGroup = groups[0]?.label || 'No trigger groups';
    } else {
      const ruleRelationshipEdges = selectedEdges.filter(edge =>
        ['conflicts_with', 'similar_rule', 'shares_source'].includes(edge.relation)
        && nodeMap.get(edge.source)?.node_type === 'rule'
        && nodeMap.get(edge.target)?.node_type === 'rule'
      );
      const components = buildConnectedComponents(ruleNodes.map(node => node.node_id), ruleRelationshipEdges);
      const clusters = components.map((component, index) => ({
        id: `cluster-${index + 1}`,
        ruleIds: component,
        rules: component.map(ruleId => nodeMap.get(ruleId)).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label)),
        conflictCount: ruleRelationshipEdges.filter(edge => component.includes(edge.source) && component.includes(edge.target) && edge.relation === 'conflicts_with').length,
      }));
      const columnWidth = 220;
      graphWidth = Math.max(1240, 220 + clusters.length * columnWidth + 260);
      graphHeight = Math.max(760, Math.max(...clusters.map(cluster => 180 + cluster.rules.length * 84), 0), Math.max(sourceNodes.length, signalNodes.length, objectiveNodes.length) * 60 + 160);
      const leftSourceX = 80;
      const leftSignalX = 170;
      const rightObjectiveX = graphWidth - 90;
      sourceNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: leftSourceX, y: 90 + index * 58 };
      });
      signalNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: leftSignalX, y: 90 + index * 58 };
      });
      objectiveNodes.forEach((node, index) => {
        nodePositions[node.node_id] = { x: rightObjectiveX, y: 90 + index * 58 };
      });
      clusters.forEach((cluster, clusterIndex) => {
        const x = 300 + clusterIndex * columnWidth;
        cluster.rules.forEach((node, ruleIndex) => {
          nodePositions[node.node_id] = { x, y: 180 + ruleIndex * 84 };
        });
      });
      analytics.groups = clusters.length;
      analytics.groupLabel = 'Conflict clusters';
      analytics.dominantGroup = clusters[0] ? `${clusters[0].rules.length} rules in largest cluster` : 'No rule clusters';
      analytics.clusters = clusters.map(cluster => ({
        id: cluster.id,
        label: `${cluster.rules.length} related rule${cluster.rules.length === 1 ? '' : 's'}`,
        ruleIds: cluster.ruleIds,
        ruleTitles: cluster.rules.map(rule => rule.label),
        conflictCount: cluster.conflictCount,
      }));
    }

    return {
      nodes: selectedNodeList,
      edges: selectedEdges,
      nodesByType,
      positions: nodePositions,
      graphHeight,
      graphWidth,
      analytics,
    };
  }, [activeOnly, focusNodeId, graph, groupingMode, visibleRelations]);

  const nodeLabelMap = useMemo(
    () => Object.fromEntries(prepared.nodes.map(node => [node.node_id, node.label])),
    [prepared.nodes]
  );

  const selectedNode = useMemo(
    () => prepared.nodes.find(node => node.node_id === focusNodeId) || null,
    [focusNodeId, prepared.nodes]
  );

  const selectedNodeRelations = useMemo(() => {
    if (!selectedNode) return [];
    return prepared.edges.filter(edge => edge.source === selectedNode.node_id || edge.target === selectedNode.node_id);
  }, [prepared.edges, selectedNode]);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading rules relationship graph…</div>;
  }

  if (error) {
    return (
      <div style={{ margin: '1.5rem', padding: '1rem 1.1rem', color: '#991B1B', background: '#FEF2F2', borderRadius: '10px' }}>
        Unable to load the rules visualisation: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem 1.5rem', background: 'var(--off-white)', overflowY: 'auto', flex: 1 }}>
      <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f7fbff 100%)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.1rem 1.2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>Rules Relationship Visualiser</h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Graphic view of how rules connect to sources, trigger signals, policy objectives, and to each other through similarity or conflict relationships.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Stat label="Visible nodes" value={prepared.nodes.length} total={graph?.nodes?.length || 0} />
            <Stat label="Visible links" value={prepared.edges.length} total={graph?.edges?.length || 0} />
            <Stat label="Rule nodes" value={prepared.nodesByType.rule.length} total={(graph?.nodes || []).filter(node => node.node_type === 'rule').length} />
            <Stat label={prepared.analytics.groupLabel} value={prepared.analytics.groups} total={0} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '0.9rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.05rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Graph controls</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
              Show active rules only
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Grouping mode
              <select value={groupingMode} onChange={e => setGroupingMode(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', background: 'var(--white)' }}>
                <option value="type">By type</option>
                <option value="scheme">By scheme</option>
                <option value="trigger">By trigger</option>
                <option value="conflict_cluster">By conflict cluster</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Focus node
              <select value={focusNodeId} onChange={e => setFocusNodeId(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', background: 'var(--white)' }}>
                <option value="">Whole graph</option>
                {prepared.nodes
                  .slice()
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map(node => <option key={node.node_id} value={node.node_id}>{node.label} ({node.node_type})</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {Object.entries(GRAPH_RELATION_STYLES).map(([relation, style]) => (
                <label key={relation} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={relationFilter[relation]}
                    onChange={e => setRelationFilter(prev => ({ ...prev, [relation]: e.target.checked }))}
                  />
                  <span style={{ width: '10px', height: '10px', borderRadius: '99px', background: style.color, display: 'inline-block' }} />
                  {style.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.05rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Node legend</div>
            {Object.entries(GRAPH_NODE_STYLES).map(([type, style]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '99px', background: style.fill, border: `2px solid ${style.stroke}` }} />
                {type}
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.05rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected node</div>
            {selectedNode ? (
              <>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--navy)' }}>{selectedNode.label}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{selectedNode.node_type}</div>
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {Object.entries(selectedNode.metadata).slice(0, 6).map(([key, value]) => (
                      <div key={key} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        <strong style={{ color: 'var(--navy)' }}>{key}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>Connected relationships</div>
                {selectedNodeRelations.length > 0 ? selectedNodeRelations.slice(0, 8).map(edge => (
                  <div key={edge.edge_id} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {GRAPH_RELATION_STYLES[edge.relation]?.label || edge.relation}: {nodeLabelMap[edge.source === selectedNode.node_id ? edge.target : edge.source] || (edge.source === selectedNode.node_id ? edge.target : edge.source)}
                  </div>
                )) : <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>No visible relationships for this node.</div>}
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Select a node from the focus control to inspect its metadata and directly connected relationships.
              </div>
            )}
          </div>

          {groupingMode === 'conflict_cluster' && prepared.analytics.clusters.length > 0 && (
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.05rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conflict cluster drilldown</div>
              {prepared.analytics.clusters.slice(0, 6).map(cluster => (
                <div key={cluster.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 0.8rem', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)' }}>{cluster.label}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {cluster.conflictCount} conflict link{cluster.conflictCount === 1 ? '' : 's'} across {cluster.ruleIds.length} rule{cluster.ruleIds.length === 1 ? '' : 's'}.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {cluster.ruleTitles.slice(0, 4).map(title => (
                      <span key={title} style={{ fontSize: '0.66rem', padding: '2px 7px', borderRadius: '99px', background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE' }}>
                        {title}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onOpenClusterInModel?.(cluster, 'deactivate')}
                      style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      Deactivate Cluster
                    </button>
                    <button
                      onClick={() => onOpenClusterInModel?.(cluster, 'replace')}
                      style={{ background: '#0F766E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      Replace Lead Rule
                    </button>
                    <button
                      onClick={() => onOpenClusterInModel?.(cluster, 'stress')}
                      style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      Stress Test Cluster
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem', overflow: 'auto' }}>
          <svg width={prepared.graphWidth} height={prepared.graphHeight} style={{ display: 'block', minWidth: `${prepared.graphWidth}px` }}>
            <defs>
              <marker id="graphArrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#94A3B8" />
              </marker>
            </defs>
            {['source', 'signal', 'rule', 'objective'].map(type => (
              <text key={`col-${type}`} x={type === 'source' ? 110 : type === 'signal' ? 390 : type === 'rule' ? 750 : 1110} y={30} textAnchor="middle" style={{ fontSize: '12px', fontWeight: 800, fill: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {groupingMode === 'type' ? type : ''}
              </text>
            ))}

            {prepared.edges.map(edge => {
              const from = prepared.positions[edge.source];
              const to = prepared.positions[edge.target];
              if (!from || !to) return null;
              const style = GRAPH_RELATION_STYLES[edge.relation] || { color: '#94A3B8' };
              const sameColumn = from.x === to.x;
              const path = sameColumn
                ? `M ${from.x} ${from.y} C ${from.x + 110} ${from.y}, ${to.x + 110} ${to.y}, ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`;
              return (
                <path
                  key={edge.edge_id}
                  d={path}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={edge.relation === 'conflicts_with' ? 2.6 : edge.relation === 'similar_rule' ? 2.1 : 1.45}
                  strokeDasharray={edge.relation === 'similar_rule' ? '6 4' : edge.relation === 'shares_source' ? '3 4' : undefined}
                  opacity={focusNodeId ? 0.9 : 0.62}
                  markerEnd={!sameColumn && ['contains_rule', 'triggers_rule', 'supports_objective'].includes(edge.relation) ? 'url(#graphArrow)' : undefined}
                />
              );
            })}

            {prepared.nodes.map(node => {
              const pos = prepared.positions[node.node_id];
              if (!pos) return null;
              const style = GRAPH_NODE_STYLES[node.node_type] || GRAPH_NODE_STYLES.rule;
              const isFocused = focusNodeId === node.node_id;
              return (
                <g key={node.node_id} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: 'pointer' }} onClick={() => setFocusNodeId(node.node_id)}>
                  <circle r={isFocused ? 24 : 18} fill={style.fill} stroke={style.stroke} strokeWidth={isFocused ? 3 : 2} />
                  <text textAnchor="middle" y={4} style={{ fontSize: '10px', fontWeight: 800, fill: style.text }}>
                    {node.node_type === 'rule' ? 'R' : node.node_type === 'source' ? 'S' : node.node_type === 'signal' ? 'T' : 'O'}
                  </text>
                  <text textAnchor="middle" y={isFocused ? 40 : 34} style={{ fontSize: '10px', fontWeight: isFocused ? 700 : 600, fill: '#334155' }}>
                    {node.label.length > 24 ? `${node.label.slice(0, 24)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

function ModelView({ analysisBundle, schemes, schema, drilldownSeed }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('active');
  const [findingTypeFilter, setFindingTypeFilter] = useState('all');
  const [platformRules, setPlatformRules] = useState([]);
  const [platformRulesLoading, setPlatformRulesLoading] = useState(true);
  const [platformRulesError, setPlatformRulesError] = useState(null);
  const [proposalMode, setProposalMode] = useState('deactivate');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [draftRule, setDraftRule] = useState(buildDraftFromRule(null));
  const [proposedChanges, setProposedChanges] = useState([]);
  const [scenarios, setScenarios] = useState([buildScenarioSeed(1)]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [packageName, setPackageName] = useState('Working package');
  const [packageMeta, setPackageMeta] = useState(buildPackageMeta());
  const [savedPackages, setSavedPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [assistSourceName, setAssistSourceName] = useState('Working policy note');
  const [assistText, setAssistText] = useState('');
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistError, setAssistError] = useState(null);
  const [assistResult, setAssistResult] = useState(null);
  const [appliedDrilldownId, setAppliedDrilldownId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPlatformRulesLoading(true);
    setPlatformRulesError(null);
    fetchPlatformRules(false)
      .then(payload => {
        if (cancelled) return;
        const rules = payload.rules || [];
        setPlatformRules(rules);
        setSelectedRuleId(prev => prev || rules[0]?.rule_id || '');
        setPlatformRulesLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setPlatformRulesError(err.message || 'Unable to load canonical platform rules');
        setPlatformRulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPackagesLoading(true);
    setPackagesError(null);
    fetchSimulationLabPackages()
      .then(records => {
        if (cancelled) return;
        const normalized = Array.isArray(records) ? records.map(record => ({
          id: record.package_id,
          name: record.package_name,
          updated_at: record.updated_at,
          meta: record.meta || buildPackageMeta(),
          proposalMode: record.payload?.proposal_mode || 'deactivate',
          selectedRuleId: record.payload?.selected_rule_id || '',
          draftRule: record.payload?.draft_rule || buildDraftFromRule(null),
          scenarios: record.payload?.scenarios || [buildScenarioSeed(1)],
          proposedChanges: record.payload?.proposed_changes || [],
        })) : [];
        setSavedPackages(normalized);
        setSelectedPackageId(prev => prev || normalized[0]?.id || '');
        setPackagesLoading(false);
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const raw = window.localStorage.getItem(SIM_LAB_STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            setSavedPackages(parsed);
            setSelectedPackageId(prev => prev || parsed[0]?.id || '');
          }
        } catch {}
        setPackagesError('Using local-only package storage because the backend package store is unavailable.');
        setPackagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selected = platformRules.find(rule => rule.rule_id === selectedRuleId);
    if (proposalMode === 'replace' && selected) {
      setDraftRule(buildDraftFromRule(selected));
    }
  }, [platformRules, proposalMode, selectedRuleId]);

  useEffect(() => {
    if (!drilldownSeed?.id || drilldownSeed.id === appliedDrilldownId) return;
    if (drilldownSeed.scenarioMode === 'cluster_aware' && platformRules.length === 0) return;
    const derivedScenarios = drilldownSeed.scenarioMode === 'cluster_aware'
      ? deriveClusterScenariosFromRules(drilldownSeed.clusterRuleIds || [], platformRules)
      : (drilldownSeed.scenarios?.length ? drilldownSeed.scenarios : [buildScenarioSeed(1)]);
    setSelectedPackageId('');
    setPackageName(drilldownSeed.packageName || 'Conflict cluster drilldown');
    setPackageMeta(drilldownSeed.packageMeta || buildPackageMeta());
    setProposalMode(drilldownSeed.proposalMode || 'deactivate');
    setSelectedRuleId(drilldownSeed.selectedRuleId || '');
    setDraftRule(buildDraftFromRule(platformRules.find(rule => rule.rule_id === drilldownSeed.selectedRuleId) || null));
    setScenarios(derivedScenarios);
    setProposedChanges(drilldownSeed.proposedChanges || []);
    setCompareResult(null);
    setCompareError(null);
    setAppliedDrilldownId(drilldownSeed.id);
  }, [appliedDrilldownId, drilldownSeed, platformRules]);

  const recordsById = useMemo(
    () => Object.fromEntries(analysisBundle.records.map(record => [record.stableId, record])),
    [analysisBundle.records]
  );

  const filteredRecords = useMemo(() => analysisBundle.records.filter(record => {
    if (sourceFilter === 'core' && record.sourceType !== 'core') return false;
    if (sourceFilter === 'scheme' && record.sourceType !== 'scheme') return false;
    if (schemeFilter !== 'all' && record.schemeId !== schemeFilter) return false;
    if (activeFilter === 'active' && !record.effectiveActive) return false;
    if (activeFilter === 'inactive' && record.effectiveActive) return false;
    return true;
  }), [activeFilter, analysisBundle.records, schemeFilter, sourceFilter]);

  const allowedIds = new Set(filteredRecords.map(record => record.stableId));
  const filterFindings = useCallback(kind => {
    const candidates = analysisBundle.findingsByKind[kind] || [];
    return candidates.filter(finding => {
      if (findingTypeFilter !== 'all' && finding.kind !== findingTypeFilter) return false;
      if (schemeFilter === 'all' && sourceFilter === 'all' && activeFilter === 'active') {
        return finding.affected_rule_ids.length === 0 || finding.affected_rule_ids.some(id => allowedIds.has(id));
      }
      if (finding.affected_rule_ids.length === 0) return true;
      return finding.affected_rule_ids.some(id => allowedIds.has(id));
    });
  }, [activeFilter, allowedIds, analysisBundle.findingsByKind, findingTypeFilter, schemeFilter, sourceFilter]);

  const filteredFindings = {
    gaps: filterFindings('gaps'),
    duplicates: filterFindings('duplicates'),
    contradictions: filterFindings('contradictions'),
    workflow: filterFindings('workflow'),
  };

  const addProposedChange = () => {
    try {
      let nextChange = null;
      if (proposalMode === 'deactivate') {
        if (!selectedRuleId) throw new Error('Select a canonical rule to deactivate.');
        nextChange = {
          operation: 'deactivate',
          target_rule_id: selectedRuleId,
          rationale: 'Scenario modelling deactivation',
        };
      } else if (proposalMode === 'replace') {
        if (!selectedRuleId) throw new Error('Select a canonical rule to replace.');
        nextChange = {
          operation: 'replace',
          target_rule_id: selectedRuleId,
          rule: serialiseDraftRule(draftRule),
          rationale: 'Scenario modelling replacement',
        };
      } else {
        nextChange = {
          operation: 'add',
          rule: serialiseDraftRule(draftRule),
          rationale: 'Scenario modelling addition',
        };
      }
      setProposedChanges(prev => [...prev, nextChange]);
      setCompareError(null);
    } catch (err) {
      setCompareError(err.message || 'Unable to add proposed change');
    }
  };

  const runSimulationLab = async () => {
    setCompareLoading(true);
    setCompareError(null);
    try {
      const payload = {
        scenarios: scenarios.map((scenario, index) => ({
          case_id: scenario.case_id || `scenario-${index + 1}`,
          case_name: scenario.case_name,
          facts: scenario.facts,
        })),
        proposed_changes: proposedChanges,
      };
      const result = await comparePlatformSimulationLab(payload);
      setCompareResult(result);
    } catch (err) {
      setCompareError(err.message || 'Simulation lab run failed');
    } finally {
      setCompareLoading(false);
    }
  };

  const runPolicyAssist = async () => {
    if (!assistText.trim()) {
      setAssistError('Paste policy text to generate candidate rules and scenarios.');
      return;
    }
    setAssistLoading(true);
    setAssistError(null);
    try {
      const result = await assistPlatformPolicyDraft({
        source_name: assistSourceName.trim() || 'Working policy note',
        source_id: 'policy_assist',
        policy_text: assistText.trim(),
        use_ai: true,
      });
      setAssistResult(result);
    } catch (err) {
      setAssistError(err.message || 'Unable to generate an assisted modelling package');
    } finally {
      setAssistLoading(false);
    }
  };

  const applyAssistResult = () => {
    if (!assistResult) return;
    const nextScenarios = (assistResult.suggested_scenarios || []).map((scenario, index) => ({
      id: `assist-${scenario.case_id || index}-${Date.now()}`,
      case_id: scenario.case_id || `assist-scenario-${index + 1}`,
      case_name: scenario.case_name || `Assist scenario ${index + 1}`,
      facts: {
        category: 'consulting',
        value: 'medium',
        purpose: 'new',
        market: 'some',
        impact: 'medium',
        interaction: 'tender',
        timing: 'normal',
        org: 'corporate',
        overlays: [],
        ...(scenario.facts || {}),
      },
    }));
    setPackageName(assistResult.package_name || 'AI-assisted package');
    setPackageMeta(prev => ({
      ...prev,
      note: `${assistResult.mode === 'ai' ? 'AI-assisted' : 'Heuristic'} modelling draft loaded from policy text.`,
    }));
    setSelectedPackageId('');
    setProposalMode('add');
    setProposedChanges(assistResult.proposed_changes || []);
    setScenarios(nextScenarios.length ? nextScenarios : [buildScenarioSeed(1)]);
    const firstRule = assistResult.proposed_changes?.[0]?.rule;
    if (firstRule) {
      setDraftRule(buildDraftFromRule(firstRule));
    }
    setCompareResult(null);
    setCompareError(null);
  };

  const persistPackages = nextPackages => {
    setSavedPackages(nextPackages);
    try {
      window.localStorage.setItem(SIM_LAB_STORAGE_KEY, JSON.stringify(nextPackages));
    } catch {}
  };

  const saveCurrentPackage = async () => {
    const nextPackage = {
      id: selectedPackageId || `pkg-${Date.now()}`,
      name: packageName.trim() || 'Working package',
      updated_at: new Date().toISOString(),
      meta: packageMeta,
      proposalMode,
      selectedRuleId,
      draftRule,
      scenarios,
      proposedChanges,
    };
    try {
      const saved = await saveSimulationLabPackage({
        package_id: selectedPackageId || null,
        package_name: nextPackage.name,
        payload: {
          proposal_mode: proposalMode,
          selected_rule_id: selectedRuleId || null,
          draft_rule: draftRule,
          scenarios,
          proposed_changes: proposedChanges,
        },
        meta: packageMeta,
      });
      const normalized = {
        ...nextPackage,
        id: saved.package_id,
        name: saved.package_name,
        updated_at: saved.updated_at,
      };
      const existingIndex = savedPackages.findIndex(item => item.id === normalized.id);
      const nextPackages = existingIndex >= 0
        ? savedPackages.map(item => item.id === normalized.id ? normalized : item)
        : [normalized, ...savedPackages];
      persistPackages(nextPackages);
      setSelectedPackageId(normalized.id);
      setPackageName(normalized.name);
      setPackagesError(null);
    } catch (err) {
      const existingIndex = savedPackages.findIndex(item => item.id === nextPackage.id);
      const nextPackages = existingIndex >= 0
        ? savedPackages.map(item => item.id === nextPackage.id ? nextPackage : item)
        : [nextPackage, ...savedPackages];
      persistPackages(nextPackages);
      setSelectedPackageId(nextPackage.id);
      setPackageName(nextPackage.name);
      setPackagesError(err.message || 'Saved locally because the backend package store is unavailable.');
    }
  };

  const loadSavedPackage = packageId => {
    const match = savedPackages.find(item => item.id === packageId);
    if (!match) return;
    setSelectedPackageId(match.id);
    setPackageName(match.name || 'Working package');
    setPackageMeta(match.meta || buildPackageMeta());
    setProposalMode(match.proposalMode || 'deactivate');
    setSelectedRuleId(match.selectedRuleId || '');
    setDraftRule(match.draftRule || buildDraftFromRule(null));
    setScenarios(match.scenarios?.length ? match.scenarios : [buildScenarioSeed(1)]);
    setProposedChanges(match.proposedChanges || []);
    setCompareResult(null);
    setCompareError(null);
  };

  const deleteSavedPackage = async packageId => {
    try {
      await deleteSimulationLabPackage(packageId);
      setPackagesError(null);
    } catch (err) {
      setPackagesError(err.message || 'Removed locally because the backend package store is unavailable.');
    }
    const nextPackages = savedPackages.filter(item => item.id !== packageId);
    persistPackages(nextPackages);
    if (selectedPackageId === packageId) {
      setSelectedPackageId(nextPackages[0]?.id || '');
    }
  };

  const cloneSelectedRuleIntoDraft = () => {
    const selected = platformRules.find(rule => rule.rule_id === selectedRuleId);
    if (!selected) return;
    const cloned = buildDraftFromRule(selected);
    cloned.rule_id = `candidate:${selected.rule_id}:${Date.now()}`;
    cloned.source_type = 'policy_candidate';
    cloned.source_id = 'simulation_lab';
    cloned.source_name = 'Simulation Lab';
    setDraftRule(cloned);
    setProposalMode('add');
  };

  const exportCurrentPackage = () => {
    const blob = new Blob([JSON.stringify({
      version: 1,
      name: packageName,
      meta: packageMeta,
      proposalMode,
      selectedRuleId,
      draftRule,
      scenarios,
      proposedChanges,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(packageName || 'simulation-package').replace(/[^a-z0-9-_]+/gi, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPackage = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      const parsed = JSON.parse(text);
      setSelectedPackageId('');
      setPackageName(parsed.name || 'Imported package');
      setPackageMeta(parsed.meta || buildPackageMeta());
      setProposalMode(parsed.proposalMode || 'deactivate');
      setSelectedRuleId(parsed.selectedRuleId || '');
      setDraftRule(parsed.draftRule || buildDraftFromRule(null));
      setScenarios(parsed.scenarios?.length ? parsed.scenarios : [buildScenarioSeed(1)]);
      setProposedChanges(parsed.proposedChanges || []);
      setCompareResult(null);
      setCompareError(null);
    }).catch(err => {
      setPackagesError(err.message || 'Import failed');
    }).finally(() => {
      event.target.value = '';
    });
  };

  return (
    <div style={{ padding: '1.25rem 1.5rem', background: 'var(--off-white)', overflowY: 'auto', flex: 1 }}>
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f4fbfb 100%)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '1.2rem 1.25rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>Rules Engine Modelling Baseline</h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Deterministic analysis over the currently loaded rules. This baseline is AI-ready: future model-generated findings can plug into the same finding and review surface.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button
              onClick={() => setShowUsageModal(true)}
              style={{
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.7rem 0.9rem',
                fontSize: '0.76rem',
                fontWeight: 800,
                color: 'var(--navy)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              How To Use This Page
            </button>
            <Stat label="Analysed records" value={filteredRecords.length} total={analysisBundle.summaries.totalRecords} />
            <Stat label="Deterministic findings" value={Object.values(filteredFindings).reduce((sum, items) => sum + items.length, 0)} total={analysisBundle.findings.length} />
            <Stat label="Workflow schemes" value={analysisBundle.summaries.workflowSchemes.length} total={schemes.length} />
          </div>
        </div>
      </div>

      {showUsageModal && (
        <Modal title="How To Use This Page" onClose={() => setShowUsageModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The Model tab is the rules-engine workspace. Use it to inspect rule quality, build hypothetical change packages, compare baseline versus proposed behaviour, and save modelling work for later review.
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {MODEL_USAGE_INSTRUCTIONS.map((item, index) => (
                <li key={index} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </Modal>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Source
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--white)' }}>
            <option value="all">All sources</option>
            <option value="core">Core only</option>
            <option value="scheme">Schemes only</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Scheme
          <select value={schemeFilter} onChange={e => setSchemeFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--white)' }}>
            <option value="all">All schemes</option>
            {schemes.map(scheme => (
              <option key={scheme.scheme_id} value={scheme.scheme_id}>{scheme.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          State
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--white)' }}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All states</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Finding type
          <select value={findingTypeFilter} onChange={e => setFindingTypeFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--white)' }}>
            <option value="all">All findings</option>
            {Object.entries(FINDING_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{
        background: '#F5F3FF',
        border: '1px solid #DDD6FE',
        borderRadius: '12px',
        padding: '1rem 1.1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            AI-assisted modelling
          </div>
          <div style={{ fontSize: '0.82rem', color: '#5B21B6', lineHeight: 1.55 }}>
            Paste policy text and generate a candidate modelling package. If an AI provider is configured the backend will use it; otherwise it falls back to deterministic extraction and still feeds the same governed workflow.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr auto', gap: '0.7rem', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Source name
            <input value={assistSourceName} onChange={e => setAssistSourceName(e.target.value)} style={{ border: '1px solid #C4B5FD', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', background: 'var(--white)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Policy text
            <textarea value={assistText} onChange={e => setAssistText(e.target.value)} placeholder="Paste policy text, directives, manual extracts, or draft rule wording here." style={{ border: '1px solid #C4B5FD', borderRadius: '8px', padding: '0.7rem 0.8rem', fontSize: '0.82rem', minHeight: '100px', resize: 'vertical', background: 'var(--white)' }} />
          </label>
          <button onClick={runPolicyAssist} disabled={assistLoading} style={{ background: '#6D28D9', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 0.95rem', fontSize: '0.78rem', fontWeight: 700, opacity: assistLoading ? 0.7 : 1 }}>
            {assistLoading ? 'Generating…' : 'Generate candidate package'}
          </button>
        </div>
        {assistError && (
          <div style={{ fontSize: '0.76rem', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
            {assistError}
          </div>
        )}
        {assistResult && <AssistResultCard result={assistResult} recordsById={recordsById} onApply={applyAssistResult} />}
      </div>

      <div style={{ marginBottom: '1.25rem', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(220px, 1fr) auto auto auto', gap: '0.6rem', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Package name
            <input value={packageName} onChange={e => setPackageName(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Saved packages
            <select value={selectedPackageId} onChange={e => { setSelectedPackageId(e.target.value); loadSavedPackage(e.target.value); }} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', background: 'var(--white)' }}>
              <option value="">No saved package selected</option>
              {savedPackages.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <button onClick={saveCurrentPackage} style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}>Save package</button>
          <button onClick={() => { setSelectedPackageId(''); setPackageName('Working package'); setScenarios([buildScenarioSeed(1)]); setProposedChanges([]); setDraftRule(buildDraftFromRule(null)); setCompareResult(null); setCompareError(null); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>New package</button>
          <button onClick={() => selectedPackageId && deleteSavedPackage(selectedPackageId)} disabled={!selectedPackageId} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, opacity: selectedPackageId ? 1 : 0.55 }}>Delete</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) minmax(180px, 220px) 1fr auto auto', gap: '0.6rem', alignItems: 'end', marginTop: '0.65rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status
            <select value={packageMeta.status} onChange={e => setPackageMeta(prev => ({ ...prev, status: e.target.value }))} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem', background: 'var(--white)' }}>
              <option value="draft">Draft</option>
              <option value="review">In review</option>
              <option value="approved">Approved concept</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Owner
            <input value={packageMeta.owner} onChange={e => setPackageMeta(prev => ({ ...prev, owner: e.target.value }))} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Working note
            <input value={packageMeta.note} onChange={e => setPackageMeta(prev => ({ ...prev, note: e.target.value }))} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.82rem' }} />
          </label>
          <button onClick={exportCurrentPackage} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Export</button>
          <label style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center' }}>
            Import
            <input type="file" accept="application/json" onChange={importPackage} style={{ display: 'none' }} />
          </label>
        </div>
        {(packagesLoading || packagesError) && (
          <div style={{ marginTop: '0.65rem', fontSize: '0.76rem', color: packagesError ? '#B45309' : 'var(--text-muted)' }}>
            {packagesLoading ? 'Loading simulation packages…' : packagesError}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <SectionDivider label="Simulation Lab" count={proposedChanges.length} />
        <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.35fr)', gap: '0.9rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scenario set</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Model rule changes across concrete procurement profiles.</div>
                </div>
                <button onClick={() => setScenarios(prev => [...prev, buildScenarioSeed(prev.length + 1)])} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.42rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, color: 'var(--teal-dark)' }}>+ scenario</button>
              </div>
              {scenarios.map((scenario, index) => (
                <ScenarioEditor
                  key={scenario.id}
                  scenario={scenario}
                  triggerOptions={schema?.trigger_options}
                  onChange={next => setScenarios(prev => prev.map(item => item.id === scenario.id ? next : item))}
                  onRemove={() => setScenarios(prev => prev.length === 1 ? prev : prev.filter(item => item.id !== scenario.id))}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rule workbench</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Assemble a proposed change package and compare it against the live canonical snapshot.</div>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {[
                  ['deactivate', 'Deactivate'],
                  ['replace', 'Replace'],
                  ['add', 'Add rule'],
                ].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setProposalMode(id)} style={{ border: `1px solid ${proposalMode === id ? '#99F6E4' : 'var(--border)'}`, background: proposalMode === id ? '#F0FDFA' : 'var(--white)', color: proposalMode === id ? '#0F766E' : 'var(--text-secondary)', borderRadius: '99px', padding: '0.42rem 0.75rem', fontSize: '0.74rem', fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>
              {(proposalMode === 'deactivate' || proposalMode === 'replace') && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Target canonical rule
                  <select value={selectedRuleId} onChange={e => setSelectedRuleId(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}>
                    <option value="">Select a rule</option>
                    {platformRules.map(rule => (
                      <option key={rule.rule_id} value={rule.rule_id}>{rule.rule_id} - {rule.title}</option>
                    ))}
                  </select>
                </label>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={cloneSelectedRuleIntoDraft} disabled={!selectedRuleId || platformRulesLoading} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.74rem', fontWeight: 700, color: 'var(--teal-dark)', opacity: !selectedRuleId || platformRulesLoading ? 0.6 : 1 }}>
                  Clone selected rule into candidate
                </button>
                <button onClick={() => setDraftRule(buildDraftFromRule(null))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Reset draft
                </button>
              </div>
              {proposalMode !== 'deactivate' && (
                <RuleDraftEditor draft={draftRule} setDraft={setDraftRule} triggerOptions={schema?.trigger_options} />
              )}
              {platformRulesError && (
                <div style={{ fontSize: '0.76rem', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  {platformRulesError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={addProposedChange} disabled={platformRulesLoading && proposalMode !== 'add'} style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, opacity: platformRulesLoading && proposalMode !== 'add' ? 0.6 : 1 }}>Add change</button>
                <button onClick={runSimulationLab} disabled={compareLoading || proposedChanges.length === 0} style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, opacity: compareLoading || proposedChanges.length === 0 ? 0.6 : 1 }}>{compareLoading ? 'Running…' : 'Run comparison'}</button>
                <button onClick={() => { setProposedChanges([]); setCompareResult(null); setCompareError(null); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Clear lab</button>
              </div>
              {compareError && (
                <div style={{ fontSize: '0.76rem', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  {compareError}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {proposedChanges.map((change, index) => (
                  <div key={`change-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#F8FAFC', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--navy)' }}>{change.operation.toUpperCase()} {change.target_rule_id || change.rule?.rule_id}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{change.rule?.title || change.rationale || 'Scenario modelling change'}</div>
                    </div>
                    <button onClick={() => setProposedChanges(prev => prev.filter((_, itemIndex) => itemIndex !== index))} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '0.35rem 0.55rem', fontSize: '0.72rem', fontWeight: 700 }}>Remove</button>
                  </div>
                ))}
                {proposedChanges.length === 0 && (
                  <SectionEmpty text="No proposed changes yet. Use the workbench to deactivate, replace, or add canonical rules and then run the comparison." />
                )}
              </div>
            </div>
            {compareResult && <CompareResultCard result={compareResult} />}
          </div>
        </div>
      </div>

      {Object.entries(FINDING_KIND_LABELS).map(([kind, label]) => (
        <div key={kind} style={{ marginBottom: '1.25rem' }}>
          <SectionDivider label={label} count={filteredFindings[kind].length} />
          <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
            {filteredFindings[kind].length > 0 ? (
              filteredFindings[kind].map(finding => (
                <FindingCard key={finding.finding_id} finding={finding} recordsById={recordsById} />
              ))
            ) : (
              <SectionEmpty text={`No ${label.toLowerCase()} surfaced for the current filter set.`} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RulesExplorer() {
  const showCitations = useContext(CitationsContext);
  const [data, setData] = useState(null);
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(MODEL_TABS.EXPLORER);
  const [modelDrilldownSeed, setModelDrilldownSeed] = useState(null);
  const [selectedSource, setSelectedSource] = useState('core');
  const [toggling, setToggling] = useState(null); // id of item being toggled
  const [adding, setAdding] = useState(null); // { type, schemeId } or null

  const openClusterInModel = useCallback((cluster, action = 'deactivate') => {
    if (!cluster?.ruleIds?.length) return;
    const firstRuleId = cluster.ruleIds[0];
    let proposalMode = 'deactivate';
    let proposedChanges = cluster.ruleIds.map(ruleId => ({
      operation: 'deactivate',
      target_rule_id: ruleId,
      rationale: 'Conflict cluster drilldown candidate',
    }));
    let packageName = `Conflict cluster - ${cluster.ruleIds.length} rules`;
    let note = `Drilldown package opened from the visualiser for a conflict cluster with ${cluster.ruleIds.length} related rules and ${cluster.conflictCount} conflict links.`;

    if (action === 'replace') {
      proposalMode = 'replace';
      proposedChanges = [];
      packageName = `Replace lead rule - ${cluster.ruleTitles[0] || firstRuleId}`;
      note = `Lead-rule replacement drilldown opened from a conflict cluster containing ${cluster.ruleIds.length} related rules.`;
    } else if (action === 'stress') {
      proposalMode = 'deactivate';
      proposedChanges = cluster.ruleIds.map(ruleId => ({
        operation: 'deactivate',
        target_rule_id: ruleId,
        rationale: 'Stress test cluster impact by removing clustered rules',
      }));
      packageName = `Stress test cluster - ${cluster.ruleIds.length} rules`;
      note = `Stress-test package opened from the visualiser with scenarios derived from the clustered rule conditions.`;
    }

    setModelDrilldownSeed({
      id: `cluster-${action}-${Date.now()}`,
      packageName,
      packageMeta: {
        status: 'draft',
        owner: '',
        note,
      },
      selectedRuleId: firstRuleId,
      proposalMode,
      proposedChanges,
      scenarios: [],
      scenarioMode: 'cluster_aware',
      clusterRuleIds: cluster.ruleIds,
    });
    setActiveTab(MODEL_TABS.MODEL);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchRules(), fetchRulesSchema()])
      .then(([d, s]) => { setData(d); setSchema(s); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleScheme = async (schemeId) => {
    setToggling(schemeId);
    try {
      await toggleScheme(schemeId);
      const fresh = await fetchRules();
      setData(fresh);
    } finally {
      setToggling(null);
    }
  };

  const handleToggleObligation = async (source, oblId) => {
    setToggling(oblId);
    try {
      await toggleObligation(source, oblId);
      const fresh = await fetchRules();
      setData(fresh);
    } finally {
      setToggling(null);
    }
  };

  const handleAddRule = async (data) => {
    const { type, schemeId } = adding;
    if (type === 'core_obligation') {
      await addCoreObligation(data);
    } else if (type === 'obligation') {
      await addSchemeObligation(schemeId, data);
    } else if (type === 'pre_check') {
      await addSchemePreCheck(schemeId, data);
    } else if (type === 'step_injection') {
      await addSchemeStepInjection(schemeId, data);
    } else if (type === 'approval_addition') {
      await addSchemeApprovalAddition(schemeId, data);
    }
    setAdding(null);
    load(); // refresh
  };

  const schemes = data?.schemes || [];
  const core_obligations = data?.core_obligations || [];
  const analysisBundle = useMemo(() => buildRulesModel(data, schema), [data, schema]);

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading rules…</div>
  );
  if (error) return (
    <div style={{ padding: '2rem', color: '#991B1B', background: '#FEF2F2', borderRadius: 8, margin: '2rem' }}>
      Error loading rules: {error}
    </div>
  );
  // Stats
  const coreActive = core_obligations.filter(r => r.active !== false).length;
  const totalActive = schemes.filter(s => s.active).length;

  // Selected source data
  const selectedScheme = selectedSource !== 'core'
    ? schemes.find(s => s.scheme_id === selectedSource)
    : null;

  const schemeColour = selectedScheme ? (SCHEME_COLOURS[selectedScheme.scheme_id] || 'var(--navy)') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Page header ── */}
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.75rem', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy)' }}>
            Rules as Code Explorer
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Browse, inspect, toggle, and model the loaded rules without crossing into the procurement workflow.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', flexShrink: 0 }}>
          <Stat label="Core rules" value={coreActive} total={core_obligations.length} />
          <Stat label="Active rulesets" value={totalActive} total={schemes.length} />
          <Stat label="Total rules" value={
            coreActive + schemes.filter(s => s.active).reduce((n, s) => n + s.obligations.filter(o => o.active !== false).length, 0)
          } total={
            core_obligations.length + schemes.reduce((n, s) => n + s.obligations.length, 0)
          } />
        </div>
      </div>

      {/* ── Two-panel body ── */}
      <div style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        flexShrink: 0,
      }}>
        <InternalTabButton active={activeTab === MODEL_TABS.EXPLORER} onClick={() => setActiveTab(MODEL_TABS.EXPLORER)}>
          Explorer
        </InternalTabButton>
        <InternalTabButton active={activeTab === MODEL_TABS.MODEL} onClick={() => setActiveTab(MODEL_TABS.MODEL)}>
          Model
        </InternalTabButton>
        <InternalTabButton active={activeTab === MODEL_TABS.VISUALISE} onClick={() => setActiveTab(MODEL_TABS.VISUALISE)}>
          Visualise
        </InternalTabButton>
      </div>

      {activeTab === MODEL_TABS.EXPLORER && (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: '230px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--white)',
          overflowY: 'auto', padding: '0.75rem 0',
        }}>
          <div style={{ padding: '0 0.75rem 0.4rem', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Rule Sources
          </div>

          <SourceItem
            isCore
            label="Core Obligations"
            sublabel="Baseline rules for all procurements"
            active={true}
            selected={selectedSource === 'core'}
            oblCount={core_obligations.length}
            activeOblCount={coreActive}
            onClick={() => setSelectedSource('core')}
          />

          <div style={{ padding: '0.75rem 0.75rem 0.3rem', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Schemes
          </div>

          {schemes.map(s => {
            const activeObls = s.obligations.filter(o => o.active !== false).length;
            return (
              <SourceItem
                key={s.scheme_id}
                label={s.name}
                sublabel={s.version ? `v${s.version}` : undefined}
                active={s.active}
                selected={selectedSource === s.scheme_id}
                oblCount={s.obligations.length}
                activeOblCount={activeObls}
                onClick={() => setSelectedSource(s.scheme_id)}
                onToggleScheme={() => handleToggleScheme(s.scheme_id)}
              />
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', background: 'var(--off-white)' }}>

          {/* ── Core obligations panel ── */}
          {selectedSource === 'core' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--navy)' }}>Core Obligations</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Baseline rules that apply to any NSW Government procurement when their trigger conditions are met.
                  Deactivating a rule removes it from all future assessments.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
                {core_obligations.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    source="core"
                    schemeActive={true}
                    effectiveTriggers={rule.trigger}
                    triggerSourceLabel="the rule definition"
                    onToggle={() => handleToggleObligation('core', rule.id)}
                  />
                ))}
              </div>
              <div style={{ marginTop: '0.875rem' }}>
                {adding?.type === 'core_obligation' ? (
                  <AddRuleForm
                    type="core_obligation"
                    triggerOptions={schema?.trigger_options}
                    schemeColour="var(--navy)"
                    onSubmit={handleAddRule}
                    onCancel={() => setAdding(null)}
                  />
                ) : (
                  <AddButton label="Add core rule" colour="var(--navy)" onClick={() => setAdding({ type: 'core_obligation', schemeId: null })} />
                )}
              </div>
            </div>
          )}

          {/* ── Scheme detail panel ── */}
          {selectedScheme && (
            <div>
              {/* Scheme header */}
              <div style={{
                background: 'var(--white)', borderRadius: 12,
                border: '1px solid var(--border)',
                padding: '1.1rem 1.25rem', marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px',
                        borderRadius: 4, background: `${schemeColour}18`,
                        color: schemeColour, border: `1px solid ${schemeColour}40`,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {selectedScheme.scheme_id}
                      </span>
                      {selectedScheme.version && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          v{selectedScheme.version}
                        </span>
                      )}
                      {!selectedScheme.active && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          INACTIVE — rules not applied to assessments
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: 800, color: selectedScheme.active ? 'var(--navy)' : 'var(--text-muted)' }}>
                      {selectedScheme.name}
                    </h3>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {selectedScheme.description}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {selectedScheme.source}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    <Toggle
                      active={selectedScheme.active}
                      onToggle={() => handleToggleScheme(selectedScheme.scheme_id)}
                      size="lg"
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {selectedScheme.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Trigger conditions */}
                {selectedScheme.triggers && Object.keys(selectedScheme.triggers).length > 0 && (
                  <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                      Triggers when all of:
                    </div>
                    <TriggerBlock triggers={selectedScheme.triggers} />
                  </div>
                )}
              </div>

              {/* Pre-checks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionDivider label="Pre-checks" count={(selectedScheme.pre_checks || []).length} />
                {selectedScheme.pre_checks?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {selectedScheme.pre_checks.map(pc => (
                      <PreCheckCard key={pc.id} pc={pc} schemeColour={schemeColour} />
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  {adding?.type === 'pre_check' && adding?.schemeId === selectedScheme.scheme_id ? (
                    <AddRuleForm
                      type="pre_check"
                      schemeColour={schemeColour}
                      onSubmit={handleAddRule}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <AddButton label="Add pre-check" colour={schemeColour} onClick={() => setAdding({ type: 'pre_check', schemeId: selectedScheme.scheme_id })} />
                  )}
                </div>
              </div>

              {/* Obligations */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionDivider
                  label="Obligations"
                  count={(selectedScheme.obligations || []).length}
                  activeCount={(selectedScheme.obligations || []).filter(o => o.active !== false).length}
                />
                {selectedScheme.obligations?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {selectedScheme.obligations.map(obl => (
                      <RuleCard
                        key={obl.id}
                        rule={obl}
                        source={selectedScheme.scheme_id}
                        schemeActive={selectedScheme.active}
                        schemeColour={schemeColour}
                        effectiveTriggers={selectedScheme.triggers}
                        triggerSourceLabel={`${selectedScheme.name} scheme`}
                        onToggle={() => handleToggleObligation(selectedScheme.scheme_id, obl.id)}
                      />
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  {adding?.type === 'obligation' && adding?.schemeId === selectedScheme.scheme_id ? (
                    <AddRuleForm
                      type="obligation"
                      schemeColour={schemeColour}
                      onSubmit={handleAddRule}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <AddButton label="Add obligation" colour={schemeColour} onClick={() => setAdding({ type: 'obligation', schemeId: selectedScheme.scheme_id })} />
                  )}
                </div>
              </div>

              {/* Step injections */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionDivider label="Process step injections" count={(selectedScheme.step_injections || []).length} />
                {selectedScheme.step_injections?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedScheme.step_injections.map((inj, i) => (
                      <div key={i} style={{
                        background: 'var(--white)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '0.875rem 1rem',
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          Injected after step {inj.after_step === 0 ? '0 (before process starts)' : inj.after_step}
                        </div>
                        <ol style={{ margin: 0, padding: '0 0 0 1.25rem' }}>
                          {inj.steps.map((s, si) => {
                            const stepText = typeof s === 'object' ? s.text : s;
                            const stepCitation = typeof s === 'object' ? s.citation : null;
                            return (
                              <li key={si} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.3rem' }}>
                                {stepText}
                                {showCitations && stepCitation && (
                                  <span style={{
                                    display: 'inline-block', marginLeft: '0.4rem',
                                    fontSize: '0.66rem', fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    background: 'var(--off-white)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '99px',
                                    padding: '1px 6px',
                                    verticalAlign: 'middle',
                                  }}>
                                    {stepCitation}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  {adding?.type === 'step_injection' && adding?.schemeId === selectedScheme.scheme_id ? (
                    <AddRuleForm
                      type="step_injection"
                      schemeColour={schemeColour}
                      onSubmit={handleAddRule}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <AddButton label="Add step injection" colour={schemeColour} onClick={() => setAdding({ type: 'step_injection', schemeId: selectedScheme.scheme_id })} />
                  )}
                </div>
              </div>

              {/* Approval additions */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionDivider label="Approval additions" count={(selectedScheme.approval_additions || []).length} />
                {selectedScheme.approval_additions?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedScheme.approval_additions.map((a, i) => (
                      <div key={i} style={{
                        background: 'var(--white)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '0.875rem 1rem',
                        display: 'flex', gap: '0.75rem',
                      }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>👤</span>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)' }}>{a.role}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{a.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  {adding?.type === 'approval_addition' && adding?.schemeId === selectedScheme.scheme_id ? (
                    <AddRuleForm
                      type="approval_addition"
                      schemeColour={schemeColour}
                      onSubmit={handleAddRule}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <AddButton label="Add approval requirement" colour={schemeColour} onClick={() => setAdding({ type: 'approval_addition', schemeId: selectedScheme.scheme_id })} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === MODEL_TABS.MODEL && (
        <ModelView analysisBundle={analysisBundle} schemes={schemes} schema={schema} drilldownSeed={modelDrilldownSeed} />
      )}

      {activeTab === MODEL_TABS.VISUALISE && (
        <RulesVisualisationView onOpenClusterInModel={openClusterInModel} />
      )}
    </div>
  );
}

function Stat({ label, value, total }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}> / {total}</span>
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}
