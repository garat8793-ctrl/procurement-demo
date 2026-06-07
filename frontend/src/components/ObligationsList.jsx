import React, { useState } from 'react';
import { useCitations } from '../CitationsContext';

const SOURCE_COLOURS = {
  core: { bg: 'var(--navy-light)', border: 'var(--navy)', text: 'var(--navy)', label: 'Policy' },
  ICT_WOG: { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', label: 'ICT Scheme' },
  CONSTRUCTION: { bg: '#F0FDF4', border: '#16A34A', text: '#15803D', label: 'Construction' },
  GOODS_BUYNSW: { bg: '#FEF3C7', border: '#D97706', text: '#92400E', label: 'Buy.NSW' },
};

function getSourceStyle(source) {
  return SOURCE_COLOURS[source] || { bg: 'var(--off-white)', border: 'var(--border)', text: 'var(--text-muted)', label: source };
}

export default function ObligationsList({ obligations, matchedSchemes }) {
  const [expanded, setExpanded] = useState({});
  const showCitations = useCitations();

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (obligations.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No policy obligations apply to this procurement profile.
      </p>
    );
  }

  return (
    <div>
      {/* Mandatory obligations header */}
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem', marginTop: 0 }}>
        The following policy obligations apply to this procurement and must be complied with.
      </p>

      {/* Matched schemes badges */}
      {matchedSchemes && matchedSchemes.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active scheme overlays:</span>
          {matchedSchemes.map(s => (
            <span key={s.scheme_id} style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: getSourceStyle(s.scheme_id).bg,
              color: getSourceStyle(s.scheme_id).text,
              border: `1px solid ${getSourceStyle(s.scheme_id).border}`,
              padding: '2px 8px',
              borderRadius: '99px',
            }}>
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {obligations.map(obl => {
          const style = getSourceStyle(obl.source);
          const isOpen = expanded[obl.id];
          return (
            <div key={obl.id} style={{
              background: style.bg,
              border: `1px solid ${style.border}33`,
              borderLeft: `3px solid ${style.border}`,
              borderRadius: '0 8px 8px 0',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(obl.id)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {obl.title}
                    </span>
                    {obl.source !== 'core' && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: style.border + '22',
                        color: style.text,
                        padding: '1px 6px',
                        borderRadius: '99px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {style.label}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0, marginTop: '2px' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 1rem 0.875rem 1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                    {obl.body}
                  </p>
                  {showCitations && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'baseline' }}>
                      {obl.policy && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {obl.policy}
                        </span>
                      )}
                      {obl.citation && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: style.text,
                          background: style.border + '18',
                          border: `1px solid ${style.border}44`,
                          borderRadius: '99px',
                          padding: '1px 7px',
                          fontStyle: 'normal',
                        }}>
                          {obl.citation}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
