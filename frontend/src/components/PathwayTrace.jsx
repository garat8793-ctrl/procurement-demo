import React from 'react';

const RULE_LABELS = {
  R1: 'Emergency / Urgent',
  R2: 'Major / Strategic',
  R3: 'Limited Market or Sole Source',
  R4: 'Simple Purchase',
  R5: 'Quote-based (Low Value)',
  R6: 'Quote-based (Medium Value)',
  R7: 'Structured Market Engagement',
  R8: 'Open Market (Default)',
};

export default function PathwayTrace({ pathway }) {
  const trace = pathway?.rule_trace || [];
  const matchedRule = trace.find(r => r.matched);

  if (trace.length === 0) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        <p>Policy trace not available for this assessment.</p>
        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Re-evaluate to generate a full rule trace.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Header */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>§§</span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>
            Pathway selected: <span style={{ color: pathway.colour }}>{pathway.name}</span>
            {matchedRule && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> — matched by Rule {matchedRule.rule_id}</span>}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {trace.length} rules evaluated in priority order. First match wins.
          </div>
        </div>
      </div>

      {/* Rule cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {trace.map(rule => (
          <RuleCard key={rule.rule_id} rule={rule} />
        ))}
      </div>
    </div>
  );
}

function RuleCard({ rule }) {
  const isMatched = rule.matched;

  return (
    <div style={{
      background: isMatched ? 'var(--white)' : '#fafafa',
      border: `1px solid ${isMatched ? '#2563eb' : 'var(--border-light)'}`,
      borderLeft: `4px solid ${isMatched ? '#2563eb' : '#d1d5db'}`,
      borderRadius: '6px',
      padding: '0.875rem 1rem',
      opacity: isMatched ? 1 : 0.75,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        {/* Rule badge */}
        <div style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: isMatched ? '#2563eb' : '#e5e7eb',
          color: isMatched ? '#fff' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
          fontFamily: 'monospace',
        }}>
          {rule.rule_id}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Rule name + match status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: isMatched ? 'var(--navy)' : 'var(--text-secondary)',
            }}>
              {RULE_LABELS[rule.rule_id] || rule.description}
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              background: isMatched ? '#dbeafe' : '#f3f4f6',
              color: isMatched ? '#1d4ed8' : '#6b7280',
            }}>
              {isMatched ? '✓ MATCHED' : 'not matched'}
            </span>
          </div>

          {/* Fields evaluated */}
          {rule.field_values && Object.keys(rule.field_values).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.375rem' }}>
              {Object.entries(rule.field_values).map(([k, v]) => (
                v != null && (
                  <span key={k} style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontFamily: 'monospace',
                  }}>
                    {k}={String(v)}
                  </span>
                )
              ))}
            </div>
          )}

          {/* Stop reason (if not matched) */}
          {!isMatched && rule.stop_reason && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic', marginBottom: '0.3rem' }}>
              {rule.stop_reason}
            </div>
          )}

          {/* Policy citation */}
          {rule.policy_citation && (
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              § {rule.policy_citation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
