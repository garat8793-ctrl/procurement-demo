import React from 'react';

export default function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'var(--navy)',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.72rem', fontWeight: 800,
            flexShrink: 0,
          }}>
            {current}
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            of {total} questions
          </span>
        </div>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700,
          color: 'var(--teal-dark)',
          background: 'var(--teal-light)',
          padding: '2px 10px',
          borderRadius: '99px',
        }}>
          {pct}%
        </span>
      </div>

      {/* Segmented pill track */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {Array.from({ length: total }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < current;
          const isCurrent = stepNum === current;
          return (
            <div
              key={i}
              style={{
                flex: isCurrent ? 3 : 1,
                height: isCurrent ? 8 : 6,
                borderRadius: 99,
                background: (isCompleted || isCurrent) ? 'var(--teal)' : 'var(--border)',
                opacity: isCompleted ? 0.55 : 1,
                transition: 'flex 0.4s cubic-bezier(0.4,0,0.2,1), height 0.3s ease, opacity 0.3s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
