import { useState, useMemo } from 'react';

const PRICING_MODELS = [
  { value: '', label: 'Select pricing model' },
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'time_and_materials', label: 'Time & materials' },
  { value: 'outcome_based', label: 'Outcome-based' },
  { value: 'subscription', label: 'Subscription / SaaS' },
  { value: 'tbd', label: 'To be determined' },
];

const CONTRACT_DURATIONS = [
  { value: '', label: 'Select duration' },
  { value: '1_year', label: '1 year' },
  { value: '2_years', label: '2 years' },
  { value: '3_years', label: '3 years' },
  { value: '4_years', label: '4 years' },
  { value: '5_years_plus', label: '5 years or more' },
  { value: 'tbd', label: 'To be determined' },
];

const HOSTING_OPTIONS = [
  { value: 'australian_cloud_only', label: 'Australian cloud only' },
  { value: 'on_premise', label: 'On-premise' },
  { value: 'hybrid', label: 'Hybrid (cloud + on-premise)' },
  { value: 'no_restriction', label: 'No restriction' },
];

const OVERSIGHT_OPTIONS = [
  { value: 'full_review', label: 'Full human review of all AI outputs before use' },
  { value: 'human_in_loop', label: 'Human review for high-risk or edge-case outputs' },
  { value: 'automated_with_audit', label: 'Automated with audit trail and periodic review' },
];

const DATA_TYPE_OPTIONS = [
  { value: 'personal_information', label: 'Personal information (names, addresses, contact details)' },
  { value: 'health_records', label: 'Health records or medical data' },
  { value: 'financial_data', label: 'Financial data (banking, tax, payment records)' },
  { value: 'government_classified', label: 'Government classified or protected information' },
  { value: 'children_data', label: 'Data relating to children or minors' },
];

const CATEGORY_LABELS = {
  ict_saas: 'ICT — SaaS',
  ict_hardware: 'ICT — Hardware & Infrastructure',
  ict_development: 'ICT — Development',
  professional_services: 'Professional Services',
  consulting: 'Consulting',
  goods: 'Goods',
  construction: 'Construction',
  labour_hire: 'Labour Hire',
  other: 'Other',
};

// Shared style objects — use CSS vars so they inherit the design system tokens
const s = {
  section: {
    marginBottom: '2rem',
    paddingBottom: '1.75rem',
    borderBottom: '1px solid var(--border-light)',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '0.4rem',
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '0.5625rem 0.75rem',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
    fontFamily: 'var(--font)',
  },
  select: {
    width: '100%',
    padding: '0.5625rem 2rem 0.5625rem 0.75rem',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    boxSizing: 'border-box',
    fontFamily: 'var(--font)',
    transition: 'border-color 0.15s',
  },
  textarea: {
    width: '100%',
    padding: '0.5625rem 0.75rem',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    outline: 'none',
    resize: 'vertical',
    minHeight: '90px',
    fontFamily: 'var(--font)',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  sectionHeading: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: 'var(--navy)',
    marginBottom: '1rem',
    marginTop: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
  },
  mb: (n) => ({ marginBottom: n }),
  mt: (n) => ({ marginTop: n }),
};

const Badge = ({ children, style }) => (
  <span style={{
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '0.1rem 0.45rem',
    borderRadius: '4px',
    textTransform: 'uppercase',
    ...style,
  }}>{children}</span>
);

export default function ProcurementDetailsForm({ profile, pathway, procurementId, onComplete, onSkip }) {
  const isICT = ['ict_saas', 'ict_hardware', 'ict_development'].includes(profile?.category) || profile?.technology_component;
  const hasAI = profile?.ai_component || (profile?.overlays || []).includes('ai');
  const showDataFields = !profile?.data_sensitivity || ['sensitive', 'protected'].includes(profile?.data_sensitivity);
  const showOutcomeFields = !profile?.outcome_type || profile?.outcome_type !== 'output';

  const [title, setTitle] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [requirements, setRequirements] = useState(['', '', '']);
  const [budget, setBudget] = useState('');
  const [pricingModel, setPricingModel] = useState('');
  const [contractDuration, setContractDuration] = useState('');
  const [targetRelease, setTargetRelease] = useState('');
  const [incumbent, setIncumbent] = useState('');
  const [hosting, setHosting] = useState('');
  const [integration, setIntegration] = useState('');
  const [aiUseCase, setAiUseCase] = useState('');
  const [humanOversight, setHumanOversight] = useState('');
  const [dataTypes, setDataTypes] = useState([]);
  const [successMetrics, setSuccessMetrics] = useState('');

  const canComplete = useMemo(() => {
    if (!title.trim() || !deliverables.trim()) return false;
    if (hasAI && !aiUseCase.trim()) return false;
    return true;
  }, [title, deliverables, hasAI, aiUseCase]);

  const handleAddRequirement = () => {
    if (requirements.length < 8) setRequirements([...requirements, '']);
  };

  const handleRequirementChange = (i, val) => {
    const next = [...requirements];
    next[i] = val;
    setRequirements(next);
  };

  const handleRemoveRequirement = (i) => {
    const next = requirements.filter((_, idx) => idx !== i);
    setRequirements(next.length > 0 ? next : ['']);
  };

  const handleDataTypeToggle = (val) => {
    setDataTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleComplete = () => {
    onComplete({
      procurement_id: procurementId,
      title: title.trim(),
      deliverables_description: deliverables.trim(),
      key_requirements: requirements.map(r => r.trim()).filter(Boolean),
      indicative_budget: budget.trim() || null,
      pricing_model: pricingModel || null,
      contract_duration: contractDuration || null,
      target_market_release: targetRelease.trim() || null,
      incumbent_supplier: incumbent.trim() || null,
      hosting_requirements: isICT ? (hosting || null) : null,
      integration_requirements: isICT ? (integration.trim() || null) : null,
      ai_use_case: hasAI ? (aiUseCase.trim() || null) : null,
      human_oversight_level: hasAI ? (humanOversight || null) : null,
      data_types: showDataFields ? dataTypes : [],
      success_metrics: showOutcomeFields ? (successMetrics.trim() || null) : null,
    });
  };

  const categoryLabel = CATEGORY_LABELS[profile?.category] || profile?.category || 'Unknown';
  const pathwayLabel = pathway?.label || pathway?.name || '';

  return (
    <div>
      {/* Context banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--nsw-brand-supplementary) 100%)',
        borderRadius: 'var(--radius)',
        padding: '1.125rem 1.375rem',
        marginBottom: '2rem',
        color: '#fff',
      }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: '0.35rem' }}>
          Procurement context
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{categoryLabel}</span>
          {pathwayLabel && (
            <>
              <span style={{ opacity: 0.45 }}>→</span>
              <span style={{
                background: 'rgba(255,255,255,0.13)',
                borderRadius: '5px',
                padding: '0.15rem 0.6rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.2)',
              }}>{pathwayLabel}</span>
            </>
          )}
        </div>
        <div style={{ fontSize: '0.8125rem', opacity: 0.78, marginTop: '0.5rem', lineHeight: 1.45 }}>
          Add the specifics of your procurement so the system can generate targeted documents and strategy options.
        </div>
      </div>

      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.5rem' }}>
        Procurement details
      </h2>

      {/* Section 1: Procurement identity */}
      <div style={s.section}>
        <h3 style={s.sectionHeading}>Procurement identity</h3>

        <div style={s.mb('1rem')}>
          <label style={s.label}>
            Procurement title <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            style={s.input}
            type="text"
            placeholder="e.g. AI-assisted triage platform for DCS contact centre"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div style={s.mb('1rem')}>
          <label style={s.label}>
            What will the successful supplier deliver? <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            style={{ ...s.textarea, minHeight: '90px' }}
            placeholder="Describe the deliverables, services, or outcomes the supplier will be contracted to provide. Be specific — this drives the scope of work section in the RFx document."
            value={deliverables}
            onChange={e => setDeliverables(e.target.value)}
          />
        </div>

        <div>
          <label style={s.label}>Key requirements</label>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            List specific technical, functional, or compliance requirements. Up to 8 items.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {requirements.map((req, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-placeholder)', minWidth: '1.2rem', flexShrink: 0 }}>{i + 1}.</span>
                <input
                  style={{ ...s.input, flex: 1 }}
                  type="text"
                  placeholder={`Requirement ${i + 1}`}
                  value={req}
                  onChange={e => handleRequirementChange(i, e.target.value)}
                />
                {requirements.length > 1 && (
                  <button
                    onClick={() => handleRemoveRequirement(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-placeholder)', fontSize: '1.1rem', padding: '0.2rem 0.35rem', lineHeight: 1, borderRadius: '4px', flexShrink: 0 }}
                    title="Remove"
                  >×</button>
                )}
              </div>
            ))}
          </div>
          {requirements.length < 8 && (
            <button
              onClick={handleAddRequirement}
              style={{ marginTop: '0.6rem', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font)' }}
            >
              + Add requirement
            </button>
          )}
        </div>
      </div>

      {/* Section 2: Commercial terms */}
      <div style={s.section}>
        <h3 style={s.sectionHeading}>Commercial terms</h3>

        {/* Responsive 2-col grid — collapses via CSS class at ≤720px */}
        <div className="details-form-grid">
          <div>
            <label style={s.label}>Indicative budget</label>
            <input
              style={s.input}
              type="text"
              placeholder="e.g. $1.2M over 3 years"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </div>
          <div>
            <label style={s.label}>Pricing model</label>
            <select style={s.select} value={pricingModel} onChange={e => setPricingModel(e.target.value)}>
              {PRICING_MODELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="details-form-grid" style={{ marginTop: '1rem' }}>
          <div>
            <label style={s.label}>Contract duration</label>
            <select style={s.select} value={contractDuration} onChange={e => setContractDuration(e.target.value)}>
              {CONTRACT_DURATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Target market release</label>
            <input
              style={s.input}
              type="text"
              placeholder="e.g. Q3 2025 / July 2025"
              value={targetRelease}
              onChange={e => setTargetRelease(e.target.value)}
            />
          </div>
        </div>

        <div style={s.mt('1rem')}>
          <label style={s.label}>Known incumbent supplier</label>
          <input
            style={s.input}
            type="text"
            placeholder="Supplier name, or leave blank if none"
            value={incumbent}
            onChange={e => setIncumbent(e.target.value)}
          />
        </div>
      </div>

      {/* Section 3: ICT & Technology (conditional) */}
      {isICT && (
        <div style={s.section}>
          <h3 style={s.sectionHeading}>
            ICT & technology
            <Badge style={{ background: 'var(--navy-light)', color: 'var(--navy)', border: '1px solid var(--border)' }}>ICT procurement</Badge>
          </h3>

          <div style={s.mb('1rem')}>
            <label style={s.label}>Hosting requirements</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {HOSTING_OPTIONS.map(o => (
                <label key={o.value} style={s.radioLabel}>
                  <input
                    type="radio"
                    name="hosting"
                    value={o.value}
                    checked={hosting === o.value}
                    onChange={() => setHosting(o.value)}
                    style={{ marginTop: '0.15rem', flexShrink: 0 }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={s.label}>Integration requirements</label>
            <textarea
              style={{ ...s.textarea, minHeight: '70px' }}
              placeholder="List any systems, APIs, or platforms the solution must integrate with. Leave blank if none."
              value={integration}
              onChange={e => setIntegration(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Section 4: AI & Automation (conditional) */}
      {hasAI && (
        <div style={s.section}>
          <h3 style={s.sectionHeading}>
            AI & automation
            <Badge style={{ background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid #fde68a' }}>AI component</Badge>
          </h3>

          <div style={s.mb('1rem')}>
            <label style={s.label}>
              AI use case <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              style={{ ...s.textarea, minHeight: '70px' }}
              placeholder="Describe how AI or machine learning will be used in this procurement. e.g. 'AI triage of inbound service requests to route to the correct team'"
              value={aiUseCase}
              onChange={e => setAiUseCase(e.target.value)}
            />
          </div>

          <div>
            <label style={s.label}>Human oversight level</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {OVERSIGHT_OPTIONS.map(o => (
                <label key={o.value} style={s.radioLabel}>
                  <input
                    type="radio"
                    name="oversight"
                    value={o.value}
                    checked={humanOversight === o.value}
                    onChange={() => setHumanOversight(o.value)}
                    style={{ marginTop: '0.15rem', flexShrink: 0 }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Data & Privacy (conditional) */}
      {showDataFields && (
        <div style={s.section}>
          <h3 style={s.sectionHeading}>
            Data & privacy
            <Badge style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid #a7f3d0' }}>data sensitivity</Badge>
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Select all types of data this system or service will handle.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {DATA_TYPE_OPTIONS.map(o => (
              <label key={o.value} style={s.radioLabel}>
                <input
                  type="checkbox"
                  checked={dataTypes.includes(o.value)}
                  onChange={() => handleDataTypeToggle(o.value)}
                  style={{ marginTop: '0.15rem', flexShrink: 0 }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Outcomes & Performance (conditional) */}
      {showOutcomeFields && (
        <div style={{ ...s.section, borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={s.sectionHeading}>
            Outcomes & performance
            <Badge style={{ background: '#faf5ff', color: 'var(--purple)', border: '1px solid #e9d5ff' }}>outcome-based</Badge>
          </h3>
          <div>
            <label style={s.label}>Success metrics / KPIs</label>
            <textarea
              style={{ ...s.textarea, minHeight: '70px' }}
              placeholder="Describe how success will be measured. e.g. '95% of inbound requests correctly classified within 2 seconds; customer satisfaction >4.2/5'"
              value={successMetrics}
              onChange={e => setSuccessMetrics(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Validation hint */}
      {!canComplete && (title || deliverables) && (
        <div style={{
          background: 'var(--warning-light)',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-sm)',
          padding: '0.6rem 0.875rem',
          fontSize: '0.8125rem',
          color: '#78350f',
          marginBottom: '1.25rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>
            {!title.trim() && 'Please enter a procurement title. '}
            {!deliverables.trim() && 'Please describe what the supplier will deliver. '}
            {hasAI && !aiUseCase.trim() && 'Please describe the AI use case for this procurement. '}
          </span>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          Skip for now
        </button>
        <button
          onClick={handleComplete}
          disabled={!canComplete}
          style={{
            background: canComplete ? 'var(--navy)' : 'var(--border)',
            color: canComplete ? '#fff' : 'var(--text-placeholder)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0.625rem 1.375rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: canComplete ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'var(--font)',
          }}
        >
          Complete & continue →
        </button>
      </div>
    </div>
  );
}
