import React, { useState } from 'react';
import { getNegotiationBrief } from '../api';

export default function AwardRecommendation({ procurementId, evaluations, profile }) {
  const [awardedSupplier, setAwardedSupplier] = useState(null);
  const [brief, setBrief] = useState(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [briefError, setBriefError] = useState(null);

  if (!evaluations || evaluations.length === 0) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
        No evaluations complete. Assess supplier submissions first.
      </div>
    );
  }

  const sorted = [...evaluations].sort((a, b) => {
    if (a.mandatory_pass !== b.mandatory_pass) return b.mandatory_pass ? 1 : -1;
    return b.total_weighted_score - a.total_weighted_score;
  });

  const handleAward = async (supplier) => {
    setAwardedSupplier(supplier);
    setLoadingBrief(true);
    setBriefError(null);
    try {
      const result = await getNegotiationBrief({
        procurement_id: procurementId,
        profile,
        preferred_supplier_id: supplier.supplier_id,
        preferred_supplier_name: supplier.supplier_name,
        evaluation_results: evaluations,
      });
      setBrief(result);
    } catch (e) {
      setBriefError(e.message || 'Could not generate negotiation brief');
    } finally {
      setLoadingBrief(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Guardrail notice */}
      <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e' }}>
        <strong>Human decision required.</strong> The table below shows agent-generated evidence and scores. The final award decision must be made by the evaluation panel and approved by the appropriate delegate. The agent does not recommend a winner.
      </div>

      {/* Ranked table */}
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--navy)', color: 'white' }}>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Rank</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Supplier</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Score /10</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Mandatory gates</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Agent summary</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Panel action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev, i) => (
              <tr key={ev.evaluation_id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: i === 0 && ev.mandatory_pass ? '#15803d' : 'var(--text-secondary)' }}>
                  {i === 0 && ev.mandatory_pass ? '1st' : `${i + 1}${['st','nd','rd'][i] || 'th'}`}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{ev.supplier_name}</td>
                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 700, color: ev.total_weighted_score >= 7 ? '#15803d' : ev.total_weighted_score >= 5 ? '#d97706' : '#dc2626' }}>
                  {ev.total_weighted_score}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: ev.mandatory_pass ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                  {ev.mandatory_pass ? '✓ Pass' : '✗ Fail'}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                  {ev.agent_summary?.slice(0, 120)}{ev.agent_summary?.length > 120 ? '…' : ''}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                  {ev.mandatory_pass ? (
                    <button
                      onClick={() => handleAward(ev)}
                      disabled={!!awardedSupplier}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: awardedSupplier?.supplier_id === ev.supplier_id ? '#10b981' : awardedSupplier ? '#e5e7eb' : 'var(--navy)',
                        color: awardedSupplier ? (awardedSupplier?.supplier_id === ev.supplier_id ? 'white' : '#9ca3af') : 'white',
                        border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        cursor: awardedSupplier ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {awardedSupplier?.supplier_id === ev.supplier_id ? '✓ Preferred' : 'Select preferred'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Ineligible</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Negotiation brief */}
      {awardedSupplier && (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '1rem' }}>
            Negotiation brief — {awardedSupplier.supplier_name}
          </div>

          {loadingBrief && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Generating negotiation brief…</div>}
          {briefError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{briefError}</div>}

          {brief && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {brief.executive_context && <BriefSection label="Context" value={brief.executive_context} />}
              {brief.agency_leverage && <BriefSection label="Agency leverage points" value={brief.agency_leverage} />}
              {brief.supplier_leverage && <BriefSection label="Supplier leverage points" value={brief.supplier_leverage} />}
              {brief.batna && <BriefSection label="BATNA" value={brief.batna} />}
              {brief.opening_positions && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opening positions</div>
                  {brief.opening_positions.map((pos, i) => (
                    <div key={i} style={{ background: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: '5px', padding: '0.625rem 0.875rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{pos.term}</div>
                      <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '0.25rem' }}>Open with: {pos.agency_position} | Walk-away: {pos.walk_away}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{pos.rationale}</div>
                    </div>
                  ))}
                </div>
              )}
              {brief.non_standard_risks && <BriefSection label="Non-standard clause risks" value={brief.non_standard_risks} />}
              {brief.mandatory_nsw_terms && <BriefSection label="NSW mandatory contract terms" value={brief.mandatory_nsw_terms} />}
              {brief.negotiation_strategy && <BriefSection label="Negotiation strategy" value={brief.negotiation_strategy} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefSection({ label, value }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {Array.isArray(value)
        ? <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>{value.map((v, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{v}</li>)}</ul>
        : <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{value}</div>
      }
    </div>
  );
}
