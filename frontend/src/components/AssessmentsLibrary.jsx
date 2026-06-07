import { useState, useEffect, useMemo } from 'react';
import { fetchAssessments } from '../api';

// ── Pathway colour map ───────────────────────────────────────────────────────
const PATHWAY_COLOURS = {
  open_market:        { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  limited_tender:     { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
  quote_based:        { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  panel_calldown:     { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  direct_source:      { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  direct_negotiation: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  exception:          { bg: '#fdf4ff', border: '#e9d5ff', text: '#6b21a8' },
};

function pathwayColour(pathwayId) {
  if (!pathwayId) return { bg: 'var(--navy-light)', border: 'var(--border)', text: 'var(--navy)' };
  const key = Object.keys(PATHWAY_COLOURS).find(k => pathwayId.includes(k));
  return PATHWAY_COLOURS[key] || { bg: 'var(--navy-light)', border: 'var(--border)', text: 'var(--navy)' };
}

// ── Artifact badges ──────────────────────────────────────────────────────────
const ARTIFACT_META = {
  evaluation_result:  { label: 'Result',   colour: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  procurement_details:{ label: 'Details',  colour: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  strategy:           { label: 'Strategy', colour: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  market_assessment:  { label: 'Market',   colour: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  rfx_draft:          { label: 'RFx',      colour: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  eval_plan:          { label: 'Eval Plan',colour: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' },
  approval_summary:   { label: 'Approval', colour: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
};

const DISPLAY_ORDER = ['evaluation_result','procurement_details','strategy','market_assessment','rfx_draft','eval_plan','approval_summary'];

function ArtifactBadge({ type }) {
  const meta = ARTIFACT_META[type];
  if (!meta) return null;
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '0.15rem 0.45rem',
      borderRadius: '4px',
      background: meta.bg,
      color: meta.colour,
      border: `1px solid ${meta.border}`,
      whiteSpace: 'nowrap',
    }}>{meta.label}</span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  ict_saas: 'ICT — SaaS', ict_hardware: 'ICT — Hardware',
  ict_development: 'ICT — Dev', professional_services: 'Prof. Services',
  consulting: 'Consulting', goods: 'Goods', construction: 'Construction',
  labour_hire: 'Labour Hire', other: 'Other',
};

const VALUE_LABELS = {
  micro: 'Micro', low: 'Low', medium: 'Medium', high: 'High', major: 'Major',
};

function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 2)   return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7)   return `${diffDays}d ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AssessmentsLibrary({ onLoad }) {
  const [assessments, setAssessments] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    setListLoading(true);
    fetchAssessments()
      .then(data => { setAssessments(data); setListLoading(false); })
      .catch(e => { setListError(e.message); setListLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter(a =>
      (a.procurement_title || '').toLowerCase().includes(q) ||
      (a.pathway_label || '').toLowerCase().includes(q) ||
      (a.profile_summary?.category || '').toLowerCase().includes(q) ||
      (a.profile_summary?.agency_name || '').toLowerCase().includes(q)
    );
  }, [assessments, search]);

  const handleLoad = async (assessment) => {
    setLoadingId(assessment.decision_id);
    try {
      await onLoad(assessment.decision_id);
    } catch (e) {
      console.error('Load failed', e);
    } finally {
      setLoadingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem clamp(1rem, 2.5vw, 2rem)' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.02em' }}>
          Saved assessments
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          Select any assessment to reload it with all its generated strategy, market intelligence, and documents.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-placeholder)' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search by title, pathway, category, or agency…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5625rem 0.75rem 0.5625rem 2.25rem',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            background: 'var(--white)',
            fontFamily: 'var(--font)',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* States */}
      {listLoading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading assessments…</p>
        </div>
      )}

      {listError && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
          Could not load assessments: {listError}
        </div>
      )}

      {!listLoading && !listError && assessments.length === 0 && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
          padding: '3.5rem 2rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.4 }}>📋</div>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>No assessments yet</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Complete an assessment and it will appear here for future reference.
          </div>
        </div>
      )}

      {!listLoading && !listError && assessments.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No assessments match "{search}"
        </div>
      )}

      {/* Assessment cards */}
      {!listLoading && !listError && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(a => {
            const pc = pathwayColour(a.pathway_id);
            const isLoading = loadingId === a.decision_id;
            const sortedArtifacts = DISPLAY_ORDER.filter(t => a.artifact_types.includes(t));
            const category = CATEGORY_LABELS[a.profile_summary?.category] || a.profile_summary?.category;
            const value = VALUE_LABELS[a.profile_summary?.value];
            const agency = a.profile_summary?.agency_name;
            const overlays = a.profile_summary?.overlays || [];

            return (
              <div
                key={a.decision_id}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem 1.25rem',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                }}
              >
                {/* Left: pathway colour strip */}
                <div style={{
                  width: 4, borderRadius: 4, alignSelf: 'stretch', flexShrink: 0,
                  background: pc.text, opacity: 0.7,
                }} />

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {a.procurement_title || 'Untitled assessment'}
                    </div>
                    {a.human_override && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.1rem 0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                        Override
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
                    {/* Pathway badge */}
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem',
                      borderRadius: '99px', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`,
                    }}>
                      {a.pathway_label}
                    </span>

                    {/* Category */}
                    {category && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ opacity: 0.4 }}>·</span> {category}
                      </span>
                    )}

                    {/* Value */}
                    {value && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ opacity: 0.4 }}>·</span> {value} value
                      </span>
                    )}

                    {/* Agency */}
                    {agency && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ opacity: 0.4 }}>·</span> {agency}
                      </span>
                    )}

                    {/* Overlays */}
                    {overlays.filter(o => ['ai','privacy','critical_ict'].includes(o)).map(o => (
                      <span key={o} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid #fde68a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {o.replace('_', ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Artifact badges */}
                  {sortedArtifacts.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {sortedArtifacts.map(t => <ArtifactBadge key={t} type={t} />)}
                    </div>
                  )}
                </div>

                {/* Right: timestamp + load button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.625rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-placeholder)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(a.timestamp)}
                  </span>
                  <button
                    onClick={() => handleLoad(a)}
                    disabled={!!loadingId}
                    style={{
                      background: isLoading ? 'var(--border)' : 'var(--navy)',
                      color: isLoading ? 'var(--text-muted)' : 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.875rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: loadingId ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font)',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s',
                      minWidth: '4.5rem',
                    }}
                  >
                    {isLoading ? 'Loading…' : 'Load →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!listLoading && filtered.length > 0 && (
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-placeholder)', textAlign: 'right' }}>
          {filtered.length === assessments.length
            ? `${assessments.length} assessment${assessments.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${assessments.length} assessments`}
        </div>
      )}
    </div>
  );
}
