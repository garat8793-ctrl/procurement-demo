import React, { useMemo, useState } from 'react';

const LEVEL_COLOURS = ['', '#059669', '#0891B2', '#2563EB', '#7C3AED', '#D97706', '#DC2626'];

function styleForStep(step, finalColour) {
  if (step.kind === 'review') {
    return {
      eyebrow: 'Required review',
      accent: 'var(--teal)',
      bg: 'rgba(0,178,169,0.06)',
      border: 'rgba(0,178,169,0.22)',
    };
  }
  if (step.kind === 'sign_off') {
    return {
      eyebrow: 'Additional mandatory sign-off',
      accent: '#7C3AED',
      bg: 'rgba(124,58,237,0.06)',
      border: 'rgba(124,58,237,0.22)',
    };
  }
  if (step.is_final || step.kind === 'final_approval') {
    return {
      eyebrow: 'Final approval',
      accent: finalColour,
      bg: `${finalColour}14`,
      border: `${finalColour}66`,
    };
  }
  return {
    eyebrow: 'Approval step',
    accent: 'var(--navy)',
    bg: 'var(--white)',
    border: 'rgba(15,23,42,0.10)',
  };
}

function ApprovalCard({ step, index, isLast, finalColour }) {
  const tone = styleForStep(step, finalColour);

  return (
    <div className="approval-chain-row" style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }}>
      <div className="approval-chain-marker" style={{ width: '84px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: tone.accent,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem',
          fontWeight: 800,
          boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
        }}>
          {index + 1}
        </div>
        {!isLast && (
          <div className="approval-chain-line" style={{
            width: 3,
            flex: 1,
            marginTop: '0.45rem',
            borderRadius: '999px',
            background: 'linear-gradient(180deg, rgba(148,163,184,0.35) 0%, rgba(148,163,184,0.08) 100%)',
            minHeight: '56px',
          }} />
        )}
      </div>

      <div style={{
        flex: 1,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: '0 14px 14px 0',
        padding: '1rem 1.1rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: tone.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {tone.eyebrow}
          </div>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '99px',
            padding: '3px 9px',
          }}>
            Step {index + 1}
          </div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.4, marginBottom: '0.35rem' }}>
          {step.title}
        </div>
        {step.note && (
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {step.note}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalPath({ approvals }) {
  const [showEApprovalsModal, setShowEApprovalsModal] = useState(false);
  const colour = LEVEL_COLOURS[Math.min(approvals.delegate_level, 6)] || 'var(--navy)';
  const approvalSteps = approvals.approval_steps || [];
  const eApprovalsId = useMemo(() => {
    const ts = Date.now().toString(36).toUpperCase().slice(-6);
    return `EAPP-${ts}`;
  }, [showEApprovalsModal]);

  return (
    <div>
      <style>{`
        @media (max-width: 640px) {
          .approval-chain-row {
            flex-direction: column;
            gap: 0.65rem;
          }
          .approval-chain-marker {
            width: 100% !important;
            flex-direction: row !important;
            justify-content: flex-start;
            gap: 0.75rem;
          }
          .approval-chain-line {
            display: none;
          }
        }
      `}</style>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem', marginTop: 0 }}>
        The following approvals are required before this procurement can proceed.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowEApprovalsModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'var(--navy)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Send to eApprovals
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        background: `${colour}10`,
        border: `1px solid ${colour}33`,
        borderRadius: '14px',
        padding: '1rem 1.1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: colour,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.95rem',
          flexShrink: 0,
        }}>
          {approvals.delegate_level}
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
            Approval hierarchy
          </div>
          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1rem' }}>
            Delegate level {approvals.delegate_level}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {approvals.base_tier}
          </div>
        </div>
      </div>

      {approvals.pathway_note && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          color: '#92400E',
          marginBottom: '1rem',
        }}>
          <strong>Note:</strong> {approvals.pathway_note}
        </div>
      )}

      {approvals.requires_justification && (
        <div style={{
          background: '#FFF7ED',
          border: '1px solid #FB923C',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          color: '#9A3412',
          marginBottom: '1rem',
        }}>
          <strong>Written justification required:</strong> this pathway requires documented justification before or at the time of approval.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {approvalSteps.map((step, index) => (
          <ApprovalCard
            key={step.id}
            step={step}
            index={index}
            isLast={index === approvalSteps.length - 1}
            finalColour={colour}
          />
        ))}
      </div>

      {showEApprovalsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.42)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          zIndex: 1000,
        }}>
          <div style={{
            width: 'min(100%, 560px)',
            background: 'var(--white)',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.22)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.15rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <div>
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: 'var(--teal-dark)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.18rem',
                }}>
                  Placeholder Integration
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)' }}>
                  Send to eApprovals
                </div>
              </div>
              <button
                onClick={() => setShowEApprovalsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: 0,
                  fontFamily: 'var(--font)',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.15rem' }}>
              <div style={{
                background: 'var(--off-white)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '1rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                marginBottom: '1rem',
              }}>
                System sends approval chain to eApprovals, it creates the chain and assignes the right delegates based on the appropriate delegations manual.
              </div>

              <div style={{
                background: `${colour}10`,
                border: `1px solid ${colour}33`,
                borderRadius: '12px',
                padding: '0.9rem 1rem',
              }}>
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.3rem',
                }}>
                  Returned eApprovals ID
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  letterSpacing: '0.04em',
                }}>
                  {eApprovalsId}
                </div>
              </div>
            </div>

            <div style={{
              padding: '0 1.15rem 1.15rem',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowEApprovalsModal(false)}
                style={{
                  background: 'var(--navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
