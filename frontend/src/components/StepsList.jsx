import React, { useState, useContext } from 'react';
import { CitationsContext } from '../CitationsContext';

// ─── Stage helpers ─────────────────────────────────────────────────────────

function stageLabel(idx, total) {
  if (idx === 0) return 'Plan';
  if (idx === total - 1) return 'Approve';
  return 'Process';
}

function stageTone(idx, total) {
  if (idx === 0) {
    return {
      accent: 'var(--teal)',
      bg: 'rgba(0,178,169,0.08)',
      border: 'rgba(0,178,169,0.22)',
      text: 'var(--teal-dark)',
    };
  }
  if (idx === total - 1) {
    return {
      accent: 'var(--navy)',
      bg: 'var(--navy-light)',
      border: 'rgba(30,64,175,0.16)',
      text: 'var(--navy)',
    };
  }
  return {
    accent: '#94A3B8',
    bg: '#F8FAFC',
    border: 'rgba(148,163,184,0.32)',
    text: 'var(--text-muted)',
  };
}

// ─── Pre-check response toggle ─────────────────────────────────────────────

const PC_RESPONSES = [
  {
    value: 'applies',
    label: 'Applies',
    icon: '✓',
    activeStyle: {
      background: 'var(--teal)',
      color: 'white',
      border: '1px solid var(--teal)',
    },
    cardBg: 'rgba(0,178,169,0.06)',
    cardBorder: 'rgba(0,178,169,0.3)',
    dotColor: 'var(--teal)',
  },
  {
    value: 'not_applicable',
    label: 'Not applicable',
    icon: '✕',
    activeStyle: {
      background: '#64748B',
      color: 'white',
      border: '1px solid #64748B',
    },
    cardBg: '#F8FAFC',
    cardBorder: 'rgba(148,163,184,0.35)',
    dotColor: '#94A3B8',
  },
  {
    value: 'unsure',
    label: 'Unsure',
    icon: '?',
    activeStyle: {
      background: '#D97706',
      color: 'white',
      border: '1px solid #D97706',
    },
    cardBg: 'rgba(251,191,36,0.07)',
    cardBorder: 'rgba(217,119,6,0.3)',
    dotColor: '#D97706',
  },
];

function ResponseToggle({ pcId, currentValue, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, flexWrap: 'wrap' }}>
      {PC_RESPONSES.map(opt => {
        const isActive = currentValue === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(pcId, isActive ? null : opt.value)}
            title={opt.label}
            style={{
              border: isActive ? opt.activeStyle.border : '1px solid var(--border)',
              borderRadius: '99px',
              padding: '3px 10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              ...(isActive ? opt.activeStyle : {
                background: 'var(--white)',
                color: 'var(--text-muted)',
              }),
            }}
          >
            {opt.icon} {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Compute injection status from pre-check responses ─────────────────────

function computeInjectionStatus(injection, allPreChecks, preCheckResponses) {
  const schemeId = injection.source;
  const schemeChecks = allPreChecks.filter(pc => pc.source === schemeId);
  if (schemeChecks.length === 0) return 'unknown';

  const responses = schemeChecks.map(pc => preCheckResponses[pc.id]).filter(Boolean);
  if (responses.length === 0) return 'unknown';

  const allNotApplicable =
    schemeChecks.every(pc => preCheckResponses[pc.id] === 'not_applicable');
  if (allNotApplicable) return 'suppressed';

  if (responses.some(r => r === 'applies')) return 'confirmed';
  if (responses.some(r => r === 'unsure')) return 'unsure';

  return 'unknown';
}

// Status badge config
const STATUS_BADGE = {
  confirmed: {
    label: 'Pre-check confirmed',
    style: {
      background: 'var(--teal-light)',
      color: 'var(--teal-dark)',
      border: '1px solid rgba(0,178,169,0.3)',
    },
  },
  suppressed: {
    label: 'Pre-check: not applicable',
    style: {
      background: '#F1F5F9',
      color: '#64748B',
      border: '1px solid rgba(148,163,184,0.3)',
    },
  },
  unsure: {
    label: 'Verify applicability',
    style: {
      background: '#FFFBEB',
      color: '#92400E',
      border: '1px solid rgba(217,119,6,0.3)',
    },
  },
};

// ─── Injection group ───────────────────────────────────────────────────────

function InjectionGroup({ injection, status = 'unknown' }) {
  const [expanded, setExpanded] = useState(status !== 'suppressed');
  const showCitations = useContext(CitationsContext);
  const isSuppressed = status === 'suppressed';

  // Flip expanded when status changes from suppressed → something else
  // (handled in parent by re-rendering)

  const badge = STATUS_BADGE[status];
  const borderColor = status === 'confirmed'
    ? 'rgba(0,178,169,0.28)'
    : status === 'suppressed'
    ? 'rgba(148,163,184,0.25)'
    : status === 'unsure'
    ? 'rgba(217,119,6,0.3)'
    : 'rgba(0,178,169,0.22)';

  const leftBarColor = status === 'confirmed'
    ? 'var(--teal)'
    : status === 'suppressed'
    ? '#CBD5E1'
    : status === 'unsure'
    ? '#D97706'
    : 'var(--teal)';

  return (
    <div
      style={{
        background: isSuppressed ? '#F8FAFC' : 'var(--white)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${leftBarColor}`,
        borderRadius: '0 10px 10px 0',
        padding: '0.8rem 0.95rem',
        opacity: isSuppressed ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: expanded ? '0.45rem' : 0 }}>
        <span style={{
          fontSize: '0.66rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: isSuppressed ? '#64748B' : 'var(--teal-dark)',
          background: isSuppressed ? '#E2E8F0' : 'var(--teal-light)',
          borderRadius: '99px',
          padding: '2px 8px',
        }}>
          {isSuppressed ? 'Skipped' : 'Required here'}
        </span>

        {(injection.source_name || injection.source) && (
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '99px',
            padding: '2px 8px',
          }}>
            {injection.source_name || injection.source}
          </span>
        )}

        {badge && (
          <span style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            borderRadius: '99px',
            padding: '2px 8px',
            ...badge.style,
          }}>
            {badge.label}
          </span>
        )}

        {isSuppressed && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {expanded ? 'Hide ▲' : 'Show ▼'}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {injection.steps.map((item, itemIdx) => (
            <div key={itemIdx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: isSuppressed ? '#E2E8F0' : 'var(--teal-light)',
                color: isSuppressed ? '#94A3B8' : 'var(--teal-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 800,
                flexShrink: 0,
                marginTop: '1px',
              }}>
                {itemIdx + 1}
              </div>
              <div>
                <div style={{
                  fontSize: '0.84rem',
                  color: isSuppressed ? 'var(--text-muted)' : 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}>
                  {item.text || item}
                </div>
                {showCitations && item.citations && item.citations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                    {item.citations.map((citation, citationIdx) => (
                      <span key={citationIdx} style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        background: 'var(--off-white)',
                        border: '1px solid var(--border)',
                        borderRadius: '99px',
                        padding: '2px 8px',
                      }}>
                        {citation}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function StepsList({
  steps,
  preChecks,
  stepInjections,
  showPreChecks = true,
  showDeliveryPath = true,
  preCheckResponses = {},
  onPreCheckResponse = null,
  onNavigate = null,
}) {
  const showCitations = useContext(CitationsContext);
  const normSteps = (steps || []).map(step => (
    typeof step === 'string' ? { text: step } : step
  ));

  const allPreChecks = preChecks || [];

  const groupedInjections = (stepInjections || []).reduce((acc, injection) => {
    const key = injection.after_step || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(injection);
    return acc;
  }, {});

  const preStepInjections = groupedInjections[0] || [];

  // Delivery path summary from pre-check responses
  const allInjections = stepInjections || [];
  const respondedCount = allPreChecks.filter(pc => preCheckResponses[pc.id]).length;
  const confirmedCount = allInjections.filter(inj =>
    computeInjectionStatus(inj, allPreChecks, preCheckResponses) === 'confirmed'
  ).length;
  const suppressedCount = allInjections.filter(inj =>
    computeInjectionStatus(inj, allPreChecks, preCheckResponses) === 'suppressed'
  ).length;
  const unsureCount = allInjections.filter(inj =>
    computeInjectionStatus(inj, allPreChecks, preCheckResponses) === 'unsure'
  ).length;
  const hasAnyResponse = respondedCount > 0;

  // Pre-check gate summary stats
  const appliesCount = allPreChecks.filter(pc => preCheckResponses[pc.id] === 'applies').length;
  const notApplicableCount = allPreChecks.filter(pc => preCheckResponses[pc.id] === 'not_applicable').length;
  const unsurePcCount = allPreChecks.filter(pc => preCheckResponses[pc.id] === 'unsure').length;

  return (
    <div>
      <style>{`
        @media (max-width: 820px) {
          .steps-overview-grid {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          .steps-sequence-row {
            flex-direction: column;
            gap: 0.65rem;
          }
          .steps-sequence-marker {
            width: 100% !important;
            flex-direction: row !important;
            justify-content: flex-start;
            gap: 0.75rem;
          }
          .steps-sequence-line {
            display: none;
          }
        }
      `}</style>

      {/* ── Mandatory Pre-checks panel ── */}
      {showPreChecks && allPreChecks.length > 0 && (
        <div style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(180deg, rgba(0,178,169,0.06) 0%, rgba(255,255,255,0.95) 100%)',
          border: '1px solid rgba(0,178,169,0.18)',
          borderRadius: '14px',
          padding: '1rem',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                Mandatory pre-check gate
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)' }}>
                Mark each item to filter the delivery path.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {respondedCount > 0 && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: respondedCount === allPreChecks.length ? 'var(--teal-dark)' : 'var(--text-muted)',
                  background: respondedCount === allPreChecks.length ? 'var(--teal-light)' : 'var(--off-white)',
                  border: '1px solid var(--border)',
                  borderRadius: '99px',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                }}>
                  {respondedCount === allPreChecks.length ? '✓ ' : ''}{respondedCount}/{allPreChecks.length} answered
                </span>
              )}
              {respondedCount === 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--teal-dark)',
                  background: 'var(--teal-light)',
                  borderRadius: '99px',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                }}>
                  {allPreChecks.length} required
                </span>
              )}
            </div>
          </div>

          {/* Pre-check cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {allPreChecks.map(pc => {
              const response = preCheckResponses[pc.id];
              const responseConfig = PC_RESPONSES.find(r => r.value === response);
              return (
                <div
                  key={pc.id}
                  style={{
                    background: responseConfig ? responseConfig.cardBg : 'var(--white)',
                    border: `1px solid ${responseConfig ? responseConfig.cardBorder : 'rgba(0,178,169,0.2)'}`,
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    {/* Status dot */}
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: responseConfig ? responseConfig.dotColor : 'var(--teal)',
                      color: 'var(--white)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      flexShrink: 0,
                      transition: 'background 0.2s ease',
                    }}>
                      {responseConfig ? responseConfig.icon : '!'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>
                          {pc.title}
                        </div>
                        {pc.source && pc.source !== 'core' && (
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            color: 'var(--teal-dark)',
                            background: 'var(--teal-light)',
                            borderRadius: '99px',
                            padding: '2px 8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            Scheme-triggered
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.65rem' }}>
                        {pc.body}
                      </div>

                      {/* Citation + link */}
                      {(showCitations && pc.citation || pc.link) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.65rem' }}>
                          {showCitations && pc.citation && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--teal-dark)',
                              background: 'var(--teal-light)',
                              border: '1px solid rgba(0,178,169,0.25)',
                              borderRadius: '99px',
                              padding: '2px 8px',
                            }}>
                              {pc.citation}
                            </span>
                          )}
                          {pc.link && (
                            <a href={pc.link} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: '0.8rem', color: 'var(--teal-dark)', fontWeight: 600 }}>
                              Open guidance →
                            </a>
                          )}
                        </div>
                      )}

                      {/* Response toggle */}
                      {onPreCheckResponse && (
                        <ResponseToggle
                          pcId={pc.id}
                          currentValue={response || null}
                          onChange={onPreCheckResponse}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gate summary + CTA */}
          {hasAnyResponse && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Gate:</span>
                {appliesCount > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-dark)', background: 'var(--teal-light)', borderRadius: '99px', padding: '2px 8px' }}>
                    ✓ {appliesCount} applies
                  </span>
                )}
                {notApplicableCount > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#F1F5F9', borderRadius: '99px', padding: '2px 8px' }}>
                    ✕ {notApplicableCount} not applicable
                  </span>
                )}
                {unsurePcCount > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E', background: '#FFFBEB', borderRadius: '99px', padding: '2px 8px' }}>
                    ? {unsurePcCount} unsure
                  </span>
                )}
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('delivery')}
                  style={{
                    background: 'var(--navy)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View filtered delivery path →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Delivery Path panel ── */}
      {showDeliveryPath && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
              Sequential delivery path
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Follow this sequence from left to right. Scheme-specific actions appear where they must be completed.
            </p>
          </div>

          {/* Pre-check filter banner */}
          {hasAnyResponse && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '0.7rem 1rem',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Pre-check gate applied
              </span>
              {confirmedCount > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-dark)', background: 'var(--teal-light)', borderRadius: '99px', padding: '2px 8px' }}>
                  ✓ {confirmedCount} confirmed
                </span>
              )}
              {suppressedCount > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#F1F5F9', borderRadius: '99px', padding: '2px 8px' }}>
                  {suppressedCount} skipped
                </span>
              )}
              {unsureCount > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E', background: '#FFFBEB', borderRadius: '99px', padding: '2px 8px' }}>
                  ⚠ {unsureCount} to verify
                </span>
              )}
              {onNavigate && (
                <button
                  onClick={() => onNavigate('prechecks')}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    fontSize: '0.72rem',
                    color: 'var(--teal-dark)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Edit pre-checks
                </button>
              )}
            </div>
          )}

          {/* Step lane overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(normSteps.length, 1)}, minmax(0, 1fr))`,
            gap: '0.55rem',
            marginBottom: '1.25rem',
          }} className="steps-overview-grid">
            {normSteps.map((step, idx) => {
              const tone = stageTone(idx, normSteps.length);
              return (
                <div key={`lane-${idx}`} style={{
                  minHeight: '72px',
                  borderRadius: '12px',
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  padding: '0.65rem 0.75rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '4px',
                    background: tone.accent,
                  }} />
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: tone.text, marginBottom: '0.35rem' }}>
                    {stageLabel(idx, normSteps.length)}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.35 }}>
                    Step {idx + 1}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                    {step.text}
                  </div>
                  {showCitations && step.citations && step.citations.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.45rem' }}>
                      {step.citations.slice(0, 1).map((citation, citationIdx) => (
                        <span key={citationIdx} style={{
                          fontSize: '0.66rem',
                          color: tone.text,
                          background: 'rgba(255,255,255,0.78)',
                          border: `1px solid ${tone.border}`,
                          borderRadius: '99px',
                          padding: '2px 8px',
                        }}>
                          {citation}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed sequence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Pre-step injections (after_step = 0) */}
            {preStepInjections.length > 0 && (
              <div style={{
                background: 'linear-gradient(180deg, rgba(0,178,169,0.05) 0%, rgba(255,255,255,1) 100%)',
                border: '1px dashed rgba(0,178,169,0.35)',
                borderRadius: '14px',
                padding: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--teal-dark)',
                  }}>
                    Before step 1
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Required setup actions that shape which path you follow.
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {preStepInjections.map((injection, index) => {
                    const status = computeInjectionStatus(injection, allPreChecks, preCheckResponses);
                    return (
                      <InjectionGroup key={`pre-${index}`} injection={injection} status={status} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main steps */}
            {normSteps.map((step, idx) => {
              const injectionsAtPoint = groupedInjections[idx + 1] || [];
              const tone = stageTone(idx, normSteps.length);

              return (
                <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }} className="steps-sequence-row">
                  <div style={{ width: '78px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="steps-sequence-marker">
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: tone.accent,
                      color: 'var(--white)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
                    }}>
                      {idx + 1}
                    </div>
                    {idx < normSteps.length - 1 && (
                      <div style={{
                        width: 3,
                        flex: 1,
                        marginTop: '0.4rem',
                        borderRadius: '999px',
                        background: 'linear-gradient(180deg, rgba(148,163,184,0.35) 0%, rgba(148,163,184,0.08) 100%)',
                        minHeight: '64px',
                      }} className="steps-sequence-line" />
                    )}
                  </div>

                  <div style={{
                    flex: 1,
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--border)',
                      background: tone.bg,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: tone.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.22rem' }}>
                          {stageLabel(idx, normSteps.length)}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.35 }}>
                          {step.text}
                        </div>
                        {showCitations && step.citations && step.citations.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
                            {step.citations.map((citation, citationIdx) => (
                              <span key={citationIdx} style={{
                                fontSize: '0.68rem',
                                color: tone.text,
                                background: 'rgba(255,255,255,0.78)',
                                border: `1px solid ${tone.border}`,
                                borderRadius: '99px',
                                padding: '2px 8px',
                              }}>
                                {citation}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.78)',
                        border: '1px solid rgba(148,163,184,0.25)',
                        borderRadius: '99px',
                        padding: '4px 10px',
                      }}>
                        Step {idx + 1} of {normSteps.length}
                      </div>
                    </div>

                    <div style={{ padding: '1rem' }}>
                      <div style={{ marginBottom: injectionsAtPoint.length > 0 ? '0.85rem' : 0 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.45rem' }}>
                          Core action
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                          {step.text}
                        </div>
                      </div>

                      {injectionsAtPoint.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.55rem' }}>
                            Additional required elements at this point
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {injectionsAtPoint.map((injection, index) => {
                              const status = computeInjectionStatus(injection, allPreChecks, preCheckResponses);
                              return (
                                <InjectionGroup key={`step-${idx}-${index}`} injection={injection} status={status} />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
