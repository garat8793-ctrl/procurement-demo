import React, { useState } from 'react';
import ProgressBar from './ProgressBar';
import AnswerOption from './AnswerOption';

// Scaffolding for the four questions with the most pathway impact.
// Shown as an expandable "How to answer this" panel.
const SCAFFOLDING = {
  Q3: {
    label: 'Specification clarity',
    example: '"Clearly defined" — you have a written spec, agreed deliverables, and acceptance criteria. "Exploratory" — you know the problem but not the solution yet.',
    consequence: 'This drives whether market engagement is needed before choosing an approach. Overestimating clarity creates poorly-scoped contracts; underestimating it adds unnecessary time and cost.',
  },
  Q4: {
    label: 'Budget estimate',
    example: 'Use total contract value including all option periods. $80k/year × 3 years = $240k → "Medium ($50k–$250k)". If genuinely uncertain, pick the upper bound of your likely range.',
    consequence: 'Value is the primary pathway driver. It determines whether you can direct-source, seek quotes, or must run an open tender — and which delegation level must approve.',
  },
  Q5: {
    label: 'Organisation level',
    example: '"Operational" — your team buying tools for your own use. "Executive" — agency-wide capability. "Central agency" — DCS, Treasury, or PMC buying on behalf of whole-of-government.',
    consequence: 'Determines which whole-of-government standing offers and panels must be considered first, and which delegation tier signs off.',
  },
  Q8: {
    label: 'Special factors',
    example: 'A chatbot that recommends decisions = AI/Automated. Software processing health records or identity data = Privacy/PII. Payroll, courts, emergency systems = Critical ICT. Supplier based overseas = Overseas supply.',
    consequence: 'Each factor triggers a mandatory pre-check scheme with specific obligations that apply regardless of procurement value. Missing one creates compliance risk.',
  },
};

function ScaffoldingPanel({ scaffolding }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'none', border: 'none', padding: 0,
          fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--teal-dark)', cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M6.5 4v4M6.5 9v.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        How to answer this
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          marginTop: '0.625rem',
          background: 'var(--teal-subtle)',
          border: '1px solid rgba(0,178,169,0.18)',
          borderRadius: 'var(--radius)',
          padding: '0.875rem 1rem',
          display: 'flex', flexDirection: 'column', gap: '0.625rem',
        }} className="fade-in">
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
              Example
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {scaffolding.example}
            </p>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,178,169,0.15)', paddingTop: '0.625rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
              Why this matters
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {scaffolding.consequence}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionCard({ question, onAnswer, currentStep, totalSteps, onBack, canGoBack }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const isMulti = question.type === 'multi';
  const scaffolding = SCAFFOLDING[question.id];

  const handleSelect = (optionId) => {
    const opt = question.options.find(o => o.id === optionId);

    if (!isMulti) {
      onAnswer(question.id, [optionId]);
    } else {
      if (opt?.exclusive) {
        setSelectedIds([optionId]);
      } else {
        const exclusiveOpt = question.options.find(o => o.exclusive);
        setSelectedIds(prev => {
          const withoutExclusive = prev.filter(id => id !== exclusiveOpt?.id);
          if (withoutExclusive.includes(optionId)) {
            return withoutExclusive.filter(id => id !== optionId);
          }
          return [...withoutExclusive, optionId];
        });
      }
    }
  };

  const handleContinue = () => {
    if (selectedIds.length > 0) {
      onAnswer(question.id, selectedIds);
    }
  };

  return (
    <div style={{ width: 'min(100%, 960px)', margin: '0 auto' }} className="slide-up">
      <ProgressBar current={currentStep} total={totalSteps} />

      {/* Context chip row */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: '0.68rem', fontWeight: 800,
          color: 'rgba(255,255,255,0.9)',
          background: 'var(--navy)',
          borderRadius: '99px',
          padding: '3px 10px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          Q{currentStep}
        </span>
        {scaffolding && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '99px',
            padding: '2px 10px',
          }}>
            {scaffolding.label}
          </span>
        )}
        {isMulti && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '99px',
            padding: '2px 10px',
          }}>
            Select all that apply
          </span>
        )}
      </div>

      {/* System hint from question data */}
      {question.hint && (
        <div style={{
          display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
          background: 'var(--navy-subtle)',
          border: '1px solid var(--navy-light)',
          borderRadius: 'var(--radius)',
          padding: '0.625rem 0.875rem',
          marginBottom: '1rem',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="7" cy="7" r="6.5" stroke="var(--navy)" strokeOpacity="0.4" />
            <path d="M7 6v4M7 4.5v.01" stroke="var(--navy)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {question.hint}
          </span>
        </div>
      )}

      {/* Question text */}
      <h2 style={{
        fontSize: '1.45rem',
        fontWeight: 800,
        color: 'var(--navy)',
        lineHeight: 1.3,
        marginBottom: scaffolding ? '1rem' : '1.5rem',
        letterSpacing: '-0.01em',
      }}>
        {question.text}
      </h2>

      {/* Scaffolding panel — only for high-impact questions */}
      {scaffolding && <ScaffoldingPanel scaffolding={scaffolding} />}

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {question.options.map(opt => (
          <AnswerOption
            key={opt.id}
            option={opt}
            selected={selectedIds.includes(opt.id)}
            onSelect={handleSelect}
            multi={isMulti}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '1.75rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-light)',
      }}>
        {canGoBack ? (
          <button onClick={onBack} className="btn-ghost" style={{ fontSize: '0.82rem' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        ) : (
          <div />
        )}

        {isMulti && (
          <button onClick={handleContinue} disabled={selectedIds.length === 0} className="btn-primary">
            Continue
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
