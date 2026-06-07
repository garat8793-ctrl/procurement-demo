import React, { useEffect, useState } from 'react';
import { CitationsContext } from './CitationsContext';
import QuestionCard from './components/QuestionCard';
import ProfilePanel from './components/ProfilePanel';
import AnswerLog from './components/AnswerLog';
import ResultsPage from './components/ResultsPage';
import ArtifactIngester from './components/ArtifactIngester';
import AgencySelector from './components/AgencySelector';
import RulesExplorer from './components/RulesExplorer';
import ConversationalIntake from './components/ConversationalIntake';
import StrategyPanel from './components/StrategyPanel';
import MarketMap from './components/MarketMap';
import RFxWorkspace from './components/RFxWorkspace';
import EvaluationWorkspace from './components/EvaluationWorkspace';
import AwardRecommendation from './components/AwardRecommendation';
import ProcurementDetailsForm from './components/ProcurementDetailsForm';
import AssessmentsLibrary from './components/AssessmentsLibrary';
import { fetchQuestions, evaluateProfile, evaluateDirect, generateStrategy, selectStrategy, assessMarket, saveProcurementDetails, fetchProcurementArtifacts, fetchDecisionRecord } from './api';

const APP_MODES = { ASSESSMENT: 'assessment', SOURCING: 'sourcing', ASSESSMENTS: 'assessments', INGEST: 'ingest', RULES: 'rules' };

const STEPS = {
  LOADING: 'loading',
  AGENCY_SELECTION: 'agency_selection',
  INTAKE: 'intake',
  QUESTIONNAIRE: 'questionnaire',
  EVALUATING: 'evaluating',
  RESULTS: 'results',
  DETAILS: 'details',
  ERROR: 'error',
};

function buildLiveProfile(answers, questions) {
  const optionMap = {};
  for (const q of questions) {
    for (const opt of q.options) {
      optionMap[opt.id] = opt;
    }
  }
  const profile = { overlays: [] };
  for (const answer of answers) {
    for (const optId of answer.option_ids) {
      const opt = optionMap[optId];
      if (!opt) continue;
      const tags = opt.tags || {};
      for (const [key, val] of Object.entries(tags)) {
        if (key === 'overlays') {
          if (val !== 'none' && !profile.overlays.includes(val)) {
            profile.overlays.push(val);
          }
        } else {
          profile[key] = val;
        }
      }
    }
  }
  return profile;
}

const NAV_TABS = [
  { id: APP_MODES.ASSESSMENT, label: 'Assessment', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )},
  { id: APP_MODES.SOURCING, label: 'Sourcing Workspace', requiresResult: true, icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 12L5 7l3 3 2-4 2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )},
  { id: APP_MODES.ASSESSMENTS, label: 'Saved Assessments', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10.5" cy="10" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M9.75 10l.5.5.75-.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id: APP_MODES.INGEST, label: 'Policy Ingestion', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v7M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id: APP_MODES.RULES, label: 'Rules Explorer', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )},
];

const SOURCING_TABS = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'market', label: 'Market Intelligence' },
  { id: 'documents', label: 'Documents' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'award', label: 'Award' },
];

const LIFECYCLE_STAGES = [
  'intake', 'profile_built', 'details_collected', 'pathway_set',
  'strategy_agreed', 'docs_drafted', 'approvals_pending', 'market_active',
  'responses_received', 'evaluation_complete', 'award_recommended',
];

const STAGE_SHORT = [
  'Intake', 'Profile\nbuilt', 'Details\ncollected', 'Pathway\nset',
  'Strategy\nagreed', 'Docs\ndrafted', 'Approvals', 'To\nmarket',
  'Responses\nin', 'Evaluated', 'Award',
];

const WORKFLOW_PHASES = [
  { label: 'Planning',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', count: 4 },
  { label: 'Sourcing',  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', count: 4 },
  { label: 'Selection', color: '#059669', bg: '#f0fdf4', border: '#a7f3d0', count: 3 },
];

function phaseOf(i) {
  return i < 4 ? WORKFLOW_PHASES[0] : i < 8 ? WORKFLOW_PHASES[1] : WORKFLOW_PHASES[2];
}

function LifecycleNav({ currentStage }) {
  const currentIdx = LIFECYCLE_STAGES.indexOf(currentStage);
  const NODE = 30; // node diameter px

  return (
    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1.125rem 1.5rem 1.25rem', marginBottom: '1.5rem' }}>

      {/* Phase header brackets */}
      <div style={{ display: 'flex', marginBottom: '0.875rem', minWidth: 580 }}>
        {WORKFLOW_PHASES.map((ph, pi) => (
          <div key={pi} style={{ flex: ph.count, display: 'flex', justifyContent: 'center', padding: '3px 6px', marginRight: pi < WORKFLOW_PHASES.length - 1 ? 2 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ flex: 1, height: 1, background: ph.color, opacity: 0.35, minWidth: 12 }} />
              <span style={{ fontSize: '0.59rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ph.color, background: ph.bg, border: `1px solid ${ph.border}`, padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                {ph.label}
              </span>
              <div style={{ flex: 1, height: 1, background: ph.color, opacity: 0.35, minWidth: 12 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Workflow nodes + connectors */}
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 580 }}>
        {LIFECYCLE_STAGES.map((stage, i) => {
          const done  = i < currentIdx;
          const active = i === currentIdx;
          const ph = phaseOf(i);
          const isLast = i === LIFECYCLE_STAGES.length - 1;
          const connDone = i + 1 <= currentIdx;

          return (
            <React.Fragment key={stage}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 54 }}>
                <div style={{
                  width: NODE, height: NODE, borderRadius: '50%', flexShrink: 0,
                  background: done ? ph.color : active ? '#002664' : 'white',
                  border: `2px solid ${done ? ph.color : active ? '#002664' : '#d1d5db'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active ? `0 0 0 5px ${ph.color}22` : done ? `0 1px 4px ${ph.color}44` : 'none',
                  transition: 'all 0.2s',
                }}>
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, color: active ? 'white' : '#9ca3af', lineHeight: 1 }}>{i + 1}</span>
                  )}
                </div>
                <span style={{
                  fontSize: '0.59rem',
                  fontWeight: active ? 700 : done ? 500 : 400,
                  color: active ? '#002664' : done ? ph.color : '#b0b7c3',
                  textAlign: 'center', lineHeight: 1.25, whiteSpace: 'pre-line',
                }}>
                  {STAGE_SHORT[i]}
                </span>
              </div>

              {/* Connector arrow */}
              {!isLast && (
                <div style={{ flex: 1, paddingTop: NODE / 2 - 1, minWidth: 6, position: 'relative' }}>
                  <div style={{ height: 2, width: '100%', background: connDone ? phaseOf(i).color : '#e5e7eb', borderRadius: 1 }}>
                    {/* Arrowhead */}
                    <div style={{
                      position: 'absolute', right: -1, top: -3,
                      width: 0, height: 0,
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent',
                      borderLeft: `5px solid ${connDone ? phaseOf(i).color : '#e5e7eb'}`,
                    }} />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [appMode, setAppMode] = useState(APP_MODES.ASSESSMENT);
  const [step, setStep] = useState(STEPS.LOADING);
  const [showCitations, setShowCitations] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [liveProfile, setLiveProfile] = useState({});
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Sourcing workspace state
  const [sourcingTab, setSourcingTab] = useState('strategy');
  const [strategy, setStrategy] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState(null);
  const [marketAssessment, setMarketAssessment] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(null);
  const [sourcingEvaluations, setSourcingEvaluations] = useState([]);
  const [lifecycleStage, setLifecycleStage] = useState('pathway_set');
  const [procurementDetails, setProcurementDetails] = useState(null);
  const [savedDrafts, setSavedDrafts] = useState({});
  const [artifactsLoaded, setArtifactsLoaded] = useState(null); // tracks which procurementId was last loaded

  const procurementId = result?.decision_id || null;

  const handleGenerateStrategy = async () => {
    if (!procurementId) return;
    setStrategyLoading(true);
    setStrategyError(null);
    try {
      const res = await generateStrategy({
        procurement_id: procurementId,
        profile: result.profile || liveProfile,
        pathway: result.pathway,
        market_assessment: marketAssessment,
        details: procurementDetails,
      });
      setStrategy(res);
    } catch (e) {
      setStrategyError(e.message || 'Strategy generation failed');
    } finally {
      setStrategyLoading(false);
    }
  };

  const handleStrategySelect = async (selectedOption) => {
    if (!strategy) return;
    await selectStrategy(strategy.strategy_id, selectedOption);
    setStrategy(prev => ({ ...prev, human_selected_option: selectedOption }));
    setLifecycleStage('strategy_agreed');
  };

  const handleAssessMarket = async () => {
    if (!procurementId) return;
    setMarketLoading(true);
    setMarketError(null);
    try {
      const res = await assessMarket({
        procurement_id: procurementId,
        profile: result.profile || liveProfile,
        agency_context: selectedAgency,
        details: procurementDetails,
      });
      setMarketAssessment(res);
    } catch (e) {
      setMarketError(e.message || 'Market assessment failed');
    } finally {
      setMarketLoading(false);
    }
  };

  const handleDetailsComplete = async (details) => {
    if (procurementId) {
      try {
        await saveProcurementDetails(procurementId, details);
      } catch (e) {
        console.warn('Details save failed:', e.message);
      }
    }
    setProcurementDetails(details);
    setLifecycleStage('details_collected');
    setAppMode(APP_MODES.SOURCING);
  };

  const handleDraftGenerated = (type, data) => {
    setSavedDrafts(prev => ({ ...prev, [type]: data }));
  };

  const handleDetailsSkip = () => {
    setProcurementDetails(null);
    setLifecycleStage('pathway_set');
    setAppMode(APP_MODES.SOURCING);
  };

  const handleLoadAssessment = async (decisionId) => {
    // 1. Load all artifacts for this assessment in one call
    const artifacts = await fetchProcurementArtifacts(decisionId);

    // 2. Restore full evaluation result — persisted since last session, or re-evaluate as fallback
    let evaluationResult = artifacts.evaluation_result;
    if (!evaluationResult) {
      const decisionRecord = await fetchDecisionRecord(decisionId);
      evaluationResult = await evaluateDirect(decisionRecord.profile);
    }

    // 3. Hydrate all state
    setResult(evaluationResult);
    setLiveProfile(evaluationResult.profile || {});

    if (artifacts.strategy)           setStrategy(artifacts.strategy);
    else                              setStrategy(null);

    if (artifacts.market_assessment)  setMarketAssessment(artifacts.market_assessment);
    else                              setMarketAssessment(null);

    if (artifacts.procurement_details) setProcurementDetails(artifacts.procurement_details);
    else                               setProcurementDetails(null);

    const drafts = {};
    if (artifacts.rfx_draft)        drafts.rfx_draft        = artifacts.rfx_draft;
    if (artifacts.eval_plan)        drafts.eval_plan         = artifacts.eval_plan;
    if (artifacts.approval_summary) drafts.approval_summary = artifacts.approval_summary;
    setSavedDrafts(drafts);

    // Mark artifacts as loaded so the hydration useEffect won't re-fetch
    setArtifactsLoaded(decisionId);

    // 4. Infer lifecycle stage from what exists
    if (artifacts.strategy?.human_selected_option) setLifecycleStage('strategy_agreed');
    else if (artifacts.strategy)                    setLifecycleStage('strategy_agreed');
    else if (artifacts.procurement_details)         setLifecycleStage('details_collected');
    else                                            setLifecycleStage('pathway_set');

    // 5. Navigate to Results so the user can review before entering Sourcing
    setStep(STEPS.RESULTS);
    setAppMode(APP_MODES.ASSESSMENT);
  };

  useEffect(() => {
    fetchQuestions()
      .then(qs => {
        setQuestions(qs);
        setStep(STEPS.AGENCY_SELECTION);
      })
      .catch(() => {
        setError('Could not connect to the backend. Make sure the server is running on port 8000.');
        setStep(STEPS.ERROR);
      });
  }, []);

  const handleAgencySelect = (agency) => {
    setSelectedAgency({
      agency_id: agency.agency_id,
      agency_name: agency.name,
      cluster: agency.cluster,
      agency_type: agency.type,
    });
    setStep(STEPS.INTAKE);
  };

  const handleAgencySkip = () => {
    setSelectedAgency(null);
    setStep(STEPS.INTAKE);
  };

  const handleIntakeResult = (profile) => {
    setStep(STEPS.EVALUATING);
    evaluateDirect(profile, selectedAgency)
      .then(res => {
        setResult(res);
        setLiveProfile(profile);
        setStep(STEPS.RESULTS);
      })
      .catch(err => {
        setError('Evaluation failed: ' + err.message);
        setStep(STEPS.ERROR);
      });
  };

  const handleAnswer = (questionId, optionIds) => {
    const newAnswers = [...answers, { question_id: questionId, option_ids: optionIds }];
    setAnswers(newAnswers);
    setLiveProfile(buildLiveProfile(newAnswers, questions));

    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep(STEPS.EVALUATING);
      evaluateProfile(newAnswers, selectedAgency)
        .then(res => {
          setResult(res);
          setStep(STEPS.RESULTS);
        })
        .catch(err => {
          setError('Evaluation failed: ' + err.message);
          setStep(STEPS.ERROR);
        });
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      const prevAnswers = answers.slice(0, currentQ - 1);
      setAnswers(prevAnswers);
      setLiveProfile(buildLiveProfile(prevAnswers, questions));
      setCurrentQ(currentQ - 1);
    }
  };

  const handleRestart = () => {
    setAnswers([]);
    setLiveProfile({});
    setCurrentQ(0);
    setResult(null);
    setSelectedAgency(null);
    setStep(STEPS.AGENCY_SELECTION);
  };

  const showResults = appMode === APP_MODES.ASSESSMENT && step === STEPS.RESULTS;
  const showAgencySelection = appMode === APP_MODES.ASSESSMENT && step === STEPS.AGENCY_SELECTION;

  useEffect(() => {
    if (window.NSW) window.NSW.initSite();
  }, [appMode]);

  // Hydrate sourcing state from persisted artifacts whenever we have a procurementId
  // and haven't loaded for it yet (avoids re-fetching on every tab switch).
  useEffect(() => {
    if (!procurementId || artifactsLoaded === procurementId) return;
    fetchProcurementArtifacts(procurementId)
      .then(artifacts => {
        setArtifactsLoaded(procurementId);
        if (artifacts.strategy) {
          setStrategy(artifacts.strategy);
          if (artifacts.strategy.human_selected_option) {
            setLifecycleStage('strategy_agreed');
          }
        }
        if (artifacts.market_assessment) {
          setMarketAssessment(artifacts.market_assessment);
        }
        if (artifacts.procurement_details && !procurementDetails) {
          setProcurementDetails(artifacts.procurement_details);
        }
        // Collect draft artifacts for RFxWorkspace
        const drafts = {};
        if (artifacts.rfx_draft)       drafts.rfx_draft       = artifacts.rfx_draft;
        if (artifacts.eval_plan)       drafts.eval_plan        = artifacts.eval_plan;
        if (artifacts.approval_summary) drafts.approval_summary = artifacts.approval_summary;
        setSavedDrafts(drafts);
      })
      .catch(() => {
        // No artifacts yet — that's fine, silently ignore 404
        setArtifactsLoaded(procurementId);
      });
  }, [procurementId, artifactsLoaded]);

  return (
    <CitationsContext.Provider value={showCitations}>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--off-white)' }}>

      {/* ── DDS Masthead (mandatory) ── */}
      <div className="nsw-masthead">
        <div className="nsw-container">
          <span>A NSW Government website</span>
        </div>
      </div>

      {/* ── DDS Header (mandatory) — white background per DDS standard ── */}
      <header className="nsw-header" role="banner">
        <div className="nsw-header__inner nsw-container">
          <div className="nsw-header__logo">
            <a className="nsw-header__logo-link" href="/" onClick={e => e.preventDefault()} aria-label="NSW Government">
              {/* NSW Government waratah mark */}
              <svg width="72" height="96" viewBox="0 0 72 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
                {/* Waratah flower head — radial stamens */}
                {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map((deg, i) => (
                  <ellipse key={i} cx="36" cy="36" rx="3.2" ry="16"
                    fill="#d7153a"
                    transform={`rotate(${deg} 36 36) translate(0 -14)`}
                    opacity={i % 2 === 0 ? 1 : 0.82}
                  />
                ))}
                {/* Inner ring */}
                {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
                  <ellipse key={i} cx="36" cy="36" rx="2" ry="8"
                    fill="#b5002b"
                    transform={`rotate(${deg} 36 36) translate(0 -6)`}
                  />
                ))}
                {/* Centre dome */}
                <circle cx="36" cy="36" r="9" fill="#b5002b"/>
                <circle cx="36" cy="36" r="6" fill="#d7153a"/>
                {/* NSW text */}
                <text x="36" y="72" textAnchor="middle" fontFamily="'Public Sans',sans-serif" fontWeight="800" fontSize="17" fill="#002664" letterSpacing="-0.5">NSW</text>
                <text x="36" y="85" textAnchor="middle" fontFamily="'Public Sans',sans-serif" fontWeight="400" fontSize="7.5" fill="#002664" letterSpacing="1.8">GOVERNMENT</text>
              </svg>
            </a>
          </div>
          <div className="nsw-header__name">
            <span className="nsw-header__site-name">Procurement Decision System</span>
          </div>
        </div>
      </header>

      {/* ── App nav + controls (dark secondary bar) ── */}
      <div style={{ background: 'var(--navy-dark)', borderBottom: '2px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div className="nsw-container" style={{ display: 'flex', alignItems: 'stretch' }}>
          {NAV_TABS.map(tab => {
            const active = appMode === tab.id;
            const disabled = tab.requiresResult && !result;
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setAppMode(tab.id)}
                title={disabled ? 'Complete an assessment first' : undefined}
                style={{
                  background: active ? 'rgba(255,255,255,0.08)' : 'none',
                  border: 'none',
                  borderBottom: active ? '3px solid var(--teal)' : '3px solid transparent',
                  color: active ? 'white' : disabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.82rem',
                  padding: '0.75rem 1.1rem 0.625rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--nsw-font-family, var(--font))',
                }}
                onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
              >
                <span style={{ opacity: active ? 1 : 0.7 }}>{tab.icon}</span>
                {tab.label}
                {tab.id === APP_MODES.SOURCING && result && (
                  <span style={{ fontSize: '0.6rem', background: 'rgba(0,178,169,0.3)', color: '#00d4cc', padding: '1px 5px', borderRadius: '99px', marginLeft: '2px' }}>Ready</span>
                )}
              </button>
            );
          })}

          {/* Right: controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0 0.25rem' }}>
            <button
              onClick={() => setShowCitations(v => !v)}
              title={showCitations ? 'Hide policy citations' : 'Show policy citations'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: showCitations ? 'rgba(0,178,169,0.18)' : 'rgba(255,255,255,0.07)',
                border: showCitations ? '1px solid rgba(0,178,169,0.4)' : '1px solid rgba(255,255,255,0.14)',
                borderRadius: '99px', padding: '4px 10px 4px 8px', cursor: 'pointer', color: 'white',
              }}
            >
              <span style={{ display: 'inline-flex', width: 28, height: 16, borderRadius: 99, background: showCitations ? 'var(--teal)' : 'rgba(255,255,255,0.2)', position: 'relative', flexShrink: 0, transition: 'background 0.18s' }}>
                <span style={{ position: 'absolute', top: 2, left: showCitations ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: showCitations ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)' }}>Citations</span>
            </button>
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(0,178,169,0.22)', border: '1px solid rgba(0,178,169,0.35)', borderRadius: '99px', padding: '3px 10px', whiteSpace: 'nowrap' }}>
              Strawman PoC
            </span>
          </div>
        </div>
      </div>

      {/* ── Saved Assessments ── */}
      {appMode === APP_MODES.ASSESSMENTS && (
        <main style={{ flex: 1, background: 'var(--off-white)' }}>
          <AssessmentsLibrary onLoad={handleLoadAssessment} />
        </main>
      )}

      {/* ── Policy Ingestion ── */}
      {appMode === APP_MODES.INGEST && (
        <main style={{ flex: 1 }}>
          <ArtifactIngester />
        </main>
      )}

      {/* ── Rules Explorer ── */}
      {appMode === APP_MODES.RULES && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RulesExplorer />
        </main>
      )}

      {/* ── Results ── */}
      {appMode === APP_MODES.ASSESSMENT && showResults && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ResultsPage
            result={result}
            answers={answers}
            questions={questions}
            onRestart={handleRestart}
            onSwitchToIngest={() => setAppMode(APP_MODES.INGEST)}
          />
          <div style={{ padding: '0 clamp(1rem, 2.5vw, 2rem) 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep(STEPS.DETAILS)}
              style={{ padding: '0.625rem 1.5rem', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Complete procurement details →
            </button>
          </div>
        </main>
      )}

      {/* ── Sourcing Workspace ── */}
      {appMode === APP_MODES.SOURCING && result && (
        <main style={{ flex: 1, padding: '1.5rem clamp(1rem, 2.5vw, 2rem)' }}>
          <LifecycleNav currentStage={lifecycleStage} />

          {/* Sourcing tabs */}
          <div style={{ display: 'flex', gap: '0.375rem', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem', paddingBottom: '0.75rem' }}>
            {SOURCING_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setSourcingTab(t.id)}
                style={{
                  padding: '0.375rem 0.875rem',
                  borderRadius: '5px',
                  border: 'none',
                  background: sourcingTab === t.id ? 'var(--navy)' : '#f3f4f6',
                  color: sourcingTab === t.id ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Strategy tab */}
          {sourcingTab === 'strategy' && (
            <div>
              {!strategy && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleGenerateStrategy}
                    disabled={strategyLoading}
                    style={{ padding: '0.5rem 1.25rem', background: strategyLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.875rem', fontWeight: 600, cursor: strategyLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {strategyLoading ? 'Generating strategy options…' : 'Generate sourcing strategy options'}
                  </button>
                  {strategyError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem' }}>{strategyError}</div>}
                </div>
              )}
              <StrategyPanel strategy={strategy} onSelect={handleStrategySelect} />
            </div>
          )}

          {/* Market tab */}
          {sourcingTab === 'market' && (
            <div>
              {!marketAssessment && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleAssessMarket}
                    disabled={marketLoading}
                    style={{ padding: '0.5rem 1.25rem', background: marketLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.875rem', fontWeight: 600, cursor: marketLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {marketLoading ? 'Running market intelligence…' : 'Run market intelligence'}
                  </button>
                  {marketError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem' }}>{marketError}</div>}
                </div>
              )}
              <MarketMap assessment={marketAssessment} />
            </div>
          )}

          {/* Documents tab */}
          {sourcingTab === 'documents' && (
            <RFxWorkspace
              procurementId={procurementId}
              profile={result.profile || liveProfile}
              strategy={strategy}
              obligations={result.obligations}
              pathway={result.pathway}
              approvals={result.approvals}
              result={result}
              details={procurementDetails}
              savedDrafts={savedDrafts}
              onDraftGenerated={handleDraftGenerated}
            />
          )}

          {/* Evaluation tab */}
          {sourcingTab === 'evaluation' && (
            <EvaluationWorkspace
              procurementId={procurementId}
              criteria={[]}
              profile={result.profile || liveProfile}
              evaluations={sourcingEvaluations}
              onEvaluationsChange={setSourcingEvaluations}
            />
          )}

          {/* Award tab */}
          {sourcingTab === 'award' && (
            <AwardRecommendation
              procurementId={procurementId}
              evaluations={sourcingEvaluations}
              profile={result.profile || liveProfile}
            />
          )}
        </main>
      )}

      {/* ── Agency selection ── */}
      {showAgencySelection && (
        <main style={{
          flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '3rem clamp(1rem, 2.5vw, 2rem)',
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            padding: '2.25rem 2.5rem',
            boxShadow: 'var(--shadow-lg)',
            width: 'min(100%, 900px)',
            border: '1px solid var(--border-light)',
          }} className="agency-selection-card">
            <AgencySelector onSelect={handleAgencySelect} onSkip={handleAgencySkip} />
          </div>
        </main>
      )}

      {/* ── Intake / Questionnaire ── */}
      {appMode === APP_MODES.ASSESSMENT && !showResults && !showAgencySelection && (
        <main style={{
          flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '2rem clamp(1rem, 2.5vw, 2rem)',
        }}>
          <div style={{ width: '100%', display: 'flex', gap: '2rem', alignItems: 'flex-start' }} className="assessment-layout">

            {/* Left: intake / question card */}
            <div style={{ flex: 1 }}>
              {step === STEPS.LOADING && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>Loading…</p>
                </div>
              )}

              {step === STEPS.EVALUATING && (
                <div style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-light)',
                }} className="slide-up">
                  <div className="spinner" style={{ margin: '0 auto 1.5rem' }} />
                  <h2 style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: '0.625rem', fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
                    Issuing procurement determination…
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Applying procurement rules to your profile
                  </p>
                  <div style={{ display: 'inline-flex', gap: '4px', marginTop: '1.5rem', alignItems: 'center' }}>
                    {[0, 160, 320].map(delay => (
                      <div key={delay} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--teal)',
                        animation: `progressPulse 1.2s ease ${delay}ms infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {step === STEPS.INTAKE && (
                <div style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-light)',
                }} className="assessment-main-card">
                  <ConversationalIntake
                    selectedAgency={selectedAgency}
                    onResult={handleIntakeResult}
                    onSwitchToClassic={() => setStep(STEPS.QUESTIONNAIRE)}
                  />
                </div>
              )}

              {step === STEPS.QUESTIONNAIRE && questions.length > 0 && (
                <div style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-light)',
                }} className="assessment-main-card">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                    <button
                      onClick={() => { setAnswers([]); setCurrentQ(0); setStep(STEPS.INTAKE); }}
                      style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--teal)', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}
                    >
                      ← Use conversational intake
                    </button>
                  </div>
                  <QuestionCard
                    question={questions[currentQ]}
                    onAnswer={handleAnswer}
                    currentStep={currentQ + 1}
                    totalSteps={questions.length}
                    onBack={handleBack}
                    canGoBack={currentQ > 0}
                  />
                </div>
              )}

              {step === STEPS.ERROR && (
                <div style={{
                  background: 'var(--danger-light)',
                  border: '1px solid #FECACA',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  color: '#991B1B',
                }}>
                  <strong>Connection error</strong>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{error}</p>
                </div>
              )}

              {step === STEPS.DETAILS && result && (
                <div className="details-form-card" style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-light)',
                }}>
                  <ProcurementDetailsForm
                    profile={result.profile || liveProfile}
                    pathway={result.pathway}
                    procurementId={procurementId}
                    onComplete={handleDetailsComplete}
                    onSkip={handleDetailsSkip}
                  />
                </div>
              )}
            </div>

            {/* Right: sidebar */}
            <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="assessment-sidebar">

              {selectedAgency && (
                <div style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius)',
                  padding: '0.875rem 1rem',
                  boxShadow: 'var(--shadow-xs)',
                }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                    Agency context
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.3 }}>
                    {selectedAgency.agency_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {selectedAgency.cluster}
                  </div>
                  <button
                    onClick={() => setStep(STEPS.AGENCY_SELECTION)}
                    style={{
                      marginTop: '0.5rem', background: 'none', border: 'none',
                      fontSize: '0.7rem', color: 'var(--teal)', cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Change agency →
                  </button>
                </div>
              )}

              <AnswerLog answers={answers} questions={questions} />
              <ProfilePanel profile={liveProfile} currentStep={currentQ + 1} />

              {currentQ === 0 && step === STEPS.QUESTIONNAIRE && (
                <div style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem 1.25rem',
                  boxShadow: 'var(--shadow-xs)',
                }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    How this works
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Answer {questions.length} plain-language questions. The system builds your procurement profile and determines the right pathway, process, and approvals — automatically.
                  </p>
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-dark) 100%)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}>
                    The system decides. AI explains.
                  </div>
                  <button
                    onClick={() => setAppMode(APP_MODES.INGEST)}
                    className="btn-ghost"
                    style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}
                  >
                    Add a policy artifact →
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── DDS Footer (mandatory) ── */}
      <footer className="nsw-footer">
        <div className="nsw-footer__lower">
          <div className="nsw-container">
            <div className="nsw-footer__lower-inner">
              <p className="nsw-footer__copyright">© 2025 NSW Government — Internal prototype. Not for public use.</p>
              <ul className="nsw-footer__links">
                <li><a href="#">Accessibility</a></li>
                <li><a href="#">Privacy</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </CitationsContext.Provider>
  );
}
