import React, { useState, useMemo } from 'react';
import PathwayCard from './PathwayCard';
import StepsList from './StepsList';
import ObligationsList from './ObligationsList';
import ApprovalPath from './ApprovalPath';
import BriefingNote from './BriefingNote';
import AnswerLog from './AnswerLog';
import PathwayTrace from './PathwayTrace';
import ExceptionForm from './ExceptionForm';
import { explainPathway } from '../api';

const TABS = [
  { id: 'pathway',     label: 'Determination',        icon: '⚖' },
  { id: 'prechecks',   label: 'Pre-checks',            icon: '✓' },
  { id: 'delivery',    label: 'Delivery Path',         icon: '→' },
  { id: 'obligations', label: 'Policy Obligations',    icon: '§' },
  { id: 'approvals',   label: 'Approval Chain',        icon: '⬆' },
  { id: 'briefing',    label: 'Briefing Note',         icon: '≡' },
  { id: 'trace',       label: 'Policy Trace',          icon: '§§' },
  { id: 'exception',   label: 'Request Override',      icon: '!' },
];

export default function ResultsPage({ result, answers, questions, onRestart, onSwitchToIngest }) {
  const [activeTab, setActiveTab] = useState('pathway');
  const [explanation, setExplanation] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [preCheckResponses, setPreCheckResponses] = useState({});

  const handlePreCheckResponse = (pcId, value) => {
    setPreCheckResponses(prev => {
      if (value === null) {
        const next = { ...prev };
        delete next[pcId];
        return next;
      }
      return { ...prev, [pcId]: value };
    });
  };

  const detRef = useMemo(() => {
    const d = new Date();
    const date = d.toISOString().slice(0, 10).replace(/-/g, '');
    const hex = d.getTime().toString(16).slice(-4).toUpperCase();
    return `DET-${date}-${hex}`;
  }, []);

  const { profile, pathway, obligations, approvals, briefing_structure } = result;

  const handleExplain = async () => {
    setExplaining(true);
    try {
      const res = await explainPathway(profile, pathway);
      setExplanation(res.explanation);
    } catch (e) {
      setExplanation('Could not generate explanation — check ANTHROPIC_API_KEY is configured.');
    } finally {
      setExplaining(false);
    }
  };

  const allPreChecks = [
    ...(pathway.pre_checks || []),
    ...(obligations.pre_checks || []),
  ];
  const stepInjections = obligations.step_injections || [];
  const suppressedSchemeIds = useMemo(() => {
    const schemeIds = [...new Set(
      allPreChecks
        .map(pc => pc.source)
        .filter(source => source && source !== 'core')
    )];

    return schemeIds.filter(schemeId => {
      const schemeChecks = allPreChecks.filter(pc => pc.source === schemeId);
      return schemeChecks.length > 0 && schemeChecks.every(pc => preCheckResponses[pc.id] === 'not_applicable');
    });
  }, [allPreChecks, preCheckResponses]);
  const suppressedSchemeSet = useMemo(() => new Set(suppressedSchemeIds), [suppressedSchemeIds]);
  const filteredStepInjections = useMemo(
    () => stepInjections.filter(inj => !suppressedSchemeSet.has(inj.source)),
    [stepInjections, suppressedSchemeSet]
  );
  const filteredObligations = useMemo(
    () => (obligations.obligations || []).filter(obl => obl.source === 'core' || !suppressedSchemeSet.has(obl.source)),
    [obligations.obligations, suppressedSchemeSet]
  );
  const filteredMatchedSchemes = useMemo(
    () => (obligations.matched_schemes || []).filter(scheme => !suppressedSchemeSet.has(scheme.scheme_id)),
    [obligations.matched_schemes, suppressedSchemeSet]
  );
  const filteredApprovals = useMemo(() => ({
    ...approvals,
    additions: (approvals.additions || []).filter(addition => !addition.source || !suppressedSchemeSet.has(addition.source)),
    approval_steps: (approvals.approval_steps || []).filter(step => !step.source || !suppressedSchemeSet.has(step.source)),
  }), [approvals, suppressedSchemeSet]);
  const oblCount = filteredObligations.length;
  const hasExceptions = pathway.exception;

  const pcTotal = allPreChecks.length;
  const pcAnswered = allPreChecks.filter(pc => preCheckResponses[pc.id]).length;
  const pcSuppressed = stepInjections.filter(inj => {
    const schemeChecks = allPreChecks.filter(pc => pc.source === inj.source);
    return schemeChecks.length > 0 && schemeChecks.every(pc => preCheckResponses[pc.id] === 'not_applicable');
  }).length;

  return (
    <div style={{ background: 'var(--off-white)' }} className="fade-in">

      {/* Sub-header: action bar */}
      <div style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--border-light)',
        padding: '0.5rem 0',
      }}>
        <div style={{
          width: '100%', padding: '0 clamp(1rem, 2.5vw, 2rem)',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }} className="results-actions-bar">
          <button onClick={onRestart} className="btn-ghost">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8 2L4 6.5L8 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New assessment
          </button>
          {onSwitchToIngest && (
            <button onClick={onSwitchToIngest} className="btn-ghost">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v8M3.5 6l3 3 3-3M1.5 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Add policy artifact
            </button>
          )}
        </div>
      </div>

      {/* ── Determination hero ── */}
      <div style={{
        background: `linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 60%, color-mix(in srgb, var(--navy) 85%, ${pathway.colour}) 100%)`,
        padding: '2rem 0 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative ring */}
        <div style={{
          position: 'absolute', right: '-80px', top: '-80px',
          width: 280, height: 280,
          borderRadius: '50%',
          border: `2px solid ${pathway.colour}30`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: '-40px', top: '-40px',
          width: 180, height: 180,
          borderRadius: '50%',
          border: `2px solid ${pathway.colour}20`,
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', padding: '0 clamp(1rem, 2.5vw, 2rem)', position: 'relative', zIndex: 1 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{
                fontSize: '0.62rem', fontWeight: 800,
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                marginBottom: '0.25rem',
              }}>
                Procurement Determination
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
                {detRef}
              </div>
            </div>
            {profile.agency_name && (
              <div style={{
                fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)',
                fontWeight: 500,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '99px',
                padding: '4px 12px',
                whiteSpace: 'nowrap',
              }}>
                {profile.agency_name}
              </div>
            )}
          </div>

          {/* Pathway classification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {/* Colour pill */}
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: pathway.colour,
              boxShadow: `0 0 12px ${pathway.colour}80`,
              flexShrink: 0,
            }} />
            <h1 style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
              fontWeight: 900,
              color: 'white',
              margin: 0,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}>
              {pathway.label}
            </h1>
            {hasExceptions && (
              <span style={{
                background: '#FEF3C7', color: '#92400E',
                fontSize: '0.68rem', fontWeight: 800,
                padding: '3px 10px', borderRadius: '99px',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Exception pathway
              </span>
            )}
            {pathway.low_confidence && (
              <span style={{
                background: 'rgba(217,119,6,0.2)',
                color: '#FCD34D',
                border: '1px solid rgba(217,119,6,0.4)',
                fontSize: '0.68rem', fontWeight: 700,
                padding: '3px 10px', borderRadius: '99px',
              }}>
                ⚠ Verify before proceeding
              </span>
            )}
          </div>

          {/* Counts row */}
          <p style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '0.875rem',
            marginLeft: '1.5rem',
            paddingBottom: '1.5rem',
          }}>
            {oblCount} policy obligation{oblCount !== 1 ? 's' : ''} apply
            {filteredMatchedSchemes.length > 0 &&
              ` · ${filteredMatchedSchemes.length} ruleset${filteredMatchedSchemes.length !== 1 ? 's' : ''} in force`}
          </p>
        </div>

        {/* Tab nav — sits at bottom of hero, transitions into content */}
        <div style={{
          background: 'rgba(0,0,0,0.18)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            width: '100%', padding: '0 clamp(1rem, 2.5vw, 2rem)',
            display: 'flex', gap: 0, overflowX: 'auto',
          }} className="results-tabs">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.10)' : 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid var(--teal)` : '2px solid transparent',
                    padding: '0.75rem 1.1rem',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.82rem',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                  className="results-tab-button"
                >
                  {tab.label}

                  {tab.id === 'obligations' && oblCount > 0 && (
                    <span style={{
                      background: isActive ? 'var(--teal)' : 'rgba(0,178,169,0.35)',
                      color: 'white',
                      borderRadius: '99px', padding: '1px 6px',
                      fontSize: '0.65rem', fontWeight: 800,
                    }}>
                      {oblCount}
                    </span>
                  )}

                  {tab.id === 'prechecks' && pcTotal > 0 && (
                    <span style={{
                      background: pcAnswered === pcTotal
                        ? 'var(--teal)'
                        : 'rgba(0,178,169,0.25)',
                      color: 'white',
                      borderRadius: '99px', padding: '1px 6px',
                      fontSize: '0.65rem', fontWeight: 800,
                    }}>
                      {pcAnswered === pcTotal ? '✓' : `${pcAnswered}/${pcTotal}`}
                    </span>
                  )}

                  {tab.id === 'delivery' && pcSuppressed > 0 && (
                    <span style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.7)',
                      borderRadius: '99px', padding: '1px 6px',
                      fontSize: '0.65rem', fontWeight: 700,
                    }}>
                      {pcSuppressed} filtered
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ width: '100%', padding: '0 clamp(1rem, 2.5vw, 2rem)' }}>
        <div style={{
          display: 'flex', gap: '1.5rem', alignItems: 'flex-start',
          padding: '1.75rem 0', width: '100%',
        }} className="results-main-layout">

          <div style={{ flex: 1, minWidth: 0 }} className="slide-up" key={activeTab}>
            {activeTab === 'pathway' && (
              <PathwayCard
                pathway={pathway}
                explanation={explanation}
                onExplain={handleExplain}
                explaining={explaining}
              />
            )}
            {activeTab === 'prechecks' && (
              <StepsList
                steps={pathway.steps}
                preChecks={allPreChecks}
                stepInjections={filteredStepInjections}
                showDeliveryPath={false}
                preCheckResponses={preCheckResponses}
                onPreCheckResponse={handlePreCheckResponse}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'delivery' && (
              <StepsList
                steps={pathway.steps}
                preChecks={allPreChecks}
                stepInjections={filteredStepInjections}
                showPreChecks={false}
                preCheckResponses={preCheckResponses}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'obligations' && (
              <ObligationsList
                obligations={filteredObligations}
                matchedSchemes={filteredMatchedSchemes}
              />
            )}
            {activeTab === 'approvals' && (
              <ApprovalPath approvals={filteredApprovals} />
            )}
            {activeTab === 'briefing' && (
              <BriefingNote
                briefingStructure={briefing_structure}
                profile={profile}
                pathway={pathway}
                approvals={approvals}
              />
            )}
            {activeTab === 'trace' && (
              <PathwayTrace pathway={pathway} />
            )}
            {activeTab === 'exception' && (
              <ExceptionForm decisionId={result.decision_id || ''} pathway={pathway} />
            )}
          </div>

          {/* Sticky answer log */}
          {answers && answers.length > 0 && (
            <div style={{ width: '240px', flexShrink: 0, position: 'sticky', top: '1rem' }} className="results-answer-log">
              <AnswerLog answers={answers} questions={questions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
