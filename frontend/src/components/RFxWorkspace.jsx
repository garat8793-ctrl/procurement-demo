import React, { useState, useEffect, useCallback } from 'react';
import { draftRFx, draftEvalPlan, draftApprovalSummary, saveArtifact } from '../api';

const SECTION_LABELS = {
  // RFx — supplier-facing sections
  invitation_and_background: 'Invitation & Background',
  scope_of_work: 'Scope of Work',
  mandatory_and_desirable_requirements: 'Mandatory & Desirable Requirements',
  how_to_respond: 'How to Respond',
  evaluation_approach: 'How Responses Will Be Evaluated',
  conditions_of_participation: 'Conditions of Participation',
  // Approval summary sections
  executive_summary: 'Executive Summary',
  key_facts: 'Key Facts',
  obligations_summary: 'Obligations Summary',
  value_for_money_statement: 'Value for Money Statement',
  recommendation: 'Recommendation',
};

// ── Serialise any section value to editable plain text ────────────────────────
function valueToText(value) {
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')))
      .join('\n');
  }
  if (value !== null && typeof value === 'object') {
    // Flatten nested objects to "key: value" lines for easy editing
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : String(v ?? '')}`)
      .join('\n');
  }
  return String(value ?? '');
}

// ── Parse edited text back to the original shape ─────────────────────────────
function textToValue(text, original) {
  if (Array.isArray(original)) {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }
  if (original !== null && typeof original === 'object') {
    // Re-parse "key: value" lines back to object
    const obj = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      // Restore semi-colon arrays if the original was an array
      if (Array.isArray(original[k])) {
        obj[k] = v.split(';').map(s => s.trim()).filter(Boolean);
      } else {
        obj[k] = v;
      }
    }
    return obj;
  }
  return text;
}

// ── Pencil icon ───────────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M7.5 1.5L10.5 4.5L4 11H1V8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Read-only section value renderer ─────────────────────────────────────────
function SectionValue({ value }) {
  if (Array.isArray(value)) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {value.map((item, i) => (
          <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
            {typeof item === 'object' && item !== null ? <SectionValue value={item} /> : item}
          </li>
        ))}
      </ul>
    );
  }
  if (value !== null && typeof value === 'object') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '0.25rem' }}>
              {k.replace(/_/g, ' ')}
            </div>
            <SectionValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {String(value ?? '')}
    </div>
  );
}

// ── Editable section card ─────────────────────────────────────────────────────
function SectionCard({ label, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditText(valueToText(value));
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(textToValue(editText, value));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setEditing(false);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${editing ? '#93c5fd' : 'var(--border-light)'}`,
      borderRadius: '6px',
      padding: '1rem',
      transition: 'border-color 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
          {label}
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            title="Edit section"
            style={{
              background: 'none', border: '1px solid transparent', borderRadius: '4px',
              cursor: 'pointer', color: 'var(--text-muted)', padding: '3px 6px',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '0.7rem', fontFamily: 'inherit',
              transition: 'color 0.12s, border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; }}
          >
            <PencilIcon /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '100%',
              minHeight: Array.isArray(value) || typeof value === 'object' ? '160px' : '120px',
              padding: '0.625rem 0.75rem',
              border: '1.5px solid #3b82f6',
              borderRadius: '5px',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              lineHeight: 1.65,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              color: 'var(--text-primary)',
              background: '#fafbff',
            }}
          />
          {Array.isArray(value) && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              One item per line
            </div>
          )}
          {value !== null && typeof value === 'object' && !Array.isArray(value) && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Format: <code style={{ fontSize: '0.68rem' }}>key: value</code> — one per line
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
              ⌘↵ to save · Esc to cancel
            </span>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '0.3rem 0.75rem', background: 'none',
                border: '1px solid var(--border)', borderRadius: '4px',
                fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.3rem 0.875rem',
                background: saving ? '#93c5fd' : '#2563eb',
                color: 'white', border: 'none', borderRadius: '4px',
                fontSize: '0.8rem', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <SectionValue value={value} />
      )}
    </div>
  );
}

// ── Editable eval plan criterion row ─────────────────────────────────────────
function CriterionRow({ criterion, index, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(criterion);
  const [saving, setSaving] = useState(false);

  // Sync if parent changes (e.g. full reload)
  useEffect(() => { if (!editing) setDraft(criterion); }, [criterion, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...draft, weighting: parseFloat(draft.weighting) || criterion.weighting });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const field = (key, type = 'text') => ({
    value: draft[key] ?? '',
    onChange: e => setDraft(prev => ({ ...prev, [key]: type === 'number' ? e.target.value : e.target.value })),
    style: {
      width: '100%', padding: '0.3rem 0.5rem', border: '1.5px solid #3b82f6',
      borderRadius: '4px', fontSize: '0.82rem', fontFamily: 'inherit',
      background: '#fafbff', outline: 'none', boxSizing: 'border-box',
    },
  });

  const tdBase = { padding: '0.5rem 0.75rem', verticalAlign: 'top' };

  if (editing) {
    return (
      <tr style={{ background: '#eff6ff', borderBottom: '2px solid #93c5fd' }}>
        <td style={{ ...tdBase, fontWeight: 600 }}>
          <input {...field('label')} placeholder="Criterion label" />
        </td>
        <td style={{ ...tdBase, textAlign: 'center' }}>
          <input
            {...field('weighting', 'number')}
            type="number" min="0" max="1" step="0.05"
            style={{ ...field('weighting', 'number').style, width: '72px', textAlign: 'center' }}
          />
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>0–1</div>
        </td>
        <td style={{ ...tdBase, textAlign: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={!!draft.is_mandatory}
              onChange={e => setDraft(prev => ({ ...prev, is_mandatory: e.target.checked }))}
            />
            Mandatory
          </label>
        </td>
        <td style={tdBase}>
          <textarea
            value={draft.scoring_guidance ?? ''}
            onChange={e => setDraft(prev => ({ ...prev, scoring_guidance: e.target.value }))}
            style={{ ...field('scoring_guidance').style, minHeight: '72px', resize: 'vertical' }}
            placeholder="Scoring guidance…"
          />
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setDraft(criterion); setEditing(false); }}
              style={{ padding: '0.2rem 0.6rem', background: 'none', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '0.2rem 0.6rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      style={{ background: index % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid var(--border-light)' }}
    >
      <td style={{ ...tdBase, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {criterion.label}
          <button
            onClick={() => setEditing(true)}
            title="Edit criterion"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center',
              opacity: 0.6,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#2563eb'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <PencilIcon />
          </button>
        </div>
      </td>
      <td style={{ ...tdBase, textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>
        {Math.round(criterion.weighting * 100)}%
      </td>
      <td style={{ ...tdBase, textAlign: 'center' }}>
        {criterion.is_mandatory ? '✓' : '—'}
      </td>
      <td style={{ ...tdBase, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
        {(criterion.scoring_guidance || '').slice(0, 120)}{(criterion.scoring_guidance || '').length > 120 ? '…' : ''}
      </td>
    </tr>
  );
}

// ── Inline text edit helper (methodology / panel guidance) ────────────────────
function EditableText({ value, onSave, placeholder, minHeight = '80px' }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setText(value || ''); }, [value, editing]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(text); setEditing(false); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
          autoFocus
          placeholder={placeholder}
          style={{
            width: '100%', minHeight, padding: '0.5rem 0.75rem',
            border: '1.5px solid #3b82f6', borderRadius: '5px',
            fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: 1.6,
            resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            color: 'var(--text-primary)', background: '#fafbff',
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.625rem', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.25rem 0.625rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        fontSize: '0.85rem', color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
        lineHeight: 1.6, whiteSpace: 'pre-wrap', cursor: 'text',
        padding: '0.25rem', borderRadius: '4px', border: '1px solid transparent',
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.background = '#f0f9ff'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
    >
      {value || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{placeholder || 'Click to edit…'}</span>}
    </div>
  );
}

// ── Main workspace ────────────────────────────────────────────────────────────
export default function RFxWorkspace({ procurementId, profile, strategy, obligations, pathway, approvals, result, details, savedDrafts, onDraftGenerated }) {
  const [activeDoc, setActiveDoc] = useState('rfx');
  const [rfxDraft, setRfxDraft] = useState(() => savedDrafts?.rfx_draft || null);
  const [evalPlan, setEvalPlan] = useState(() => savedDrafts?.eval_plan || null);
  const [approvalSummary, setApprovalSummary] = useState(() => savedDrafts?.approval_summary || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync persisted drafts into local state when they arrive (async hydration from DB)
  useEffect(() => {
    if (savedDrafts?.rfx_draft && !rfxDraft)                setRfxDraft(savedDrafts.rfx_draft);
    if (savedDrafts?.eval_plan && !evalPlan)                 setEvalPlan(savedDrafts.eval_plan);
    if (savedDrafts?.approval_summary && !approvalSummary)  setApprovalSummary(savedDrafts.approval_summary);
  }, [savedDrafts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist helper — updates state + notifies parent + saves to DB ──────────
  const persistDraft = useCallback(async (type, data) => {
    if (type === 'rfx_draft')        setRfxDraft(data);
    if (type === 'eval_plan')        setEvalPlan(data);
    if (type === 'approval_summary') setApprovalSummary(data);
    onDraftGenerated?.(type, data);
    if (procurementId) {
      saveArtifact(procurementId, type, data).catch(err => console.warn('Artifact save failed:', err.message));
    }
  }, [procurementId, onDraftGenerated]);

  // ── Generate ────────────────────────────────────────────────────────────────
  const currentDraft = activeDoc === 'rfx' ? rfxDraft : activeDoc === 'eval' ? evalPlan : approvalSummary;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeDoc === 'rfx' && !rfxDraft) {
        const res = await draftRFx({ procurement_id: procurementId, profile, strategy, obligations, details });
        await persistDraft('rfx_draft', res);
      } else if (activeDoc === 'eval' && !evalPlan) {
        const res = await draftEvalPlan({ procurement_id: procurementId, profile, strategy, details });
        await persistDraft('eval_plan', res);
      } else if (activeDoc === 'approval' && !approvalSummary) {
        const res = await draftApprovalSummary({ procurement_id: procurementId, profile, pathway, obligations, approvals, details });
        await persistDraft('approval_summary', res);
      }
    } catch (e) {
      setError(e.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Section save handlers ───────────────────────────────────────────────────
  const handleRfxSectionSave = async (key, newValue) => {
    const updated = { ...rfxDraft, sections: { ...rfxDraft.sections, [key]: newValue } };
    await persistDraft('rfx_draft', updated);
  };

  const handleApprovalSectionSave = async (key, newValue) => {
    const updated = { ...approvalSummary, [key]: newValue };
    await persistDraft('approval_summary', updated);
  };

  const handleEvalMethodologySave = async (newValue) => {
    const updated = { ...evalPlan, methodology: newValue };
    await persistDraft('eval_plan', updated);
  };

  const handleEvalPanelGuidanceSave = async (newValue) => {
    const updated = { ...evalPlan, evaluation_panel_guidance: newValue };
    await persistDraft('eval_plan', updated);
  };

  const handleCriterionSave = async (criterionId, updatedCriterion) => {
    const updatedCriteria = (evalPlan.criteria || []).map(c =>
      c.criterion_id === criterionId ? updatedCriterion : c
    );
    const updated = { ...evalPlan, criteria: updatedCriteria };
    await persistDraft('eval_plan', updated);
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Procurement title banner */}
      {details?.title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '7px',
          padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#0c4a6e',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1.5" y="1" width="11" height="12" rx="1.5" stroke="#0c4a6e" strokeWidth="1.4"/>
            <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke="#0c4a6e" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>
            <strong>{details.title}</strong>
            {details.indicative_budget ? ` · ${details.indicative_budget}` : ''}
            {details.contract_duration ? ` · ${details.contract_duration.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      )}

      {/* Doc type tabs + generate button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { id: 'rfx', label: 'RFx Document' },
          { id: 'eval', label: 'Evaluation Plan' },
          { id: 'approval', label: 'Approval Summary' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveDoc(t.id)}
            style={{
              padding: '0.375rem 0.875rem', borderRadius: '5px', border: 'none',
              background: activeDoc === t.id ? 'var(--navy)' : '#f3f4f6',
              color: activeDoc === t.id ? 'white' : 'var(--text-secondary)',
              fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.label}
            {(t.id === 'rfx' && rfxDraft) || (t.id === 'eval' && evalPlan) || (t.id === 'approval' && approvalSummary)
              ? ' ✓' : ''}
          </button>
        ))}

        <button
          onClick={generate}
          disabled={loading || !!currentDraft}
          style={{
            marginLeft: 'auto',
            padding: '0.375rem 1rem',
            background: !loading && !currentDraft ? '#2563eb' : '#e5e7eb',
            color: !loading && !currentDraft ? 'white' : '#9ca3af',
            border: 'none', borderRadius: '5px', fontSize: '0.825rem', fontWeight: 600,
            cursor: !loading && !currentDraft ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Generating…' : currentDraft ? 'Generated ✓' : 'Generate draft'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', padding: '0.625rem 0.875rem', borderRadius: '5px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ── Eval plan ──────────────────────────────────────────────────────── */}
      {activeDoc === 'eval' && evalPlan && (
        <div>
          {/* Methodology */}
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Evaluation Methodology
              </span>
            </div>
            <EditableText
              value={evalPlan.methodology}
              onSave={handleEvalMethodologySave}
              placeholder="Describe the evaluation methodology…"
              minHeight="60px"
            />
          </div>

          {/* Criteria table */}
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--navy)', color: 'white' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Criterion</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '80px' }}>Weight</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '90px' }}>Mandatory</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Scoring guidance</th>
                </tr>
              </thead>
              <tbody>
                {(evalPlan.criteria || []).map((c, i) => (
                  <CriterionRow
                    key={c.criterion_id}
                    criterion={c}
                    index={i}
                    onSave={(updated) => handleCriterionSave(c.criterion_id, updated)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel guidance */}
          {(evalPlan.evaluation_panel_guidance !== undefined) && (
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>
                Panel Guidance
              </div>
              <EditableText
                value={evalPlan.evaluation_panel_guidance}
                onSave={handleEvalPanelGuidanceSave}
                placeholder="Panel guidance…"
                minHeight="60px"
              />
            </div>
          )}
        </div>
      )}

      {/* ── RFx sections ───────────────────────────────────────────────────── */}
      {activeDoc === 'rfx' && rfxDraft && (
        <>
          {/* Supplier-facing banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.625rem 0.875rem', fontSize: '0.8rem', color: '#0c4a6e' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6" stroke="#0284c7" strokeWidth="1.4"/>
              <path d="M7 6v4M7 4.5v.5" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span><strong>Supplier-facing document.</strong> This draft is addressed to responding suppliers — click any section's <strong>Edit</strong> button to refine the content.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(rfxDraft.sections || {}).filter(([k]) => k !== 'procurement_id').map(([key, value]) => (
              <SectionCard
                key={key}
                label={SECTION_LABELS[key] || key}
                value={value}
                onSave={(newValue) => handleRfxSectionSave(key, newValue)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Approval summary sections ───────────────────────────────────────── */}
      {activeDoc === 'approval' && approvalSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(approvalSummary).filter(([k]) => k !== 'procurement_id').map(([key, value]) => (
            <SectionCard
              key={key}
              label={SECTION_LABELS[key] || key}
              value={value}
              onSave={(newValue) => handleApprovalSectionSave(key, newValue)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!currentDraft && !loading && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>
          Click "Generate draft" to produce a first-pass{' '}
          {activeDoc === 'rfx' ? 'RFx document' : activeDoc === 'eval' ? 'evaluation plan' : 'approval summary'}.
        </div>
      )}
    </div>
  );
}
