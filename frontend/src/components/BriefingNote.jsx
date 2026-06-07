import React, { useEffect, useMemo, useState } from 'react';
import { exportBriefingDocx, generateBriefingProse } from '../api';

const DEFAULT_SELECTED_SECTION_IDS = ['purpose', 'background', 'recommendation'];
const TEMPLATE_PREVIEW_SRC = '/api/briefing/template-preview';
const TEMPLATE_PREVIEW_CARDS = [
  {
    id: 'preview-cover',
    label: 'Template 1',
    accent: 'var(--navy)',
  },
  {
    id: 'preview-body',
    label: 'Template 2',
    accent: 'var(--teal)',
  },
  {
    id: 'preview-approval',
    label: 'Template 3',
    accent: '#D97706',
  },
];

export default function BriefingNote({ briefingStructure, profile, pathway, approvals }) {
  const [prose, setProse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATE_PREVIEW_CARDS[0].id);
  const [purposeText, setPurposeText] = useState('');
  const [backgroundText, setBackgroundText] = useState('');
  const [selectedSectionIds, setSelectedSectionIds] = useState(
    (briefingStructure.sections || [])
      .filter(section => DEFAULT_SELECTED_SECTION_IDS.includes(section.id))
      .map(section => section.id)
  );

  useEffect(() => {
    setSelectedSectionIds(
      (briefingStructure.sections || [])
        .filter(section => DEFAULT_SELECTED_SECTION_IDS.includes(section.id))
        .map(section => section.id)
    );
  }, [briefingStructure]);

  const selectedSections = useMemo(
    () => (briefingStructure.sections || []).filter(section => selectedSectionIds.includes(section.id)),
    [briefingStructure, selectedSectionIds]
  );
  const selectedBriefingStructure = useMemo(
    () => ({ ...briefingStructure, sections: selectedSections }),
    [briefingStructure, selectedSections]
  );
  const hasSelection = selectedSections.length > 0;

  const toggleSection = (sectionId) => {
    setSelectedSectionIds(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const downloadDocx = async (sections) => {
    if (!sections) return;
    setExporting(true);
    setError(null);
    try {
      const selectedSectionProse = Object.fromEntries(
        Object.entries(sections).filter(([sectionId]) => selectedSectionIds.includes(sectionId))
      );
      const { blob, filename } = await exportBriefingDocx(selectedBriefingStructure, profile, pathway, approvals, selectedSectionProse);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (e) {
      setError(e.message || 'Could not export the populated briefing note template.');
    } finally {
      setExporting(false);
    }
  };

  const generate = async () => {
    if (!hasSelection) return;
    setLoading(true);
    setError(null);
    try {
      const userContext = { purpose: purposeText.trim(), background: backgroundText.trim() };
      const result = await generateBriefingProse(selectedBriefingStructure, profile, pathway, userContext);
      setProse(result.sections);
      await downloadDocx(result.sections);
    } catch (e) {
      setError(e.message || 'Could not generate the populated briefing note.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!prose) return;
    const text = selectedSections
      .map(s => `${s.heading.toUpperCase()}\n\n${prose[s.id] || ''}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {!prose && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            A briefing note structure has been generated from this determination.
            Generate the draft and the app will populate the DCS template for review and completion.
          </p>

          <div style={{
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
              Select sections to generate
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {briefingStructure.sections.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  style={{
                  fontSize: '0.78rem',
                  background: selectedSectionIds.includes(s.id) ? 'var(--navy)' : 'var(--white)',
                  border: selectedSectionIds.includes(s.id) ? '1px solid var(--navy)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '3px 10px',
                  color: selectedSectionIds.includes(s.id) ? 'var(--white)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontWeight: selectedSectionIds.includes(s.id) ? 700 : 500,
                }}
                >
                  {s.heading}
                </button>
              ))}
            </div>
            {!hasSelection && (
              <div style={{ marginTop: '0.625rem', fontSize: '0.78rem', color: 'var(--danger)' }}>
                Select at least one section to generate the briefing note.
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Provide context (optional)
            </div>
            {[
              { label: 'Purpose', value: purposeText, setter: setPurposeText, placeholder: 'What is this procurement for? What outcome are you seeking?' },
              { label: 'Background', value: backgroundText, setter: setBackgroundText, placeholder: 'Any relevant history, constraints, or context the AI should know about.' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{label}</div>
                <textarea
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontSize: '0.84rem',
                    fontFamily: 'var(--font)',
                    color: 'var(--text-primary)',
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    lineHeight: 1.6,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'stretch',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}>
            {TEMPLATE_PREVIEW_CARDS.map(card => (
              <div
                key={card.id}
                style={{
                  flex: '1 1 360px',
                  minWidth: 320,
                  maxWidth: 'calc(33.333% - 0.67rem)',
                  background: selectedTemplateId === card.id ? 'linear-gradient(180deg, rgba(15,23,42,0.03) 0%, #F8FAFC 100%)' : 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                  border: selectedTemplateId === card.id ? `2px solid ${card.accent}` : '1px solid rgba(148,163,184,0.24)',
                  borderRadius: '14px',
                  boxShadow: selectedTemplateId === card.id ? '0 18px 36px rgba(15,23,42,0.16)' : '0 14px 30px rgba(15,23,42,0.10)',
                  padding: '0.65rem',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onClick={() => setSelectedTemplateId(card.id)}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: card.accent,
                }} />
                <div style={{
                  fontSize: '0.56rem',
                  fontWeight: 800,
                  color: selectedTemplateId === card.id ? card.accent : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: '0.2rem',
                  marginBottom: '0.45rem',
                }}>
                  {card.label}
                </div>

                <div style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '10px',
                  border: selectedTemplateId === card.id ? `1px solid ${card.accent}55` : '1px solid rgba(148,163,184,0.18)',
                  background: '#F8FAFC',
                }}>
                  <img
                    src={TEMPLATE_PREVIEW_SRC}
                    alt={`Briefing note ${card.label}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      background: 'white',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: '0.4rem',
                    bottom: '0.4rem',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    color: selectedTemplateId === card.id ? card.accent : 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.92)',
                    border: selectedTemplateId === card.id ? `1px solid ${card.accent}44` : '1px solid rgba(148,163,184,0.22)',
                    borderRadius: '999px',
                    padding: '2px 7px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {selectedTemplateId === card.id ? 'Selected' : 'Select'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading || !hasSelection}
            style={{
              background: loading || !hasSelection ? 'var(--border)' : 'var(--navy)',
              color: loading || !hasSelection ? 'var(--text-muted)' : 'var(--white)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: loading ? 'wait' : (!hasSelection ? 'not-allowed' : 'pointer'),
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>*</span>
                Drafting briefing note...
              </>
            ) : (
              'Generate populated briefing note'
            )}
          </button>

          {error && (
            <div style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {prose && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI-drafted and mapped into the DCS template
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => downloadDocx(prose)}
                disabled={exporting}
                style={{
                  background: exporting ? 'var(--border)' : 'var(--navy)',
                  color: exporting ? 'var(--text-muted)' : 'var(--white)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.375rem 0.875rem',
                  fontSize: '0.78rem',
                  cursor: exporting ? 'wait' : 'pointer',
                }}
              >
                {exporting ? 'Preparing .docx...' : (downloaded ? 'Downloaded' : 'Download populated .docx')}
              </button>
              <button
                onClick={copyToClipboard}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.375rem 0.875rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
              <button
                onClick={generate}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.375rem 0.875rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Regenerate
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '0.75rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div style={{
            background: 'var(--off-white)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
              Included sections
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {briefingStructure.sections.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  style={{
                    fontSize: '0.78rem',
                    background: selectedSectionIds.includes(s.id) ? 'var(--navy)' : 'var(--white)',
                    border: selectedSectionIds.includes(s.id) ? '1px solid var(--navy)' : '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    color: selectedSectionIds.includes(s.id) ? 'var(--white)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    fontWeight: selectedSectionIds.includes(s.id) ? 700 : 500,
                  }}
                >
                  {s.heading}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {selectedSections.map((section, idx) => (
              <div key={section.id} style={{
                padding: '1.25rem 1.5rem',
                borderBottom: idx < selectedSections.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.5rem',
                }}>
                  {section.heading}
                </div>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.75,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {prose[section.id] || '[Section not generated]'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
