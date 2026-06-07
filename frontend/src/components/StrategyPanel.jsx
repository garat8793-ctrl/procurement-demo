import React, { useState } from 'react';

const RISK_COLOURS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

export default function StrategyPanel({ strategy, onSelect }) {
  const [selected, setSelected] = useState(strategy?.human_selected_option || strategy?.recommended_option || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!strategy?.human_selected_option);

  if (!strategy) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        No strategy generated yet. Run the strategy agent from the sourcing workspace.
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!selected || !onSelect) return;
    setSaving(true);
    try {
      await onSelect(selected);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Rationale */}
      <div style={{
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
        color: '#0c4a6e',
      }}>
        <strong>Agent recommendation:</strong> {strategy.recommended_option}<br />
        <span style={{ color: '#0369a1', marginTop: '0.25rem', display: 'block' }}>{strategy.rationale}</span>
      </div>

      {/* Option cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {(strategy.options || []).map(opt => {
          const isRecommended = opt.label === strategy.recommended_option;
          const isSelected = opt.label === selected;
          return (
            <div
              key={opt.label}
              onClick={() => !saved && setSelected(opt.label)}
              style={{
                background: isSelected ? '#eff6ff' : 'var(--white)',
                border: `2px solid ${isSelected ? '#2563eb' : isRecommended ? '#93c5fd' : 'var(--border-light)'}`,
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                cursor: saved ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                  background: isSelected ? '#2563eb' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>{opt.label}</span>
                {isRecommended && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '9999px', background: '#dbeafe', color: '#1d4ed8' }}>
                    Recommended
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '9999px', background: '#f3f4f6', color: RISK_COLOURS[opt.risk_level] || '#6b7280' }}>
                  {opt.risk_level} risk
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.25rem' }}>Pros</div>
                  {(opt.pros || []).map((p, i) => <div key={i} style={{ color: '#166534' }}>+ {p}</div>)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '0.25rem' }}>Cons</div>
                  {(opt.cons || []).map((c, i) => <div key={i} style={{ color: '#92400e' }}>− {c}</div>)}
                </div>
              </div>
              {opt.timeline_estimate && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Estimated timeline: {opt.timeline_estimate}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!saved ? (
        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          style={{
            padding: '0.625rem 1.25rem',
            background: selected ? 'var(--navy)' : '#e5e7eb',
            color: selected ? 'white' : '#9ca3af',
            border: 'none', borderRadius: '5px', fontSize: '0.875rem', fontWeight: 600,
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Confirming...' : 'Confirm strategy selection'}
        </button>
      ) : (
        <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
          ✓ Strategy confirmed: {selected}
        </div>
      )}
    </div>
  );
}
