import React from 'react';

const TAG_LABELS = {
  category:    'Category',
  purpose:     'Purpose',
  definition:  'Definition',
  value:       'Value',
  org:         'Organisation',
  market:      'Market',
  impact:      'Impact',
  overlays:    'Special factors',
  interaction: 'Interaction',
  timing:      'Timeframe',
};

const VALUE_LABELS = {
  micro: 'Under $10k', low: '$10k–$50k', medium: '$50k–$250k',
  high: '$250k–$1M', major: 'Over $1M', unknown: 'TBC',
  ict_saas: 'ICT SaaS', ict_hardware: 'ICT Hardware',
  professional_services: 'Prof. Services', consulting: 'Consulting',
  goods: 'Goods', construction: 'Construction', labour_hire: 'Labour Hire',
  other: 'Other', new: 'New capability', renewal: 'Renewal',
  emergency: 'Emergency', pilot: 'Pilot / PoC', replacement: 'Replacement',
  clear: 'Clear spec', mostly_clear: 'Mostly clear', partial: 'Partially defined',
  exploratory: 'Exploratory', operational: 'Operational', corporate: 'Corporate',
  executive: 'Executive', central: 'Central agency', sole: 'Sole supplier',
  limited: 'Limited (2–3)', some: 'Several (4–10)', broad: 'Broad market',
  critical: 'Critical impact', ai: 'AI/Automated', privacy: 'Privacy/PII',
  critical_ict: 'Critical ICT', overseas: 'Overseas supply', none: 'None',
  minimal: 'Off-the-shelf', quotes: 'Get quotes', tender: 'Formal tender',
  collaborative: 'Collaborative', urgent: 'Under 2 weeks', compressed: '2–8 weeks',
  normal: '2–6 months', extended: '6+ months',
};

function TagBadge({ label }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'var(--teal-light)',
      color: 'var(--teal-dark)',
      border: '1px solid rgba(0,178,169,0.2)',
      borderRadius: '99px',
      padding: '2px 9px',
      fontSize: '0.72rem',
      fontWeight: 600,
      lineHeight: 1.6,
    }}>
      {label}
    </span>
  );
}

export default function ProfilePanel({ profile, currentStep }) {
  if (!profile || currentStep < 2) return null;

  const rows = [];
  for (const [key, label] of Object.entries(TAG_LABELS)) {
    const val = profile[key];
    if (!val || (Array.isArray(val) && val.length === 0)) continue;
    if (key === 'overlays') {
      const visible = val.filter(v => v !== 'none');
      if (visible.length === 0) continue;
      rows.push({ label, values: visible.map(v => VALUE_LABELS[v] || v) });
    } else {
      rows.push({ label, values: [VALUE_LABELS[val] || val] });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius)',
      padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow-xs)',
    }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--teal)',
        }} className="pulse-dot" />
        <span style={{
          fontSize: '0.62rem', fontWeight: 800,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Building your profile
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem', color: 'var(--text-muted)',
              minWidth: '76px', paddingTop: '3px', flexShrink: 0,
            }}>
              {row.label}
            </span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {row.values.map(v => <TagBadge key={v} label={v} />)}
            </div>
          </div>
        ))}
      </div>

      {profile.low_confidence && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem',
          background: 'var(--warning-light)', borderRadius: '6px',
          fontSize: '0.72rem', color: '#92400E',
          display: 'flex', gap: '0.4rem', alignItems: 'flex-start',
        }}>
          <span>⚠</span>
          <span>Several answers are uncertain — outcome may be low confidence</span>
        </div>
      )}
    </div>
  );
}
