import React, { useState } from 'react';
import { submitException } from '../api';

const PATHWAYS = [
  { id: 'open_market', label: 'Open Market — Competitive tender' },
  { id: 'major_strategic', label: 'Major / Strategic — Major procurement process' },
  { id: 'limited_direct', label: 'Limited / Direct — Direct negotiation (exception)' },
  { id: 'simple_purchase', label: 'Simple Purchase — Minimal process' },
  { id: 'quote_based', label: 'Quote-based — Competitive quotes' },
  { id: 'structured_market', label: 'Structured Market — Market engagement' },
  { id: 'emergency_procurement', label: 'Emergency Procurement — Emergency process' },
];

export default function ExceptionForm({ decisionId, pathway }) {
  const [requestedPathway, setRequestedPathway] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit =
    requestedPathway &&
    submittedBy.trim().length > 3 &&
    rationale.trim().length >= 100 &&
    !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitException({
        decision_id: decisionId,
        rationale: rationale.trim(),
        requested_pathway: requestedPathway,
        submitted_by: submittedBy.trim(),
      });
      setSubmitted(result);
    } catch (e) {
      setError(e.message || 'Submission failed — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ padding: '1.5rem 0', maxWidth: '560px' }}>
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '1.25rem',
        }}>
          <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>
            Override request submitted
          </div>
          <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.75rem' }}>
            Your request has been logged and is pending review by the appropriate delegate.
          </div>
          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#374151', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
            Exception ID: {submitted.exception_id}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Status: <strong style={{ color: '#d97706' }}>Pending review</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 0', maxWidth: '600px' }}>
      {/* Warning banner */}
      <div style={{
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '6px',
        padding: '0.875rem 1rem',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        color: '#92400e',
      }}>
        <strong>Important:</strong> This request will be logged in the audit trail and requires review by the appropriate delegated authority. Overrides granted without appropriate justification and approval are a procurement compliance risk.
      </div>

      {/* Current pathway */}
      <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Current pathway: <strong style={{ color: 'var(--navy)' }}>{pathway?.name || 'N/A'}</strong>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Requested pathway */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)' }}>
            Requested alternate pathway <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <select
            value={requestedPathway}
            onChange={e => setRequestedPathway(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '5px',
              border: '1px solid var(--border-light)',
              fontSize: '0.875rem',
              background: 'white',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">— Select a pathway —</option>
            {PATHWAYS.filter(p => p.id !== pathway?.pathway_id).map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>

        {/* Submitted by */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)' }}>
            Submitted by (name and role) <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <input
            type="text"
            value={submittedBy}
            onChange={e => setSubmittedBy(e.target.value)}
            placeholder="e.g. Jane Smith, Senior Procurement Officer"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '5px',
              border: '1px solid var(--border-light)',
              fontSize: '0.875rem',
            }}
          />
        </label>

        {/* Rationale */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)' }}>
            Justification / rationale <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Minimum 100 characters. Explain why the system-determined pathway is not appropriate and how the requested pathway achieves value for money while managing risk.
          </span>
          <textarea
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            rows={6}
            style={{
              padding: '0.625rem 0.75rem',
              borderRadius: '5px',
              border: `1px solid ${rationale.length >= 100 ? '#10b981' : 'var(--border-light)'}`,
              fontSize: '0.875rem',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder="Describe the specific circumstances that make the alternate pathway more appropriate..."
          />
          <div style={{
            fontSize: '0.75rem',
            color: rationale.length >= 100 ? '#10b981' : '#9ca3af',
            textAlign: 'right',
          }}>
            {rationale.length} / 100 characters minimum
          </div>
        </label>

        {error && (
          <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: '0.625rem 1.25rem',
            background: canSubmit ? 'var(--navy)' : '#e5e7eb',
            color: canSubmit ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '5px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-start',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit override request'}
        </button>
      </div>
    </div>
  );
}
