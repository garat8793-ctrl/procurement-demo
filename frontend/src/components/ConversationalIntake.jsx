import React, { useState } from 'react';
import { extractIntake } from '../api';

const VALUE_LABELS = {
  category:    { ict_saas: 'ICT Software / SaaS', ict_hardware: 'ICT Hardware', professional_services: 'Professional Services', consulting: 'Consulting / Advisory', goods: 'Goods & Supplies', construction: 'Construction', labour_hire: 'Labour Hire', other: 'Other' },
  purpose:     { new: 'New capability', renewal: 'Renewal', emergency: 'Emergency', pilot: 'Pilot / PoC', replacement: 'Replacement' },
  definition:  { clear: 'Clear spec ready', mostly_clear: 'Mostly clear', partial: 'Partially defined', exploratory: 'Early / exploratory' },
  value:       { micro: '< $10k', low: '$10k – $50k', medium: '$50k – $250k', high: '$250k – $1M', major: '> $1M' },
  org:         { operational: 'Operational team', corporate: 'Corporate / enabling', executive: 'Executive / senior', central: 'Central / shared services' },
  market:      { sole: 'Sole supplier', limited: '2–3 specialists', some: '4–10 suppliers', broad: 'Many suppliers' },
  impact:      { low: 'Low impact', medium: 'Medium impact', high: 'High impact', critical: 'Critical' },
  interaction: { minimal: 'Off the shelf', quotes: 'Get quotes', tender: 'Formal tender', collaborative: 'Collaborative design' },
  timing:      { urgent: '< 2 weeks', compressed: '2–8 weeks', normal: '2–6 months', extended: '6+ months' },
};

const FIELD_LABELS = {
  category: 'Category', purpose: 'Purpose', definition: 'Requirement clarity',
  value: 'Estimated value', org: 'Organisation level', market: 'Market competition',
  impact: 'Risk / impact', overlays: 'Special considerations', interaction: 'Supplier engagement',
  timing: 'Timeframe',
};

const OVERLAY_LABELS = {
  ai: 'AI / automated decisions', privacy: 'Personal / health data',
  critical_ict: 'Critical ICT infrastructure', construction: 'Construction / built environment',
  overseas: 'Overseas supply chains', sme: 'SME supplier',
};

function ProfileBadge({ field, value, confident }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const displayVal = field === 'overlays'
    ? (Array.isArray(value) ? value.map(v => OVERLAY_LABELS[v] || v).join(', ') : value)
    : (VALUE_LABELS[field]?.[value] || value);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: confident ? 'rgba(0,178,169,0.08)' : 'rgba(245,158,11,0.08)',
      border: `1px solid ${confident ? 'rgba(0,178,169,0.3)' : 'rgba(245,158,11,0.3)'}`,
      borderRadius: '6px', padding: '3px 8px',
    }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {FIELD_LABELS[field] || field}
      </span>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: confident ? 'var(--teal-dark)' : '#92400E' }}>
        {displayVal}
      </span>
      {!confident && <span style={{ fontSize: '0.65rem', color: '#D97706' }}>?</span>}
    </div>
  );
}

function FollowUpCard({ question, answer, onChange }) {
  const isMulti = question.multi;

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '1rem 1.25rem',
    }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.3rem', lineHeight: 1.4 }}>
        {question.question}
      </div>
      <div style={{
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem',
        background: 'rgba(15,23,42,0.04)', borderRadius: '4px', padding: '4px 8px',
        borderLeft: '2px solid var(--border)',
      }}>
        {question.rationale}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {question.options.map(opt => {
          const selected = isMulti
            ? (Array.isArray(answer) ? answer.includes(opt.value) : false)
            : answer === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (isMulti) {
                  const current = Array.isArray(answer) ? answer : [];
                  if (opt.value === 'none') {
                    onChange(['none']);
                  } else {
                    const without = current.filter(v => v !== 'none');
                    onChange(without.includes(opt.value)
                      ? without.filter(v => v !== opt.value)
                      : [...without, opt.value]);
                  }
                } else {
                  onChange(opt.value);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                background: selected ? 'rgba(0,178,169,0.07)' : 'var(--off-white)',
                border: selected ? '1.5px solid var(--teal)' : '1px solid var(--border)',
                borderRadius: '7px', padding: '0.5rem 0.75rem',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color 0.12s ease, background 0.12s ease',
                fontFamily: 'var(--font)',
              }}
            >
              <span style={{
                width: isMulti ? 15 : 15, height: isMulti ? 15 : 15, flexShrink: 0,
                borderRadius: isMulti ? '3px' : '50%',
                border: selected ? '2px solid var(--teal)' : '2px solid var(--border)',
                background: selected ? 'var(--teal)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d={isMulti ? "M1.5 4L3.5 6L6.5 2" : ""} stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    {!isMulti && <circle cx="4" cy="4" r="2" fill="white"/>}
                  </svg>
                )}
              </span>
              <span style={{ fontSize: '0.82rem', color: selected ? 'var(--teal-dark)' : 'var(--text-secondary)', fontWeight: selected ? 600 : 400 }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ConversationalIntake({ selectedAgency, onResult, onSwitchToClassic }) {
  const [description, setDescription] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);

  const handleExtract = async () => {
    if (!description.trim() || description.trim().length < 20) return;
    setExtracting(true);
    setError(null);
    setExtraction(null);
    setAnswers({});
    try {
      const result = await extractIntake(description.trim());
      setExtraction(result);
    } catch (e) {
      setError(e.message || 'Could not analyse your description. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const handleAnswer = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const unansweredRequired = extraction
    ? extraction.follow_up_questions.filter(q => {
        const ans = answers[q.field];
        return !ans || (Array.isArray(ans) && ans.length === 0);
      })
    : [];

  const handleConfirm = async () => {
    if (!extraction || unansweredRequired.length > 0) return;

    // Merge extracted profile with follow-up answers
    const base = { ...extraction.extracted_profile };
    for (const [field, value] of Object.entries(answers)) {
      if (field === 'overlays') {
        base.overlays = Array.isArray(value) ? value.filter(v => v !== 'none') : [];
      } else {
        base[field] = value;
      }
    }
    // Ensure overlays is always an array
    if (!Array.isArray(base.overlays)) base.overlays = [];

    // Pass the merged profile up to App.js to run through the evaluation engine
    onResult(base);
  };

  const profileFields = extraction
    ? Object.entries(extraction.extracted_profile).filter(([k]) => k !== 'overlays')
    : [];
  const overlays = extraction?.extracted_profile?.overlays || [];
  const confidentSet = new Set(extraction?.confident_fields || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.01em' }}>
          Describe what you need to procure
        </h2>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Write it as you'd explain it to a colleague. The system will extract your procurement profile and ask only what it needs to determine the right pathway.
        </p>
      </div>

      {/* Description input */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. We need to replace our case management system for 400 frontline officers. Budget is around $3M, delivery needed before July. We've had a few vendors in mind but haven't gone to market yet. It will handle sensitive client data."
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            fontSize: '0.9rem', fontFamily: 'var(--font)', color: 'var(--text-primary)',
            background: 'var(--white)', border: '1.5px solid var(--border)',
            borderRadius: '10px', padding: '0.875rem 1rem', lineHeight: 1.65,
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--teal)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExtract(); }}
        />
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
          Cmd/Ctrl + Enter to analyse
        </div>
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={handleExtract}
          disabled={extracting || description.trim().length < 20}
          style={{
            background: extracting || description.trim().length < 20 ? 'var(--border)' : 'var(--navy)',
            color: extracting || description.trim().length < 20 ? 'var(--text-muted)' : 'var(--white)',
            border: 'none', borderRadius: '8px', padding: '0.625rem 1.25rem',
            fontWeight: 600, fontSize: '0.88rem', cursor: extracting ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontFamily: 'var(--font)', transition: 'background 0.15s',
          }}
        >
          {extracting ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
              Analysing…
            </>
          ) : 'Analyse description'}
        </button>
        <button
          onClick={onSwitchToClassic}
          style={{
            background: 'none', border: 'none', fontSize: '0.78rem',
            color: 'var(--text-muted)', cursor: 'pointer', padding: 0,
            fontFamily: 'var(--font)',
          }}
        >
          Use guided questionnaire instead →
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.82rem', background: 'var(--danger-light)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
          {error}
        </div>
      )}

      {/* Extraction results */}
      {extraction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Interpretation summary */}
          <div style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-dark) 100%)',
            borderRadius: '10px', padding: '0.875rem 1.125rem',
            color: 'white',
          }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: '0.3rem' }}>
              System interpretation
            </div>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.55, opacity: 0.92 }}>
              {extraction.interpretation}
            </div>
          </div>

          {/* Extracted profile */}
          <div style={{
            background: 'var(--off-white)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '0.875rem 1rem',
          }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
              Extracted profile
              <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: 'var(--teal-dark)' }}>● confirmed</span>
              <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#D97706' }}>● needs clarification</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {profileFields.map(([field, value]) => value && (
                <ProfileBadge key={field} field={field} value={value} confident={confidentSet.has(field)} />
              ))}
              {overlays.length > 0 && (
                <ProfileBadge field="overlays" value={overlays} confident={confidentSet.has('overlays')} />
              )}
            </div>
          </div>

          {/* Follow-up questions */}
          {extraction.follow_up_questions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)' }}>
                {extraction.follow_up_questions.length === 1
                  ? 'One clarification needed before we can determine your pathway:'
                  : `${extraction.follow_up_questions.length} clarifications needed before we can determine your pathway:`}
              </div>
              {extraction.follow_up_questions.map(q => (
                <FollowUpCard
                  key={q.field}
                  question={q}
                  answer={answers[q.field]}
                  onChange={val => handleAnswer(q.field, val)}
                />
              ))}
            </div>
          )}

          {/* Confirm button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <button
              onClick={handleConfirm}
              disabled={unansweredRequired.length > 0}
              style={{
                background: unansweredRequired.length > 0 ? 'var(--border)' : 'var(--teal)',
                color: unansweredRequired.length > 0 ? 'var(--text-muted)' : 'white',
                border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem',
                fontWeight: 700, fontSize: '0.92rem', cursor: unansweredRequired.length > 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', transition: 'background 0.15s',
              }}
            >
              {unansweredRequired.length > 0
                ? `Answer ${unansweredRequired.length} more question${unansweredRequired.length > 1 ? 's' : ''} to continue`
                : 'Determine procurement pathway →'}
            </button>
            <button
              onClick={() => { setExtraction(null); setAnswers({}); }}
              style={{
                background: 'none', border: 'none', fontSize: '0.78rem',
                color: 'var(--text-muted)', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--font)',
              }}
            >
              Edit description
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
