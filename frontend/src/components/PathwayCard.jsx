import React, { useState, useMemo } from 'react';

const CONTEST_REASONS = [
  { value: '', label: 'Select a reason…' },
  { value: 'spec_clarity',    label: 'My specification is more defined than I indicated' },
  { value: 'budget_changed',  label: 'The budget estimate has changed since assessment' },
  { value: 'org_type',        label: 'My organisation type or level is different' },
  { value: 'exception',       label: 'Exception circumstances apply to this procurement' },
  { value: 'rule_incorrect',  label: 'A rule applied here appears incorrect or outdated' },
  { value: 'missing_context', label: 'Relevant context was not captured by the questions' },
  { value: 'other',           label: 'Other reason' },
];

function formatExplanation(explanation) {
  const blocks = String(explanation || '')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const headingLine = lines.find(line => /:$/.test(line) && line.length <= 80);

    if (headingLine && lines.length > 1) {
      const bodyLines = lines.filter(line => line !== headingLine);
      const isBulletSection = bodyLines.every(line => /^[-*•]\s+/.test(line));

      return {
        type: isBulletSection ? 'section-list' : 'section-text',
        title: headingLine.replace(/:$/, ''),
        items: isBulletSection ? bodyLines.map(line => line.replace(/^[-*•]\s+/, '').trim()) : [],
        body: isBulletSection ? '' : bodyLines.join(' '),
        key: `block-${index}`,
      };
    }

    const bulletLines = lines.filter(line => /^[-*•]\s+/.test(line));
    if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
      return {
        type: 'list',
        items: lines.map(line => line.replace(/^[-*•]\s+/, '').trim()),
        key: `block-${index}`,
      };
    }

    return {
      type: index === 0 ? 'lead' : 'paragraph',
      body: lines.join(' '),
      key: `block-${index}`,
    };
  });
}

function ContestabilityPanel({ pathway }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const flagRef = useMemo(() => {
    const ts = Date.now().toString(16).slice(-6).toUpperCase();
    return `FLAG-${ts}`;
  }, []);

  const canSubmit = reason !== '' && reason !== undefined;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  if (!open) {
    return (
      <div style={{
        marginTop: '1.75rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Something doesn't look right?
        </span>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'none',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem', fontWeight: 600,
            padding: '0.4rem 0.875rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'var(--font)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--warning)'; e.currentTarget.style.color = 'var(--warning)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1L12 11.5H1L6.5 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6.5 5v2.5M6.5 9v.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Flag an issue
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{
        marginTop: '1.75rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-light)',
      }}>
        <div style={{
          background: 'var(--success-light)',
          border: '1px solid rgba(5,150,105,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }} className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                <path d="M1 5L5 9L12 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#065F46' }}>
                Flag recorded
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#047857', marginTop: '1px' }}>
                {flagRef}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#065F46', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
            In a production system, this flag would be routed to a procurement policy officer for review within 2 business days.
            Patterns of flags on the same determination type are automatically surfaced for rule quality review.
          </p>
          <div style={{
            background: 'rgba(5,150,105,0.08)',
            borderRadius: 'var(--radius)',
            padding: '0.75rem 1rem',
            fontSize: '0.78rem',
            color: '#065F46',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>What would happen next</div>
            <ol style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Officer reviews the original answers against the flagged reason</li>
              <li>If a rule is found to be incorrect, a rules change is initiated with version control and governance sign-off</li>
              <li>If answers were incorrect, the officer guides a re-assessment with corrected inputs</li>
              <li>Override decisions are logged against the determination reference for audit</li>
            </ol>
          </div>
          <button
            onClick={() => { setOpen(false); setSubmitted(false); setReason(''); setDetail(''); }}
            style={{
              marginTop: '0.875rem', background: 'none', border: 'none',
              fontSize: '0.78rem', color: '#047857', cursor: 'pointer',
              fontFamily: 'var(--font)', padding: 0,
            }}
          >
            ← Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '1.75rem',
      paddingTop: '1.25rem',
      borderTop: '1px solid var(--border-light)',
    }}>
      <div style={{
        background: 'var(--white)',
        border: '1.5px solid var(--warning)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
      }} className="fade-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L15 14H1L8 1Z" stroke="#D97706" strokeWidth="1.4" fill="rgba(217,119,6,0.1)" strokeLinejoin="round"/>
              <path d="M8 6v3.5M8 11v.3" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400E' }}>
              Flag an issue with this determination
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', fontFamily: 'var(--font)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Reason dropdown */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{
            display: 'block', fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '0.4rem',
          }}>
            Reason *
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.875rem',
              color: reason ? 'var(--text-primary)' : 'var(--text-placeholder)',
              background: 'var(--white)',
              outline: 'none',
              fontFamily: 'var(--font)',
              cursor: 'pointer',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--warning)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          >
            {CONTEST_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Additional detail */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block', fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '0.4rem',
          }}>
            Additional detail <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="Describe the issue in your own words. The more specific, the better."
            rows={3}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              background: 'var(--white)',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'var(--font)',
              lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--warning)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Pathway context note */}
        <div style={{
          background: 'var(--warning-light)',
          borderRadius: 'var(--radius)',
          padding: '0.625rem 0.875rem',
          fontSize: '0.78rem',
          color: '#92400E',
          marginBottom: '1rem',
          display: 'flex', gap: '0.5rem',
        }}>
          <span style={{ flexShrink: 0 }}>→</span>
          <span>
            This flag will be recorded against <strong>{pathway.label}</strong>.
            The determination, your answers, and this flag will be reviewed together.
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: canSubmit ? '#D97706' : 'var(--border)',
              color: canSubmit ? 'white' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius)',
              padding: '0.625rem 1.25rem',
              fontWeight: 700, fontSize: '0.875rem',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font)',
            }}
          >
            Submit flag
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none', border: 'none',
              fontSize: '0.82rem', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PathwayCard({ pathway, explanation, onExplain, explaining }) {
  const explanationBlocks = useMemo(() => formatExplanation(explanation), [explanation]);
  return (
    <div className="slide-up">
      {/* Classification label */}
      <div style={{
        fontSize: '0.68rem', fontWeight: 700,
        color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: '0.875rem',
      }}>
        This procurement is classified as
      </div>

      {/* Main pathway badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.625rem',
        background: pathway.colour + '14',
        border: `2px solid ${pathway.colour}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1.25rem',
        marginBottom: '1.25rem',
        boxShadow: `0 4px 14px ${pathway.colour}22`,
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: pathway.colour, flexShrink: 0,
          boxShadow: `0 0 8px ${pathway.colour}80`,
        }} />
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: pathway.colour, letterSpacing: '-0.01em' }}>
          {pathway.label}
        </span>
        {pathway.exception && (
          <span style={{
            background: '#FEF3C7', color: '#92400E',
            fontSize: '0.68rem', fontWeight: 800,
            padding: '3px 10px', borderRadius: '99px',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Exception
          </span>
        )}
      </div>

      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {pathway.description}
      </p>

      {/* Low confidence warning */}
      {pathway.low_confidence && (
        <div style={{
          background: 'var(--warning-light)',
          border: '1px solid #F59E0B',
          borderRadius: 'var(--radius)',
          padding: '0.875rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          color: '#92400E',
          display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 1L15 14H1L8 1Z" stroke="#D97706" strokeWidth="1.4" fill="rgba(217,119,6,0.12)" strokeLinejoin="round"/>
            <path d="M8 6v3.5M8 11v.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div>
            <strong>Low confidence</strong> — several answers were uncertain. This determination should be verified by a procurement officer before proceeding.
          </div>
        </div>
      )}

      {/* Rationale */}
      <div style={{
        background: 'var(--navy-subtle)',
        borderLeft: `3px solid ${pathway.colour}`,
        borderRadius: '0 var(--radius) var(--radius) 0',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          fontSize: '0.68rem', fontWeight: 800,
          color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: '0.625rem',
        }}>
          Basis for determination
        </div>
        <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {pathway.rationale.map((r, i) => (
            <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* AI explanation */}
      {explanation ? (
        <div style={{
          background: 'linear-gradient(180deg, rgba(0,178,169,0.04) 0%, rgba(255,255,255,1) 100%)',
          border: '1px solid rgba(0,178,169,0.18)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.25rem 1.15rem',
          boxShadow: 'var(--shadow-sm)',
        }} className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem' }}>✦</span>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              AI explanation
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {explanationBlocks.map(block => {
              if (block.type === 'lead') {
                return (
                  <div key={block.key} style={{
                    background: 'var(--white)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    borderRadius: '12px',
                    padding: '0.95rem 1rem',
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.7,
                      fontWeight: 600,
                    }}>
                      {block.body}
                    </div>
                  </div>
                );
              }

              if (block.type === 'section-list') {
                return (
                  <div key={block.key} style={{
                    background: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(148,163,184,0.16)',
                    borderRadius: '12px',
                    padding: '0.9rem 1rem',
                  }}>
                    <div style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '0.45rem',
                    }}>
                      {block.title}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {block.items.map((item, idx) => (
                        <li key={`${block.key}-${idx}`} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              if (block.type === 'section-text') {
                return (
                  <div key={block.key} style={{
                    background: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(148,163,184,0.16)',
                    borderRadius: '12px',
                    padding: '0.9rem 1rem',
                  }}>
                    <div style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '0.45rem',
                    }}>
                      {block.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {block.body}
                    </div>
                  </div>
                );
              }

              if (block.type === 'list') {
                return (
                  <div key={block.key} style={{
                    background: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(148,163,184,0.16)',
                    borderRadius: '12px',
                    padding: '0.9rem 1rem',
                  }}>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {block.items.map((item, idx) => (
                        <li key={`${block.key}-${idx}`} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return (
                <div key={block.key} style={{
                  background: 'rgba(255,255,255,0.78)',
                  border: '1px solid rgba(148,163,184,0.16)',
                  borderRadius: '12px',
                  padding: '0.9rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}>
                  {block.body}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={onExplain}
          disabled={explaining}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'none',
            border: '1.5px solid var(--teal)',
            borderRadius: 'var(--radius)',
            color: 'var(--teal-dark)',
            fontSize: '0.85rem', fontWeight: 600,
            padding: '0.625rem 1.25rem',
            cursor: explaining ? 'wait' : 'pointer',
            opacity: explaining ? 0.7 : 1,
            transition: 'all 0.15s ease',
            fontFamily: 'var(--font)',
          }}
          onMouseEnter={e => { if (!explaining) e.currentTarget.style.background = 'var(--teal-light)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          {explaining ? (
            <>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(0,178,169,0.3)',
                borderTopColor: 'var(--teal)',
                animation: 'spin 0.75s linear infinite',
              }} />
              Generating explanation…
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.95rem' }}>✦</span>
              Explain this in plain English
            </>
          )}
        </button>
      )}

      {/* Contestability */}
      <ContestabilityPanel pathway={pathway} />
    </div>
  );
}
