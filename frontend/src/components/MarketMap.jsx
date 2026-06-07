import React from 'react';

const DEPTH_LABELS = { thin: { label: 'Thin market', color: '#ef4444' }, moderate: { label: 'Moderate market', color: '#f59e0b' }, deep: { label: 'Deep market', color: '#10b981' } };
const RISK_LABELS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

export default function MarketMap({ assessment }) {
  if (!assessment) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        No market assessment yet. Run the market intelligence agent.
      </div>
    );
  }

  const depth = DEPTH_LABELS[assessment.market_depth] || { label: assessment.market_depth, color: '#6b7280' };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: '0.875rem', flexWrap: 'wrap', marginBottom: '1.5rem',
      }}>
        <Chip label={`${assessment.supplier_count} suppliers`} bg="#f3f4f6" color="#374151" />
        <Chip label={depth.label} bg={depth.color + '20'} color={depth.color} />
        <Chip label={`Competition risk: ${assessment.competition_risk}`} bg={RISK_LABELS[assessment.competition_risk] + '20'} color={RISK_LABELS[assessment.competition_risk]} />
        {assessment.sme_opportunity && <Chip label="SME opportunity" bg="#d1fae5" color="#065f46" />}
        {assessment.aboriginal_business_present && <Chip label="Aboriginal businesses present" bg="#fef3c7" color="#92400e" />}
        {assessment.incumbent_identified && <Chip label="Incumbent risk" bg="#fee2e2" color="#991b1b" />}
      </div>

      {/* Incumbents warning */}
      {assessment.incumbent_identified && assessment.incumbents?.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#9a3412' }}>
          <strong>Incumbent risk:</strong> {assessment.incumbents.join(', ')} may have an advantage in this procurement. Consider probity provisions and incumbent separation requirements.
        </div>
      )}

      {/* Market signals */}
      {assessment.signals?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.625rem' }}>Market intelligence signals</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {assessment.signals.map((s, i) => (
              <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderLeft: '3px solid #2563eb', borderRadius: '0 5px 5px 0', padding: '0.625rem 0.875rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplier clusters */}
      {assessment.supplier_clusters?.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.875rem' }}>Supplier clusters</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {assessment.supplier_clusters.map((cluster, i) => (
              <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: '7px', padding: '0.875rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--navy)', marginBottom: '0.375rem' }}>{cluster.name}</div>
                {cluster.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {cluster.tags.map(t => <span key={t} style={{ fontSize: '0.68rem', background: '#f3f4f6', color: '#6b7280', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>{t}</span>)}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {(cluster.suppliers || []).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, bg, color }) {
  return (
    <span style={{ padding: '0.25rem 0.625rem', background: bg, color, borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
      {label}
    </span>
  );
}
