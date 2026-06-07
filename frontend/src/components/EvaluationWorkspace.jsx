import React, { useState, useRef } from 'react';
import { assessSubmission, getEvaluationReport } from '../api';

export default function EvaluationWorkspace({ procurementId, criteria, profile, evaluations: evaluationsProp, onEvaluationsChange }) {
  const [submissions, setSubmissions] = useState([]);
  const [evaluations, _setEvaluations] = useState(evaluationsProp || []);
  const [assessing, setAssessing] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const setEvaluations = (updater) => {
    _setEvaluations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onEvaluationsChange?.(next);
      return next;
    });
  };

  const addSubmission = () => {
    setSubmissions(prev => [...prev, { id: Date.now(), supplier_id: '', supplier_name: '', file: null, text: '' }]);
  };

  const updateSub = (id, field, value) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAssess = async (sub) => {
    if (!sub.supplier_name.trim()) { setError('Supplier name required'); return; }
    setAssessing(sub.id);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('procurement_id', procurementId);
      formData.append('supplier_id', sub.supplier_id || `SUP-${sub.id}`);
      formData.append('supplier_name', sub.supplier_name);
      formData.append('criteria_json', JSON.stringify(criteria || []));
      formData.append('profile_json', JSON.stringify(profile || {}));
      if (sub.file) formData.append('file', sub.file);
      formData.append('pasted_text', sub.text || '');

      const result = await assessSubmission(formData);
      setEvaluations(prev => [...prev.filter(e => e.supplier_id !== result.supplier_id), result]);
    } catch (e) {
      setError(e.message || 'Assessment failed');
    } finally {
      setAssessing(null);
    }
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>Supplier submissions</div>
        <button
          onClick={addSubmission}
          style={{ padding: '0.35rem 0.875rem', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
        >
          + Add supplier
        </button>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '5px', marginBottom: '1rem', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {submissions.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1.5rem', textAlign: 'center', background: '#fafafa', borderRadius: '6px', border: '1px dashed var(--border-light)' }}>
          Add supplier responses above to begin evaluation.
        </div>
      )}

      {submissions.map(sub => {
        const evaluated = evaluations.find(e => e.supplier_id === (sub.supplier_id || `SUP-${sub.id}`));
        return (
          <div key={sub.id} style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '7px', padding: '1rem', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Supplier name *"
                value={sub.supplier_name}
                onChange={e => updateSub(sub.id, 'supplier_name', e.target.value)}
                style={{ padding: '0.4rem 0.625rem', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.82rem', flex: '1 1 180px' }}
              />
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={e => updateSub(sub.id, 'file', e.target.files[0])}
                style={{ fontSize: '0.78rem', flex: '1 1 180px' }}
              />
              <button
                onClick={() => handleAssess(sub)}
                disabled={assessing === sub.id || !!evaluated}
                style={{
                  padding: '0.4rem 0.875rem',
                  background: evaluated ? '#e5e7eb' : assessing === sub.id ? '#9ca3af' : '#2563eb',
                  color: evaluated || assessing === sub.id ? '#6b7280' : 'white',
                  border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                  cursor: evaluated || assessing === sub.id ? 'not-allowed' : 'pointer',
                }}
              >
                {assessing === sub.id ? 'Assessing...' : evaluated ? '✓ Assessed' : 'Assess'}
              </button>
            </div>

            <div style={{ marginTop: '0.625rem' }}>
              <textarea
                placeholder="Or paste submission text here..."
                value={sub.text}
                onChange={e => updateSub(sub.id, 'text', e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.4rem 0.625rem', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.78rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {evaluated && (
              <div style={{ marginTop: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.375rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#15803d' }}>Score: {evaluated.total_weighted_score}/10</span>
                  <span style={{ fontSize: '0.8rem', color: evaluated.mandatory_pass ? '#15803d' : '#dc2626' }}>
                    {evaluated.mandatory_pass ? '✓ Mandatory gates passed' : '✗ Failed mandatory gate'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#166534' }}>{evaluated.agent_summary}</div>
              </div>
            )}
          </div>
        );
      })}

      {evaluations.length > 0 && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '7px', fontSize: '0.82rem', color: '#0c4a6e' }}>
          <strong>{evaluations.length} supplier{evaluations.length > 1 ? 's' : ''} assessed.</strong> Proceed to Award Recommendation to view the ranked comparison and make a final decision.
        </div>
      )}
    </div>
  );
}
