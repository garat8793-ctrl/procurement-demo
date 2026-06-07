import React, { useState, useRef, useContext } from 'react';
import { CitationsContext } from '../CitationsContext';

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.txt,.md';

const TRIGGER_COLOURS = {
  category:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  value:       { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  impact:      { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  overlays:    { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  purpose:     { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  market:      { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  org:         { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' },
  timing:      { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
};

// ── helpers ────────────────────────────────────────────────────────────────

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (ext === 'docx' || ext === 'doc') return '📝';
  return '📃';
}

// ── File drop zone ─────────────────────────────────────────────────────────

function FileDrop({ file, onFile, onClear }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  const handle = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) {
      alert('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
      return;
    }
    onFile(f);
  };

  return (
    <div
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${over ? 'var(--teal)' : file ? 'var(--teal)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        background: over ? 'var(--teal-light)' : file ? 'var(--teal-subtle)' : 'var(--white)',
        padding: '1.25rem',
        cursor: file ? 'default' : 'pointer',
        transition: 'all 0.15s ease',
        minHeight: '90px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />

      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <span style={{ fontSize: '1.5rem' }}>{fileIcon(file.name)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--teal-dark)' }}>{file.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB</div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem' }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📎</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Drop a file or <span style={{ color: 'var(--teal-dark)', fontWeight: 600 }}>click to browse</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            PDF · DOCX · TXT · MD
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trigger chip ───────────────────────────────────────────────────────────

function TriggerChip({ triggerKey, value, onRemove }) {
  const c = TRIGGER_COLOURS[triggerKey] || { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.72rem', fontWeight: 700,
      padding: '3px 8px 3px 9px',
      borderRadius: '99px',
      border: `1px solid ${c.border}`,
      background: c.bg, color: c.text,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ opacity: 0.65, fontWeight: 600 }}>{triggerKey}:</span> {value}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none', border: 'none', padding: '1px',
            color: c.text, cursor: 'pointer', opacity: 0.6,
            display: 'flex', alignItems: 'center',
            lineHeight: 1, fontFamily: 'var(--font)',
          }}
          title={`Remove ${triggerKey}: ${value}`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </span>
  );
}

// ── Obligation card (structured edit) ─────────────────────────────────────

function ObligationCard({ obl, index, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(obl);
  const showCitations = useContext(CitationsContext);

  const save = () => { onUpdate(index, draft); setEditing(false); };
  const cancel = () => { setDraft(obl); setEditing(false); };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.625rem',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    outline: 'none',
    fontFamily: 'var(--font)',
  };

  if (editing) {
    return (
      <div style={{
        background: 'var(--white)',
        border: '1.5px solid var(--teal)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        boxShadow: '0 0 0 3px rgba(0,178,169,0.10)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
              Title *
            </label>
            <input
              value={draft.title || ''}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
              What must be done *
            </label>
            <textarea
              value={draft.body || ''}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
              Policy / Act reference *
            </label>
            <input
              value={draft.policy || ''}
              onChange={e => setDraft(d => ({ ...d, policy: e.target.value }))}
              placeholder="e.g. Procurement Policy Framework s4.2"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={save}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Save
            </button>
            <button onClick={cancel} className="btn-ghost" style={{ fontSize: '0.8rem' }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '0.875rem 1rem',
      transition: 'border-color 0.15s ease',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.3rem', lineHeight: 1.3 }}>
            {obl.title || <span style={{ color: 'var(--text-placeholder)', fontStyle: 'italic' }}>Untitled obligation</span>}
          </div>
          {obl.body && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 0.4rem' }}>
              {obl.body}
            </p>
          )}
          {showCitations && obl.policy && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--off-white)',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              padding: '2px 8px',
            }}>
              {obl.policy}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '3px 10px',
              fontSize: '0.72rem', fontWeight: 600,
              color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font)', transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal-dark)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(index)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '3px 7px',
              fontSize: '0.72rem', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Remove obligation"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pre-check card ─────────────────────────────────────────────────────────

function PreCheckCard({ pc, index, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pc);

  const save = () => { onUpdate(index, draft); setEditing(false); };
  const cancel = () => { setDraft(pc); setEditing(false); };

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.625rem',
    border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
    fontSize: '0.82rem', color: 'var(--text-primary)',
    background: 'var(--white)', outline: 'none', fontFamily: 'var(--font)',
  };

  if (editing) {
    return (
      <div style={{
        background: '#FFFBEB', border: '1.5px solid #F59E0B',
        borderRadius: 'var(--radius-md)', padding: '1rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Title *</label>
            <input value={draft.title || ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>What must be confirmed *</label>
            <textarea value={draft.body || ''} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Guidance link (optional)</label>
            <input value={draft.link || ''} onChange={e => setDraft(d => ({ ...d, link: e.target.value }))} placeholder="https://…" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={save} style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Save</button>
            <button onClick={cancel} className="btn-ghost" style={{ fontSize: '0.8rem' }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#FFFBEB', border: '1px solid #FDE68A',
      borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#78350F', marginBottom: '0.3rem', lineHeight: 1.3 }}>
            {pc.title || <span style={{ fontStyle: 'italic' }}>Untitled pre-check</span>}
          </div>
          {pc.body && (
            <p style={{ fontSize: '0.8rem', color: '#92400E', lineHeight: 1.55, margin: '0 0 0.3rem' }}>{pc.body}</p>
          )}
          {pc.link && (
            <a href={pc.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600 }}>
              {pc.link} ↗
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button
            onClick={() => setEditing(true)}
            style={{ background: 'none', border: '1px solid #FDE68A', borderRadius: '6px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, color: '#92400E', cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(index)}
            style={{ background: 'none', border: '1px solid #FDE68A', borderRadius: '6px', padding: '3px 7px', fontSize: '0.72rem', color: '#92400E', cursor: 'pointer', fontFamily: 'var(--font)' }}
            title="Remove pre-check"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Structured scheme editor ───────────────────────────────────────────────

function StructuredSchemeEditor({ scheme, warnings, onUpdate, onSave, saving, saved }) {
  const [showJson, setShowJson] = useState(false);
  const [addingObl, setAddingObl] = useState(false);
  const [addingPc, setAddingPc] = useState(false);
  const [newObl, setNewObl] = useState({ title: '', body: '', policy: '' });
  const [newPc, setNewPc] = useState({ title: '', body: '', link: '' });

  const update = (patch) => onUpdate({ ...scheme, ...patch });

  const removeTriggerValue = (key, val) => {
    const current = Array.isArray(scheme.triggers[key]) ? scheme.triggers[key] : [scheme.triggers[key]];
    const next = current.filter(v => v !== val);
    const newTriggers = { ...scheme.triggers };
    if (next.length === 0) delete newTriggers[key];
    else newTriggers[key] = next;
    update({ triggers: newTriggers });
  };

  const updateObligation = (i, updated) => {
    const obls = [...(scheme.obligations || [])];
    obls[i] = updated;
    update({ obligations: obls });
  };

  const removeObligation = (i) => {
    const obls = (scheme.obligations || []).filter((_, idx) => idx !== i);
    update({ obligations: obls });
  };

  const addObligation = () => {
    if (!newObl.title.trim() || !newObl.body.trim()) return;
    const id = `${scheme.scheme_id}-OBL-${String((scheme.obligations || []).length + 1).padStart(3, '0')}`;
    update({ obligations: [...(scheme.obligations || []), { ...newObl, id, active: true }] });
    setNewObl({ title: '', body: '', policy: '' });
    setAddingObl(false);
  };

  const updatePreCheck = (i, updated) => {
    const pcs = [...(scheme.pre_checks || [])];
    pcs[i] = updated;
    update({ pre_checks: pcs });
  };

  const removePreCheck = (i) => {
    const pcs = (scheme.pre_checks || []).filter((_, idx) => idx !== i);
    update({ pre_checks: pcs });
  };

  const addPreCheck = () => {
    if (!newPc.title.trim() || !newPc.body.trim()) return;
    const id = `${scheme.scheme_id}-PC-${String((scheme.pre_checks || []).length + 1).padStart(3, '0')}`;
    update({ pre_checks: [...(scheme.pre_checks || []), { ...newPc, id }] });
    setNewPc({ title: '', body: '', link: '' });
    setAddingPc(false);
  };

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.625rem',
    border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
    fontSize: '0.875rem', color: 'var(--text-primary)',
    background: 'var(--white)', outline: 'none', fontFamily: 'var(--font)',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.65rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: '0.35rem',
  };

  const triggerEntries = [];
  for (const [key, vals] of Object.entries(scheme.triggers || {})) {
    const arr = Array.isArray(vals) ? vals : [vals];
    for (const v of arr) triggerEntries.push({ key, value: v });
  }

  return (
    <div>
      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div style={{
          background: 'var(--warning-light)', border: '1px solid #F59E0B',
          borderRadius: 'var(--radius)', padding: '0.875rem 1rem', marginBottom: '1.25rem',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#92400E', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" stroke="#D97706" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M7 5.5v2.5M7 9.5v.3" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Review before saving
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '0.8rem', color: '#92400E', marginLeft: '1.1rem' }}>• {w}</div>
          ))}
        </div>
      )}

      {/* ── Identity ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          Scheme identity
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.75rem', alignItems: 'start' }}>
          <div>
            <label style={labelStyle}>Scheme ID</label>
            <input
              value={scheme.scheme_id || ''}
              onChange={e => update({ scheme_id: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Scheme name</label>
            <input
              value={scheme.name || ''}
              onChange={e => update({ name: e.target.value })}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
        {scheme.description && (
          <div style={{ marginTop: '0.625rem' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={scheme.description}
              onChange={e => update({ description: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontSize: '0.82rem' }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        )}
      </section>

      {/* ── Triggers ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Trigger conditions
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {triggerEntries.length} value{triggerEntries.length !== 1 ? 's' : ''}
          </span>
        </div>
        {triggerEntries.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No trigger conditions extracted — this scheme will apply to all procurements.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {triggerEntries.map(({ key, value }) => (
              <TriggerChip
                key={`${key}-${value}`}
                triggerKey={key}
                value={value}
                onRemove={() => removeTriggerValue(key, value)}
              />
            ))}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          This scheme applies when the procurement profile matches <strong>all</strong> of the above conditions. Remove any that are incorrect.
        </div>
      </section>

      {/* ── Obligations ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Obligations
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {(scheme.obligations || []).length} extracted
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.625rem' }}>
          {(scheme.obligations || []).map((obl, i) => (
            <ObligationCard
              key={obl.id || i}
              obl={obl}
              index={i}
              onUpdate={updateObligation}
              onRemove={removeObligation}
            />
          ))}
        </div>

        {addingObl ? (
          <div style={{
            background: 'var(--white)', border: '1.5px solid var(--teal)',
            borderRadius: 'var(--radius-md)', padding: '1rem',
            boxShadow: '0 0 0 3px rgba(0,178,169,0.09)',
          }} className="fade-in">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              New obligation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={newObl.title} onChange={e => setNewObl(o => ({ ...o, title: e.target.value }))} style={inputStyle} placeholder="Short descriptive title" onFocus={e => e.target.style.borderColor = 'var(--teal)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div>
                <label style={labelStyle}>What must be done *</label>
                <textarea value={newObl.body} onChange={e => setNewObl(o => ({ ...o, body: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Plain English description of the requirement" onFocus={e => e.target.style.borderColor = 'var(--teal)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div>
                <label style={labelStyle}>Policy / Act reference *</label>
                <input value={newObl.policy} onChange={e => setNewObl(o => ({ ...o, policy: e.target.value }))} style={inputStyle} placeholder="e.g. Procurement Policy Framework s4.2" onFocus={e => e.target.style.borderColor = 'var(--teal)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={addObligation} disabled={!newObl.title.trim() || !newObl.body.trim()} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>Add obligation</button>
                <button onClick={() => { setAddingObl(false); setNewObl({ title: '', body: '', policy: '' }); }} className="btn-ghost" style={{ fontSize: '0.8rem' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingObl(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', border: '1.5px dashed rgba(0,178,169,0.4)',
              borderRadius: 'var(--radius)', padding: '0.5rem 0.875rem',
              fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal-dark)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            + Add obligation
          </button>
        )}
      </section>

      {/* ── Pre-checks ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Pre-checks
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {(scheme.pre_checks || []).length} extracted
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.625rem' }}>
          {(scheme.pre_checks || []).map((pc, i) => (
            <PreCheckCard
              key={pc.id || i}
              pc={pc}
              index={i}
              onUpdate={updatePreCheck}
              onRemove={removePreCheck}
            />
          ))}
        </div>

        {addingPc ? (
          <div style={{
            background: '#FFFBEB', border: '1.5px solid #F59E0B',
            borderRadius: 'var(--radius-md)', padding: '1rem',
          }} className="fade-in">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              New pre-check
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div>
                <label style={{ ...labelStyle, color: '#92400E' }}>Title *</label>
                <input value={newPc.title} onChange={e => setNewPc(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="What must be confirmed?" />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#92400E' }}>What must be confirmed *</label>
                <textarea value={newPc.body} onChange={e => setNewPc(p => ({ ...p, body: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#92400E' }}>Guidance link (optional)</label>
                <input value={newPc.link} onChange={e => setNewPc(p => ({ ...p, link: e.target.value }))} style={inputStyle} placeholder="https://…" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={addPreCheck} disabled={!newPc.title.trim() || !newPc.body.trim()} style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Add pre-check</button>
                <button onClick={() => { setAddingPc(false); setNewPc({ title: '', body: '', link: '' }); }} className="btn-ghost" style={{ fontSize: '0.8rem' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingPc(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', border: '1.5px dashed rgba(217,119,6,0.4)',
              borderRadius: 'var(--radius)', padding: '0.5rem 0.875rem',
              fontSize: '0.78rem', fontWeight: 600, color: '#D97706',
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,119,6,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            + Add pre-check
          </button>
        )}
      </section>

      {/* ── Raw JSON toggle ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowJson(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '0.5rem 0.875rem',
            fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-placeholder)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M4 3.5L1.5 6.5L4 9.5M9 3.5l2.5 3L9 9.5M6 2l-1.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {showJson ? 'Hide' : 'View'} raw JSON
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: showJson ? 'rotate(180deg)' : 'none' }}>
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showJson && (
          <div style={{ marginTop: '0.625rem' }} className="fade-in">
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Read-only view. Edit using the structured fields above.
            </div>
            <pre style={{
              background: 'var(--off-white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1rem',
              fontSize: '0.72rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              overflow: 'auto',
              maxHeight: '360px',
              margin: 0,
              fontFamily: "'Consolas', 'Monaco', monospace",
            }}>
              {JSON.stringify(scheme, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* ── Save ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
        <button
          onClick={onSave}
          disabled={saving || saved}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: saved ? 'var(--success)' : 'var(--navy)',
            color: 'white', border: 'none',
            borderRadius: 'var(--radius)', padding: '0.75rem 1.5rem',
            fontWeight: 700, fontSize: '0.9rem',
            cursor: saving || saved ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            fontFamily: 'var(--font)',
          }}
        >
          {saved ? (
            <>
              <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                <path d="M1 5.5L5.5 10L13 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Saved to schemes/
            </>
          ) : saving ? 'Saving…' : 'Save to rules engine'}
        </button>
        {saved && (
          <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
            Reload the page to activate this scheme in the assessment engine.
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ArtifactIngester() {
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState(null);
  const [editedScheme, setEditedScheme] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canExtract = (pastedText.trim().length > 20 || file) && !extracting;

  const handleExtract = async () => {
    setExtracting(true);
    setResult(null);
    setError(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append('pasted_text', pastedText.trim());
      if (file) formData.append('file', file);

      const res = await fetch('/api/artifacts/extract', { method: 'POST', body: formData });
      const text = await res.text();
      if (!res.ok) {
        let detail = text;
        try { detail = JSON.parse(text).detail || text; } catch {}
        throw new Error(detail.slice(0, 300));
      }
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error(`Invalid response from server: ${text.slice(0, 100)}`);
      }
      setResult(data);
      setEditedScheme(data.scheme);
    } catch (e) {
      setError(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!editedScheme) return;
    setSaving(true);
    try {
      const res = await fetch('/api/artifacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedScheme),
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = text;
        try { detail = JSON.parse(text).detail || text; } catch {}
        throw new Error(detail.slice(0, 300));
      }
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setResult(null); setEditedScheme(null);
    setError(null); setSaved(false);
    setPastedText(''); setFile(null);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.4rem', letterSpacing: '-0.01em' }}>
          Policy Artifact Ingestion
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '620px' }}>
          Paste policy text or upload a document. The system extracts obligations, triggers, and pre-checks
          into a rules-as-code scheme — which you review, edit, and save to the engine.
        </p>
      </div>

      {!result ? (
        /* ── Input panel ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Text paste */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
              Paste policy text
            </label>
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder={`Paste the text of the policy, direction, or scheme rules here.\n\nCan be used alone or combined with a file upload.`}
              style={{
                width: '100%', minHeight: '240px',
                fontFamily: 'var(--font)', fontSize: '0.82rem', lineHeight: 1.6,
                color: 'var(--text-primary)', background: 'var(--white)',
                border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '0.875rem', resize: 'vertical', outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            {pastedText.trim().length > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                {pastedText.trim().length.toLocaleString()} characters
              </div>
            )}
          </div>

          {/* Upload + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                Upload document
              </label>
              <FileDrop file={file} onFile={setFile} onClear={() => setFile(null)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>both can be used together</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            </div>

            <div style={{ background: 'var(--navy-subtle)', borderRadius: 'var(--radius)', padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>What happens next</div>
              <ol style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <li>Claude reads the document and extracts obligations, triggers, and pre-checks</li>
                <li>You review and edit the extracted scheme using structured cards</li>
                <li>Save it to the rules engine — active immediately on next assessment</li>
              </ol>
            </div>

            <button
              onClick={handleExtract}
              disabled={!canExtract}
              className="btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                padding: '0.875rem 1.5rem', fontSize: '1rem',
                background: canExtract ? undefined : 'var(--border)',
                color: canExtract ? undefined : 'var(--text-muted)',
                boxShadow: canExtract ? undefined : 'none',
              }}
            >
              {extracting ? (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.75s linear infinite' }} />
                  Extracting rules…
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.95rem' }}>✦</span>
                  Extract rules from artifact
                </>
              )}
            </button>

            {error && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#991B1B' }}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>

      ) : (
        /* ── Result panel ── */
        <div>
          {/* Source summary bar */}
          <div style={{
            background: 'var(--white)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius)', padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            marginBottom: '1.75rem', flexWrap: 'wrap',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Extracted
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {result.char_count?.toLocaleString()} characters processed
            </span>
            {file && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>· {file.name}</span>}
            {pastedText.trim() && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>· Pasted text included</span>}
            <button
              onClick={handleReset}
              className="btn-ghost"
              style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
            >
              ← Extract another
            </button>
          </div>

          <StructuredSchemeEditor
            scheme={editedScheme}
            warnings={result.warnings}
            onUpdate={setEditedScheme}
            onSave={handleSave}
            saving={saving}
            saved={saved}
          />

          {error && (
            <div style={{ marginTop: '0.75rem', background: 'var(--danger-light)', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#991B1B' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
