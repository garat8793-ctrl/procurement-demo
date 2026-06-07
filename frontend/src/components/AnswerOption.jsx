import React from 'react';

export default function AnswerOption({ option, selected, onSelect, multi }) {
  return (
    <button
      onClick={() => onSelect(option.id)}
      className={`answer-option${selected ? ' is-selected' : ''}`}
    >
      {/* Indicator — radio circle or checkbox */}
      <div style={{
        width: 20,
        height: 20,
        borderRadius: multi ? '5px' : '50%',
        border: selected ? '2px solid var(--teal)' : '2px solid var(--border)',
        background: selected ? 'var(--teal)' : 'var(--white)',
        flexShrink: 0,
        marginTop: '1px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.18s ease',
        boxShadow: selected ? '0 0 0 3px rgba(0,178,169,0.18)' : 'none',
      }}>
        {selected && (
          <svg
            width="11" height="9" viewBox="0 0 11 9" fill="none"
            style={{ animation: 'checkIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <path
              d="M1 4.5L4 7.5L10 1"
              stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Label and description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.95rem',
          color: selected ? 'var(--teal-dark)' : 'var(--text-primary)',
          lineHeight: 1.35,
          marginBottom: option.description ? '0.25rem' : 0,
          transition: 'color 0.15s ease',
        }}>
          {option.label}
        </div>
        {option.description && (
          <div style={{
            fontSize: '0.82rem',
            color: selected ? 'var(--teal-dark)' : 'var(--text-muted)',
            lineHeight: 1.45,
            opacity: selected ? 0.8 : 1,
            transition: 'color 0.15s ease',
          }}>
            {option.description}
          </div>
        )}
      </div>

      {/* Right chevron hint for single-select */}
      {!multi && (
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{
            flexShrink: 0,
            opacity: selected ? 0.9 : 0.25,
            color: selected ? 'var(--teal)' : 'var(--text-muted)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            transform: selected ? 'translateX(2px)' : 'none',
          }}
        >
          <path
            d="M6 3l5 5-5 5"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
