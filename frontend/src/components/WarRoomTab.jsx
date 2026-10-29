/**
 * ROGVEDA — Lead Optimization War Room (Phase 1)
 *
 * Symmetrical, balanced medicinal-chemistry decision workspace comparing
 * a parent molecule against generated analogs across 6 research-relevant dimensions.
 *
 * Aligned with the layout, card styling, and empty-state patterns of CompareTab
 * and ModificationTab.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import api from '../lib/apiClient'
import AttributionViewer from './AttributionViewer'

/* ── Style Constants matching CompareTab & ModificationTab ────────────────── */
const accentColor = '#2dd4d4'
const cardStyle = {
  background: '#0d1a1c',
  border: '1px solid rgba(45,212,212,0.12)',
  borderRadius: '8px',
  padding: '16px',
}

const ICONS = {
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  target: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  compare: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" />
      <path d="M13 2h4a2 2 0 0 1 2 2v4" /><path d="M2 13v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  edit: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  save: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  alert: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  dossier: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
}

/* ── 2D Molecule SVG Renderer (Transparent & Filtered) ────────────────────── */
function MoleculeStructure({ rdkit, smiles, width = 210, height = 150 }) {
  const svg = useMemo(() => {
    if (!rdkit || !smiles) return null
    let mol = null
    try {
      mol = rdkit.get_mol(smiles)
      if (!mol || !mol.is_valid()) return null
      let s = mol.get_svg(width, height)
      s = s.replace(/<rect[^>]*fill=['"]#FFFFFF['"][^>]*>/i, '<rect opacity="0" fill="none" />')
      s = s.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
      return s
    } catch {
      return null
    } finally {
      if (mol) mol.delete()
    }
  }, [rdkit, smiles, width, height])

  if (!svg) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontSize: '14px',
          fontStyle: 'italic',
        }}
      >
        No structure
      </div>
    )
  }

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/* ── Custom Radar Tooltip ─────────────────────────────────────────────────── */
function CustomRadarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  return (
    <div
      style={{
        background: '#071214',
        border: '1px solid rgba(45,212,212,0.3)',
        borderRadius: 6,
        padding: '8px 12px',
        color: '#e2e8f0',
        fontSize: 13,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontWeight: 600, color: accentColor, marginBottom: 4, fontSize: 13.5 }}>{data.axis}</div>
      <div style={{ color: '#2dd4d4' }}>Parent (Normalized): {data.parent != null ? (data.parent * 100).toFixed(1) + '%' : 'N/A'}</div>
      <div style={{ color: '#10b981' }}>Analog (Normalized): {data.analog != null ? (data.analog * 100).toFixed(1) + '%' : 'N/A'}</div>
      {data.parent_raw != null && (
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
          Raw: Parent = {data.parent_raw} | Analog = {data.analog_raw}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT: WarRoomTab
   ══════════════════════════════════════════════════════════════════════════════ */
export default function WarRoomTab({
  isActive,
  rdkit,
  canonicalSmiles,
  currentMolecule,
  onSaveExperiment,
  onGenerateReport,
  logActivity,
  onSendToCompare,
  onSendToEditor,
  onCalculatingChange,
  onSelectBenchmarkParent,
}) {
  const [profiles, setProfiles] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState('anti_inflammatory_exploration_v1')
  const [topN, setTopN] = useState(5)

  const [evaluationData, setEvaluationData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedAnalogIndex, setSelectedAnalogIndex] = useState(0)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [attributionTarget, setAttributionTarget] = useState(null)
  const [isExportingDossier, setIsExportingDossier] = useState(false)
  const [benchmarksList, setBenchmarksList] = useState([])

  const abortControllerRef = useRef(null)
  const debounceTimerRef = useRef(null)
  const lastEvaluatedKeyRef = useRef('')

  // 1. Fetch available profiles and benchmarks
  useEffect(() => {
    let isMounted = true
    const fetchInitialData = async () => {
      try {
        const res = await api.get('/api/modification/profiles')
        if (isMounted && res.profiles?.length > 0) {
          setProfiles(res.profiles)
        }
      } catch (err) {
        console.warn('Could not load optimization profiles from server:', err)
      }

      try {
        const bRes = await api.get('/api/benchmarks')
        if (isMounted && bRes.benchmarks?.length > 0) {
          setBenchmarksList(bRes.benchmarks)
        }
      } catch (err) {
        console.warn('Could not load benchmarks in WarRoom:', err)
      }
    }
    fetchInitialData()
    return () => { isMounted = false }
  }, [])

  // 2. Evaluation engine with AbortController and cancellation safety
  const executeEvaluation = useCallback(async (smi, profileId, nCandidates, isManual = false) => {
    if (!smi) {
      setEvaluationData(null)
      setIsLoading(false)
      onCalculatingChange?.(false)
      lastEvaluatedKeyRef.current = ''
      return
    }

    const currentKey = `${smi}__${profileId}__${nCandidates}`
    if (!isManual && currentKey === lastEvaluatedKeyRef.current) {
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    onCalculatingChange?.(true)
    setErrorMessage('')

    try {
      const payload = {
        smiles: smi,
        profile_id: profileId,
        top_n: parseInt(nCandidates, 10) || 5,
      }
      const data = await api.post('/api/modification/war-room', payload, { signal: controller.signal })
      setEvaluationData(data)
      setSelectedAnalogIndex(0)
      lastEvaluatedKeyRef.current = currentKey
      logActivity?.(`War Room evaluated for ${smi} with profile: ${data.profile?.name}`)
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        // Silently exit when aborted by newer molecule edit
        return
      }
      console.error('War room evaluation error:', err)
      const detail = err.response?.data?.detail || err.message || 'Evaluation failed'
      setErrorMessage(detail)
    } finally {
      setIsLoading(false)
      onCalculatingChange?.(false)
    }
  }, [logActivity, onCalculatingChange])

  // 3. Auto-calculate the moment canonicalSmiles is drawn or changed
  useEffect(() => {
    if (!canonicalSmiles) {
      setEvaluationData(null)
      setIsLoading(false)
      onCalculatingChange?.(false)
      lastEvaluatedKeyRef.current = ''
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
      return
    }

    const currentKey = `${canonicalSmiles}__${selectedProfileId}__${topN}`
    if (currentKey === lastEvaluatedKeyRef.current) {
      return
    }

    // Immediately notify calculating state so UI reflects instant drawing reaction
    setIsLoading(true)
    onCalculatingChange?.(true)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 400ms debounce ensures continuous drawing strokes settle before firing heavy multi-dimensional ML inference
    debounceTimerRef.current = setTimeout(() => {
      executeEvaluation(canonicalSmiles, selectedProfileId, topN, false)
    }, 400)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [canonicalSmiles, selectedProfileId, topN, executeEvaluation, onCalculatingChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // Manual evaluation trigger button
  const handleManualEvaluate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    executeEvaluation(canonicalSmiles, selectedProfileId, topN, true)
  }, [canonicalSmiles, selectedProfileId, topN, executeEvaluation])

  // Active analog candidate
  const selectedAnalog = useMemo(() => {
    if (!evaluationData?.shortlist?.length) return null
    return evaluationData.shortlist[selectedAnalogIndex] || evaluationData.shortlist[0]
  }, [evaluationData, selectedAnalogIndex])

  // Active profile
  const activeProfile = useMemo(() => {
    if (evaluationData?.profile) return evaluationData.profile
    return profiles.find((p) => p.id === selectedProfileId) || null
  }, [evaluationData, profiles, selectedProfileId])

  // Radar chart data (unavailable dimensions excluded from polygon)
  const radarChartData = useMemo(() => {
    if (!evaluationData?.parent?.dimensions || !selectedAnalog?.dimensions) return []
    const pDims = evaluationData.parent.dimensions
    const aDims = selectedAnalog.dimensions

    const items = [
      { key: 'activity', axis: 'Activity' },
      { key: 'cardiac_safety', axis: 'Cardiac Safety' },
      { key: 'mitochondrial_safety', axis: 'Mito Safety' },
      { key: 'oral_heuristic', axis: 'Oral Proxy' },
      { key: 'synthetic_accessibility', axis: 'Synthetic Ease' },
    ]

    return items
      .map((item) => {
        const p = pDims[item.key]
        const a = aDims[item.key]
        if (!p?.available || !a?.available) return null
        return {
          axis: item.axis,
          parent: p.normalized_score ?? 0,
          analog: a.normalized_score ?? 0,
          parent_raw: p.raw_value,
          analog_raw: a.raw_value,
        }
      })
      .filter(Boolean)
  }, [evaluationData, selectedAnalog])

  const handleCopySmiles = (smilesText, label) => {
    navigator.clipboard.writeText(smilesText)
    setCopyFeedback(label)
    setTimeout(() => setCopyFeedback(''), 1800)
  }

  // Generate Research Dossier for current War Room optimization & candidate
  const handleGenerateWarRoomDossier = useCallback(async (format = 'Research Dossier (PDF)') => {
    if (!onGenerateReport) return
    const candidate = selectedAnalog || evaluationData?.shortlist?.[0]
    if (!candidate || !evaluationData) return

    setIsExportingDossier(true)
    try {
      const radarList = candidate.radar_data || []
      const dimPayload = radarList.length > 0 ? radarList.map(r => ({
        name: r.dimension_name || r.name,
        id: r.dimension_key || r.id,
        parent_raw: r.parent_raw ?? r.parent_val,
        analog_raw: r.analog_raw ?? r.analog_val,
        delta: r.delta,
        effective_weight: r.weight,
        score: r.score,
        is_available: r.is_available ?? r.available ?? true,
        unavailability_reason: r.unavailability_reason,
      })) : (Array.isArray(candidate.dimensions) ? candidate.dimensions : Object.entries(candidate.dimensions || {}).map(([k, v]) => ({
        name: k.replace(/_/g, ' ').toUpperCase(),
        id: k,
        ...v,
      })))

      const warRoomPayload = {
        is_available: true,
        profile_id: activeProfile?.id || selectedProfileId,
        profile_name: activeProfile?.name || 'Lead Optimization Profile',
        profile_version: activeProfile?.version || 'v1',
        target_endpoint: activeProfile?.target_endpoint_name || activeProfile?.target_endpoint,
        description: activeProfile?.description,
        parent_smiles: canonicalSmiles,
        candidate_smiles: candidate.product_smiles,
        candidate_name: candidate.transform_name || `Analog #${(candidate.rank || selectedAnalogIndex + 1)}`,
        candidate_score: candidate.aggregate_score != null ? Math.round(candidate.aggregate_score * 1000) / 10 : null,
        hard_constraints_passed: candidate.constraints_passed ?? candidate.hard_constraints_passed ?? true,
        hard_constraint_flags: candidate.constraint_violations || candidate.hard_constraint_flags || [],
        dimensions: dimPayload,
        property_deltas: candidate.property_deltas || {},
      }

      await onGenerateReport(format, {
        smiles: candidate.product_smiles,
        properties: candidate.properties,
        war_room: warRoomPayload,
        lineage: {
          parent_experiment_id: 'Parent Lead',
          transform_name: candidate.transform_name,
          modification_chain: [canonicalSmiles, candidate.product_smiles],
        },
      })
    } finally {
      setIsExportingDossier(false)
    }
  }, [onGenerateReport, selectedAnalog, evaluationData, activeProfile, selectedProfileId, canonicalSmiles, selectedAnalogIndex])

  /* ── 1. No Molecule Loaded Guard (Identical to CompareTab & ModificationTab) ── */
  if (!canonicalSmiles) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid rgba(45,212,212,0.1)', background: '#0d1a1c', height: '650px', padding: '24px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '860px', width: '100%' }}>
          <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: accentColor, opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#d1d5db', margin: '0 0 8px 0', textAlign: 'center' }}>No Molecule Loaded</h2>
          <p style={{ color: '#64748b', fontSize: '15px', maxWidth: '460px', lineHeight: 1.5, margin: '0 auto', textAlign: 'center' }}>
            Please draw or load a molecule on the <span style={{ color: accentColor }}>Draw</span> tab first, then return here to optimize.
          </p>

          {benchmarksList.length > 0 && (
            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(45,212,212,0.15)' }} />
                <span style={{ fontSize: '13.5px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Or select a documented benchmark drug as parent lead
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(45,212,212,0.15)' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', maxWidth: '680px', margin: '0 auto' }}>
                {benchmarksList.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelectBenchmarkParent?.(b.canonical_smiles)}
                    style={{
                      padding: '8px 16px', fontSize: '13.5px', fontWeight: 600,
                      borderRadius: '6px', border: '1px solid rgba(45,212,212,0.3)',
                      background: 'rgba(45,212,212,0.08)', color: accentColor,
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(45,212,212,0.2)'
                      e.currentTarget.style.borderColor = accentColor
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(45,212,212,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span>{b.name}</span>
                    <span style={{
                      fontSize: '11.5px', padding: '2px 7px', borderRadius: '4px',
                      background: 'rgba(45,212,212,0.15)', color: '#e2e8f0', fontWeight: 500,
                    }}>
                      {b.historical_status_badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── 2. Populated State: Symmetrical 50/50 Dual-Row Workspace ── */
  return (
    <>
      {/* ── TOP CONTROL CARD: Profiles & Run Button ── */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Left: Module Title & Molecule Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ICONS.shield}
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                Lead Optimization War Room
              </h3>
              <span
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  background: 'rgba(45,212,212,0.12)',
                  color: accentColor,
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                Multi-Parameter Optimization
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
              Parent Molecule:{' '}
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>
                {canonicalSmiles.length > 55 ? canonicalSmiles.slice(0, 52) + '...' : canonicalSmiles}
              </span>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 600 }}>
                Optimization Profile
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={isLoading}
                style={{
                  background: '#081214',
                  border: '1px solid rgba(45,212,212,0.18)',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 30px 7px 11px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Benchmark Lead Selector */}
            {benchmarksList.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 600 }}>
                  Benchmark Lead
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = benchmarksList.find(b => b.id === e.target.value)
                    if (found && onSelectBenchmarkParent) {
                      onSelectBenchmarkParent(found.canonical_smiles)
                      e.target.value = ''
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    background: '#081214',
                    border: '1px solid rgba(45,212,212,0.25)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                    padding: '7px 30px 7px 11px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                  }}
                >
                  <option value="" disabled>Load Benchmark Lead...</option>
                  {benchmarksList.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.historical_status_badge})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 600 }}>
                Candidates
              </label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                disabled={isLoading}
                style={{
                  background: '#081214',
                  border: '1px solid rgba(45,212,212,0.18)',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 28px 7px 11px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
              {evaluationData && (
                <button
                  disabled={isExportingDossier}
                  onClick={() => handleGenerateWarRoomDossier('Research Dossier (PDF)')}
                  style={{
                    background: isExportingDossier ? 'rgba(45,212,212,0.2)' : 'rgba(45,212,212,0.12)',
                    color: accentColor,
                    fontWeight: 600,
                    fontSize: '14px',
                    border: '1px solid rgba(45,212,212,0.3)',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    cursor: isExportingDossier ? 'not-allowed' : 'pointer',
                    opacity: isExportingDossier ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  title="Export comprehensive Research Dossier for this optimization"
                >
                  {isExportingDossier ? (
                    <>
                      <div style={{ width: '12px', height: '12px', border: '2px solid rgba(45,212,212,0.3)', borderTopColor: '#2dd4d4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Exporting...
                    </>
                  ) : (
                    <>
                      {ICONS.dossier} Export Dossier
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleManualEvaluate}
                disabled={isLoading}
                style={{
                  background: isLoading ? 'rgba(45,212,212,0.2)' : accentColor,
                  color: isLoading ? '#64748b' : '#000',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <span style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}>{ICONS.refresh}</span>
                {isLoading ? 'Optimizing...' : 'Evaluate Analogs'}
              </button>
            </div>
          </div>
        </div>

        {/* Objective & Provenance Bar */}
        {activeProfile && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(45,212,212,0.08)',
              fontSize: '13.5px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <strong style={{ color: '#cbd5e1' }}>Objective:</strong> {activeProfile.description}
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span>
                Target Activity: <strong style={{ color: accentColor }}>{activeProfile.target_endpoint_name || activeProfile.target_endpoint}</strong>
              </span>
              <span>
                Hard Constraints: <strong style={{ color: '#cbd5e1' }}>{activeProfile.hard_constraints?.length || 0} active</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(244,63,94,0.1)',
            border: '1px solid rgba(244,63,94,0.3)',
            color: '#f87171',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {ICONS.alert}
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── ROW 1: 50/50 Side-by-Side Structures (Left) & Radar Visualizer (Right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'stretch' }}>
        {/* LEFT PANEL: Structural Trade-Off (Parent vs Analog) */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
              Structural Trade-Off
            </h3>
            {selectedAnalog && (
              <span style={{ fontSize: '13.5px', color: '#10b981', fontWeight: 600 }}>
                Analog #{selectedAnalog.rank}: {selectedAnalog.transform_name}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
            {/* Parent Structure Box */}
            <div
              style={{
                background: '#081214',
                borderRadius: '6px',
                border: '1px solid rgba(45,212,212,0.12)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ alignSelf: 'flex-start', fontSize: '13.5px', fontWeight: 600, color: accentColor, marginBottom: 4 }}>
                Parent Molecule
              </div>
              <MoleculeStructure rdkit={rdkit} smiles={canonicalSmiles} width={190} height={135} />
              <div
                onClick={() => handleCopySmiles(canonicalSmiles, 'parent')}
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  marginTop: 4,
                  cursor: 'pointer',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                }}
                title="Click to copy SMILES"
              >
                {copyFeedback === 'parent' ? 'Copied!' : (canonicalSmiles.length > 26 ? canonicalSmiles.slice(0, 24) + '...' : canonicalSmiles)}
              </div>
              <div style={{ marginTop: 6, fontSize: '13px', color: '#cbd5e1', display: 'flex', gap: 10 }}>
                <span>MW: {evaluationData?.parent?.properties?.molecular_weight || currentMolecule?.mw || '-'}</span>
                <span>LogP: {evaluationData?.parent?.properties?.logp || currentMolecule?.logP || '-'}</span>
              </div>
            </div>

            {/* Selected Analog Box */}
            <div
              style={{
                background: '#081214',
                borderRadius: '6px',
                border: '1px solid rgba(16,185,129,0.25)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ alignSelf: 'flex-start', fontSize: '13.5px', fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
                Selected Candidate
              </div>
              <MoleculeStructure rdkit={rdkit} smiles={selectedAnalog?.product_smiles} width={190} height={135} />
              <div
                onClick={() => selectedAnalog && handleCopySmiles(selectedAnalog.product_smiles, 'analog')}
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  marginTop: 4,
                  cursor: 'pointer',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                }}
                title="Click to copy SMILES"
              >
                {copyFeedback === 'analog' ? 'Copied!' : (selectedAnalog?.product_smiles?.length > 26 ? selectedAnalog.product_smiles.slice(0, 24) + '...' : selectedAnalog?.product_smiles || '-')}
              </div>
              <div style={{ marginTop: 6, fontSize: '13px', color: '#cbd5e1', display: 'flex', gap: 10 }}>
                <span>MW: {selectedAnalog?.properties?.molecular_weight || '-'}</span>
                <span>LogP: {selectedAnalog?.properties?.logp || '-'}</span>
              </div>
            </div>
          </div>

          {/* Quick Handoff Action Bar */}
          {selectedAnalog && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(45,212,212,0.08)' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Handoff candidate:</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    if (onSendToCompare) onSendToCompare(canonicalSmiles, selectedAnalog.product_smiles)
                  }}
                  style={{
                    background: 'rgba(45,212,212,0.12)',
                    color: accentColor,
                    border: '1px solid rgba(45,212,212,0.25)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {ICONS.compare} Send to Compare
                </button>
                <button
                  onClick={() => {
                    if (onSendToEditor) onSendToEditor(selectedAnalog.product_smiles)
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {ICONS.edit} Load in Editor
                </button>
                <button
                  disabled={isExportingDossier}
                  onClick={() => handleGenerateWarRoomDossier('Research Dossier (PDF)')}
                  style={{
                    background: isExportingDossier ? 'rgba(45,212,212,0.25)' : 'rgba(45,212,212,0.15)',
                    color: accentColor,
                    border: '1px solid rgba(45,212,212,0.35)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isExportingDossier ? 'not-allowed' : 'pointer',
                    opacity: isExportingDossier ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  title="Generate Research Dossier for this candidate and profile"
                >
                  {isExportingDossier ? (
                    <>
                      <div style={{ width: '10px', height: '10px', border: '1.5px solid rgba(45,212,212,0.3)', borderTopColor: '#2dd4d4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Exporting...
                    </>
                  ) : (
                    <>
                      {ICONS.dossier} Research Dossier
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (onSaveExperiment) {
                      onSaveExperiment({
                        type: 'lead_optimization',
                        parent_smiles: canonicalSmiles,
                        analog_smiles: selectedAnalog.product_smiles,
                        profile_id: selectedProfileId,
                        score: selectedAnalog.aggregate_score,
                      })
                    }
                  }}
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {ICONS.save} Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Radar Profile Visualizer */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
              Multi-Dimensional Radar Profile
            </h3>
            <div style={{ display: 'flex', gap: 12, fontSize: '13.5px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: accentColor }}>
                <span style={{ width: 9, height: 9, background: accentColor, borderRadius: 2 }} /> Parent
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                <span style={{ width: 9, height: 9, background: '#10b981', borderRadius: 2 }} /> Analog
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {radarChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                  <PolarGrid stroke="rgba(45, 212, 212, 0.18)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 13 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Radar name="Parent" dataKey="parent" stroke={accentColor} fill={accentColor} fillOpacity={0.2} strokeWidth={2} />
                  <Radar name="Analog" dataKey="analog" stroke="#10b981" fill="#10b981" fillOpacity={0.3} strokeWidth={2} />
                  <RechartsTooltip content={<CustomRadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#64748b', fontSize: '14px' }}>
                {isLoading ? 'Calculating radar dimensions...' : 'Run evaluation to render radar.'}
              </div>
            )}
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
            * Note: Metabolic Stability is marked unavailable in the offline model bundle and is excluded from the radar polygon to prevent misleading 0-value distortion.
          </div>
        </div>
      </div>

      {/* ── ROW 2: 50/50 Ranked Analog Shortlist (Left) & Comprehensive Evaluation Table (Right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'stretch' }}>
        {/* LEFT PANEL: Ranked Analog Shortlist */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {ICONS.target}
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                Ranked Analog Shortlist
              </h3>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Evaluated {evaluationData?.total_evaluated_analogs || 0} transforms
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
            {isLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Simulating molecular transforms, calculating properties and running ML inferences...
              </div>
            ) : !evaluationData?.shortlist?.length ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                No analogs generated for this structure.
              </div>
            ) : (
              evaluationData.shortlist.map((cand, idx) => {
                const isSelected = idx === selectedAnalogIndex
                const isViolation = !cand.constraints_passed

                return (
                  <div
                    key={cand.product_smiles}
                    onClick={() => setSelectedAnalogIndex(idx)}
                    style={{
                      background: isSelected ? 'rgba(45,212,212,0.08)' : 'rgba(8,18,20,0.6)',
                      border: `1px solid ${isSelected ? 'rgba(45,212,212,0.4)' : 'rgba(45,212,212,0.08)'}`,
                      borderRadius: '6px',
                      padding: '11px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: isSelected ? accentColor : '#1e293b',
                            color: isSelected ? '#050b0d' : '#94a3b8',
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          #{cand.rank}
                        </span>
                        <span style={{ fontSize: '14.5px', fontWeight: 600, color: isSelected ? '#38bdf8' : '#e2e8f0' }}>
                          {cand.transform_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isViolation ? (
                          <span
                            style={{
                              fontSize: '12px',
                              background: 'rgba(244,63,94,0.15)',
                              color: '#f43f5e',
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                            title={cand.constraint_violations?.map((v) => v.description).join('; ')}
                          >
                            {ICONS.alert} Violated ({cand.constraint_violations.length})
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '12px',
                              background: 'rgba(16,185,129,0.12)',
                              color: '#10b981',
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            {ICONS.check} Passed
                          </span>
                        )}

                        <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: isSelected ? accentColor : '#cbd5e1' }}>
                          {(cand.aggregate_score * 100).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: 6 }}>
                      {cand.transform_description}
                    </div>

                    <div style={{ display: 'flex', gap: 10, fontSize: '12.5px', color: '#94a3b8' }}>
                      <span>MW: <strong style={{ color: cand.property_deltas?.molecular_weight?.delta > 0 ? '#f59e0b' : '#38bdf8' }}>{cand.property_deltas?.molecular_weight?.delta > 0 ? '+' : ''}{cand.property_deltas?.molecular_weight?.delta}</strong></span>
                      <span>LogP: <strong style={{ color: cand.property_deltas?.logp?.delta > 0 ? '#f59e0b' : '#10b981' }}>{cand.property_deltas?.logp?.delta > 0 ? '+' : ''}{cand.property_deltas?.logp?.delta}</strong></span>
                      <span>TPSA: <strong style={{ color: '#cbd5e1' }}>{cand.property_deltas?.tpsa?.delta > 0 ? '+' : ''}{cand.property_deltas?.tpsa?.delta}</strong></span>
                      <span>Coverage: <strong>{(cand.coverage * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Dimension Breakdown & Score Contribution */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
              Multi-Dimensional Evaluation Table
            </h3>
            {selectedAnalog && (
              <span style={{ fontSize: '14px', color: accentColor, fontWeight: 600, fontFamily: 'monospace' }}>
                Score: {(selectedAnalog.aggregate_score * 100).toFixed(2)}
              </span>
            )}
          </div>

          {/* Dimension Breakdown Table */}
          <div style={{ flex: 1, overflowX: 'auto', marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px' }}>Dimension</th>
                  <th style={{ padding: '8px 10px' }}>Parent Raw</th>
                  <th style={{ padding: '8px 10px' }}>Analog Raw</th>
                  <th style={{ padding: '8px 10px' }}>Weight</th>
                  <th style={{ padding: '8px 10px' }}>Score</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedAnalog?.radar_data ? (
                  selectedAnalog.radar_data.map((dim) => {
                    const isAvail = dim.available
                    const b = selectedAnalog.score_breakdown?.find(sb => sb.dimension_key === dim.dimension_key)
                    const pNorm = dim.parent_normalized
                    const aNorm = dim.analog_normalized

                    return (
                      <tr key={dim.dimension_key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: isAvail ? '#e2e8f0' : '#64748b' }}>
                          {dim.dimension_name}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {isAvail ? String(dim.parent_raw ?? '-') : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {isAvail ? String(dim.analog_raw ?? '-') : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: isAvail ? '#38bdf8' : '#64748b', fontFamily: 'monospace' }}>
                          {b ? `${(b.effective_weight * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: isAvail ? '#10b981' : '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                          {aNorm != null ? `${(aNorm * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isAvail ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: '#10b981', fontSize: '12px' }}>Available</span>
                              {['cardiac_safety', 'mitochondrial_safety', 'activity'].includes(dim.dimension_key) && (
                                <button
                                  onClick={() => {
                                    const ep = dim.dimension_key === 'cardiac_safety' ? 'herg'
                                      : (dim.dimension_key === 'mitochondrial_safety' ? 'tox21_mmp' : (activeProfile?.target_endpoint || 'antiinflammatory'))
                                    setAttributionTarget({
                                      smiles: selectedAnalog?.product_smiles || canonicalSmiles,
                                      endpoint: ep,
                                      title: `Explain Attribution: Analog #${selectedAnalog?.rank || 1} (${dim.dimension_name})`,
                                    })
                                  }}
                                  style={{
                                    background: 'rgba(45,212,212,0.1)',
                                    color: accentColor,
                                    border: '1px solid rgba(45,212,212,0.25)',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '12.5px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                  title="Inspect atom and bond model attribution"
                                >
                                  Explain
                                </button>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                color: '#eab308',
                                fontSize: '11.5px',
                                background: 'rgba(234,179,8,0.1)',
                                padding: '2px 7px',
                                borderRadius: 4,
                              }}
                              title={dim.reason || 'Not available offline'}
                            >
                              Unavailable
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px 8px', color: '#64748b', textAlign: 'center', fontSize: '13px' }}>
                      No evaluation data loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Hard Constraints Bottom Status */}
          {selectedAnalog && (
            <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(45,212,212,0.08)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Hard Constraints Check:
              </div>
              {selectedAnalog.constraints_passed ? (
                <div style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {ICONS.check} All {activeProfile?.hard_constraints?.length || 0} hard constraints satisfied for this candidate.
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#f43f5e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    {ICONS.alert} Violated constraints:
                  </div>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, color: '#fca5a5' }}>
                    {selectedAnalog.constraint_violations?.map((v, i) => (
                      <li key={i}>{v.description} (Actual: {v.actual_value})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM SCIENTIFIC NOTICE (Consistent with footer disclaimers) ── */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(8,18,20,0.5)',
          border: '1px solid rgba(45,212,212,0.08)',
          borderRadius: '6px',
          fontSize: '12.5px',
          color: '#64748b',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: '#94a3b8' }}>Scientific Notice:</strong>{' '}
        {evaluationData?.disclaimer ||
          'ROGVEDA Lead Optimization War Room produces computational estimates and heuristic scores for in-silico hypothesis generation. These scores do not establish clinical safety, in-vivo efficacy, human bioavailability, or readiness for regulatory submission.'}
      </div>

      {/* Phase 2: Explainable Molecular Attribution Modal */}
      <AttributionViewer
        isOpen={!!attributionTarget}
        onClose={() => setAttributionTarget(null)}
        smiles={attributionTarget?.smiles}
        initialEndpoint={attributionTarget?.endpoint || 'herg'}
        title={attributionTarget?.title}
      />
    </>
  )
}
