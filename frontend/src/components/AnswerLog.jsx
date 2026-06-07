import React from 'react';

// Short labels for questions — used as the row heading
const QUESTION_LABELS = {
  Q1: 'What are you buying?',
  Q2: 'Purpose',
  Q3: 'How defined is it?',
  Q4: 'Budget estimate',
  Q5: 'Organisation level',
  Q6: 'Market shape',
  Q7: 'Risk / impact',
  Q8: 'Special factors',
  Q9: 'Market interaction',
  Q10: 'Timing',
};

export default function AnswerLog({ answers, questions }) {
  if (!answers || answers.length === 0) return null;

  // Build option lookup: option_id → {label, description}
  const optionMap = {};
  for (const q of questions) {
    for (const opt of q.options) {
      optionMap[opt.id] = opt;
    }
  }

  // Build question lookup: question_id → question object
  const questionMap = {};
  for (const q of questions) {
    questionMap[q.id] = q;
  }

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.625rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'var(--off-white)',
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5.5" stroke="var(--text-muted)" />
          <path d="M4 6l1.5 1.5L8 4" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Your answers
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'var(--teal)',
          background: 'var(--teal-light)',
          padding: '1px 6px',
          borderRadius: '99px',
        }}>
          {answers.length}
        </span>
      </div>

      {/* Answer rows */}
      <div style={{ padding: '0.375rem 0' }}>
        {answers.map((answer, idx) => {
          const q = questionMap[answer.question_id];
          if (!q) return null;

          const selectedOpts = answer.option_ids
            .map(id => optionMap[id])
            .filter(Boolean);

          const shortLabel = QUESTION_LABELS[answer.question_id] || q.text;
          const isNotSure = selectedOpts.some(o => o.not_sure);

          return (
            <div
              key={answer.question_id}
              style={{
                padding: '0.5rem 1rem',
                borderBottom: idx < answers.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Question label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginBottom: '0.3rem',
              }}>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: 'var(--white)',
                  background: 'var(--navy)',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  lineHeight: 1.6,
                  letterSpacing: '0.03em',
                  flexShrink: 0,
                }}>
                  Q{idx + 1}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}>
                  {shortLabel}
                </span>
              </div>

              {/* Selected answer(s) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '1.125rem' }}>
                {selectedOpts.map(opt => (
                  <span
                    key={opt.id}
                    title={opt.description}
                    style={{
                      display: 'inline-block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      lineHeight: 1.5,
                      background: isNotSure ? '#FEF3C7' : 'var(--teal-light)',
                      color: isNotSure ? '#92400E' : 'var(--teal-dark)',
                      border: `1px solid ${isNotSure ? '#FDE68A' : 'rgba(0,178,169,0.25)'}`,
                    }}
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--off-white)',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        lineHeight: 1.4,
      }}>
        These answers determine which rules and approvals apply.
      </div>
    </div>
  );
}
