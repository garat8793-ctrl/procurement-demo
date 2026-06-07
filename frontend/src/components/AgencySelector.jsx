import React, { useEffect, useState, useRef } from 'react';

const TYPE_LABELS = {
  department:              'Department',
  agency:                  'Agency',
  statutory_authority:     'Statutory Authority',
  regulator:               'Regulator',
  independent:             'Independent',
  state_owned_corporation: 'State-Owned Corp',
  public_provider:         'Public Provider',
};

const TYPE_COLOURS = {
  department:              { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  agency:                  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  statutory_authority:     { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  regulator:               { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  independent:             { bg: 'var(--navy-light)', text: 'var(--navy)', border: 'var(--border)' },
  state_owned_corporation: { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  public_provider:         { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
};

function TypeBadge({ type }) {
  const style = TYPE_COLOURS[type] || TYPE_COLOURS.independent;
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700,
      padding: '2px 7px',
      borderRadius: '4px',
      border: `1px solid ${style.border}`,
      background: style.bg, color: style.text,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

export default function AgencySelector({ onSelect, onSkip }) {
  const [agencies, setAgencies] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef();

  useEffect(() => {
    fetch('/api/agencies')
      .then(r => r.json())
      .then(data => {
        const list = data.agencies || [];
        setAgencies(list);
        const seen = new Set();
        const cls = [];
        for (const a of list) {
          if (!seen.has(a.cluster)) { seen.add(a.cluster); cls.push(a.cluster); }
        }
        setClusters(cls);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? agencies.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.cluster.toLowerCase().includes(q) ||
        a.agency_id.toLowerCase().includes(q)
      )
    : agencies;

  const grouped = {};
  for (const a of filtered) {
    if (!grouped[a.cluster]) grouped[a.cluster] = [];
    grouped[a.cluster].push(a);
  }
  const visibleClusters = q ? Object.keys(grouped) : clusters.filter(c => grouped[c]);

  return (
    <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.65rem', fontWeight: 800,
          color: 'var(--teal-dark)',
          background: 'var(--teal-light)',
          borderRadius: '99px', padding: '3px 10px',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: '0.875rem',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 3v3M5 7.5v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Step 1 of 2 — Context
        </div>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.25, margin: 0, letterSpacing: '-0.01em' }}>
          Which agency are you from?
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.55 }}>
          This lets the system apply any agency-specific or cluster-specific procurement rules automatically.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '0.875rem' }}>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{
            position: 'absolute', left: '0.875rem', top: '50%',
            transform: 'translateY(-50%)', pointerEvents: 'none',
            color: 'var(--text-placeholder)',
          }}
        >
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder="Search by agency name or cluster…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          style={{
            width: '100%',
            padding: '0.75rem 0.875rem 0.75rem 2.5rem',
            border: '2px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            background: 'var(--white)',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            fontFamily: 'var(--font)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--teal)';
            e.target.style.boxShadow = '0 0 0 3px rgba(0,178,169,0.12)';
          }}
          onBlur={e => {
            e.target.style.borderColor = selected ? 'var(--teal)' : 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSelected(null); inputRef.current?.focus(); }}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', padding: '2px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Agency list */}
      <div style={{
        maxHeight: '340px', overflowY: 'auto',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--white)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2.5, margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.875rem' }}>Loading agencies…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No agencies match "{query}"
          </div>
        ) : (
          visibleClusters.map((cluster, ci) => (
            <div key={cluster}>
              {/* Cluster header */}
              <div style={{
                padding: '0.375rem 0.875rem',
                background: 'var(--navy-subtle)',
                borderTop: ci > 0 ? '1px solid var(--border-light)' : 'none',
                fontSize: '0.62rem', fontWeight: 900,
                color: 'var(--navy)',
                textTransform: 'uppercase', letterSpacing: '0.10em',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                {cluster}
              </div>

              {grouped[cluster].map(agency => {
                const isSelected = selected?.agency_id === agency.agency_id;
                return (
                  <button
                    key={agency.agency_id}
                    onClick={() => setSelected(agency)}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.875rem',
                      background: isSelected ? 'var(--teal-light)' : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? '3px solid var(--teal)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--navy-subtle)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      flex: 1, fontSize: '0.875rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--teal-dark)' : 'var(--text-primary)',
                      lineHeight: 1.3,
                    }}>
                      {agency.name}
                    </span>
                    <TypeBadge type={agency.agency_type} />
                    {isSelected && (
                      <div style={{
                        width: 18, height: 18,
                        borderRadius: '50%',
                        background: 'var(--teal)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Selected confirmation + actions */}
      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={() => { if (selected) onSelect(selected); }}
          disabled={!selected}
          className="btn-primary"
          style={{ flex: 1, justifyContent: 'center' }}
        >
          {selected
            ? `Continue as ${selected.name.split(' ').slice(0, 3).join(' ')}…`
            : 'Select an agency to continue'}
          {selected && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: '0.82rem',
            cursor: 'pointer', padding: '0.5rem',
            fontFamily: 'var(--font)',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          Skip →
        </button>
      </div>
    </div>
  );
}
