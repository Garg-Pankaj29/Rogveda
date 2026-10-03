import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Viewer3D from './Viewer3D'
import api from '../lib/apiClient'
import { computeProperties } from '../lib/chemistry'

/* ═══════════════════════════════════════════
   SVG ICON HELPERS
   ═══════════════════════════════════════════ */
const Icons = {
  expand: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>,
  target: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  // Brightness/lighting toggle icon — interpretation: the reference shows a sun/brightness
  // icon on the 3D viewer. We implement this as a dark↔light background toggle for the viewer.
  brightness: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  lightbulb: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  chevronRight: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  gear: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  report: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  save: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  molecule: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  document: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  checkCircle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
}

/* ═══════════════════════════════════════════
   STYLE CONSTANTS
   ═══════════════════════════════════════════ */
const cardStyle = {
  background: '#0d1a1c',
  border: '1px solid rgba(45,212,212,0.12)',
  borderRadius: '8px',
  padding: '16px',
}
const accentColor = '#2dd4d4'

/* ═══════════════════════════════════════════
   HELPER: Element color map for atom legend (Jmol scheme)
   ═══════════════════════════════════════════ */
const ELEMENT_COLORS = {
  C: '#909090', H: '#FFFFFF', N: '#3050F8', O: '#FF0D0D',
  F: '#90E050', Cl: '#1FF01F', Br: '#A62929', I: '#940094',
  S: '#FFFF30', P: '#FF8000', B: '#FFB5B5', Si: '#F0C8A0',
  Se: '#FFA100', Na: '#AB5CF2', K: '#8F40D4', Ca: '#3DFF00',
  Fe: '#E06633', Zn: '#7D80B0', Mg: '#8AFF00',
}

function getElementColor(symbol) {
  return ELEMENT_COLORS[symbol] || '#CCCCCC'
}

/* ═══════════════════════════════════════════
   HELPER: Generate SVG thumbnail for a SMILES (frontend RDKit)
   ═══════════════════════════════════════════ */
function generateSvg(rdkit, smiles, width = 150, height = 120) {
  if (!rdkit || !smiles) return ''
  let mol = null
  try {
    mol = rdkit.get_mol(smiles)
    if (!mol || !mol.is_valid()) return ''
    let svg = mol.get_svg(width, height)
    svg = svg.replace(/<rect[^>]*(?:fill=['"]#FFFFFF['"]|fill:#FFFFFF)[^>]*>/i, '<rect opacity="0" fill="none" />')
    svg = svg.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
    svg = svg.replace(/#000000/g, '#c8d0d8')
    return svg
  } catch (e) {
    return ''
  } finally {
    if (mol) mol.delete()
  }
}

/* ═══════════════════════════════════════════
   HELPER: Parse molecular formula to extract element list
   ═══════════════════════════════════════════ */
function parseFormulaElements(formula) {
  if (!formula || formula === '-') return []
  const matches = formula.matchAll(/([A-Z][a-z]?)(\d*)/g)
  const elements = []
  const seen = new Set()
  for (const m of matches) {
    if (m[1] && !seen.has(m[1])) {
      seen.add(m[1])
      elements.push(m[1])
    }
  }
  return elements
}

/* ═══════════════════════════════════════════
   HELPER: Formula to subscripted HTML
   ═══════════════════════════════════════════ */
function formulaToHtml(formula) {
  if (!formula || formula === '-') return '-'
  return formula.replace(/(\d+)/g, '<sub>$1</sub>')
}

/* ═══════════════════════════════════════════
   Badge color logic (shared with AnalysisTab)
   ═══════════════════════════════════════════ */
function getBadgeColors(statusLabel) {
  const s = (statusLabel || '').toLowerCase()
  if (s.includes('low risk') || s.includes('likely active') || s.includes('safe'))
    return { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', barColor: '#4ade80' }
  if (s.includes('high risk') || s.includes('low probability'))
    return { bg: 'rgba(239,68,68,0.15)', color: '#f87171', barColor: '#f87171' }
  if (s.includes('moderate') || s.includes('uncertain'))
    return { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', barColor: '#fbbf24' }
  return { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', barColor: '#64748b' }
}


/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function PredictionTab({
  rdkit,
  canonicalSmiles,
  currentMolecule,
  sdfBlock,
  setSdfBlock,
  ketcherRef,
  last3dSmiles,
  is3dLoading,
  setIs3dLoading,
  onSaveExperiment,
  onGenerateReport,
  logActivity,
  setActiveTab,
}) {
  const [predictions, setPredictions] = useState([])
  const [aiSummary, setAiSummary] = useState(null)
  const [predLoading, setPredLoading] = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [similarMols, setSimilarMols] = useState([])

  /* ─── Local state ─── */
  const [viewMode, setViewMode] = useState('3d')  // default to 3D on this tab
  const [viewerBg, setViewerBg] = useState('dark')
  const [localSdf, setLocalSdf] = useState(sdfBlock || '')
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewerContainerRef = useRef(null)

  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // 2D SVG for the 2D view
  const [svgHtml, setSvgHtml] = useState('')

  // Track last fetched smiles to avoid redundant calls
  const lastFetchedSmiles = useRef('')

  /* ─── Generate 2D SVG ─── */
  useEffect(() => {
    if (!rdkit || !canonicalSmiles || viewMode !== '2d') return
    try {
      const mol = rdkit.get_mol(canonicalSmiles)
      if (mol && mol.is_valid()) {
        let svg = mol.get_svg(400, 320)
        svg = svg.replace(/<rect[^>]*fill=['"]#FFFFFF['"][^>]*>/i, '<rect opacity="0" fill="none" />')
        svg = svg.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
        setSvgHtml(svg)
      }
      if (mol) mol.delete()
    } catch (e) { console.error('SVG gen error:', e) }
  }, [rdkit, canonicalSmiles, viewMode])

  /* ─── Auto-generate 3D when tab loads with a molecule ─── */
  useEffect(() => {
    if (!canonicalSmiles || localSdf) return
    // If sdfBlock from parent is already available, use it
    if (sdfBlock && last3dSmiles?.current === canonicalSmiles) {
      setLocalSdf(sdfBlock)
      return
    }
    // Otherwise generate
    const gen3d = async () => {
      setIs3dLoading?.(true)
      try {
        const resp = await api.post('/api/molecule/3d', { smiles: canonicalSmiles })
        setLocalSdf(resp.sdf_block)
        setSdfBlock?.(resp.sdf_block)
        if (last3dSmiles) last3dSmiles.current = canonicalSmiles
      } catch (e) {
        console.error('3D gen failed:', e)
      } finally {
        setIs3dLoading?.(false)
      }
    }
    gen3d()
  }, [canonicalSmiles, localSdf, sdfBlock, last3dSmiles])

  /* ─── Fetch predictions, similar molecules, and AI summary ─── */
  useEffect(() => {
    if (!canonicalSmiles || canonicalSmiles === lastFetchedSmiles.current) return
    lastFetchedSmiles.current = canonicalSmiles

    // Fetch ML predictions
    const fetchPreds = async () => {
      setPredLoading(true)
      try {
        const data = await api.post('/api/molecule/predict-all', { smiles: canonicalSmiles })
        const rawPreds = Array.isArray(data) ? data : []
        setPredictions(rawPreds)
        return rawPreds
      } catch (e) {
        console.error('predict-all failed:', e)
        setPredictions([])
        return []
      } finally {
        setPredLoading(false)
      }
    }

    // Fetch similar molecules
    const fetchSimilar = async () => {
      setSimLoading(true)
      try {
        const data = await api.post('/api/molecule/similar', {
          smiles: canonicalSmiles,
          top_n: 4,
          threshold: 0.0,
          metric: 'tanimoto_ecfp4',
        })
        setSimilarMols(data.hits || [])
      } catch (e) {
        console.error('similar failed:', e)
        setSimilarMols([])
      } finally {
        setSimLoading(false)
      }
    }

    // Combined AI call (after predictions are available)
    const fetchAI = async (preds) => {
      try {
        const props = currentMolecule || {}
        const data = await api.post('/api/molecule/ai-summary', {
          smiles: canonicalSmiles,
          properties: {
            formula: props.formula || '-',
            mw: props.mw || '-',
            logP: props.logP || '-',
            tpsa: props.tpsa || '-',
            hbd: props.hbd || '-',
            hba: props.hba || '-',
            rotBonds: props.rotBonds || '-',
            aromaticRings: props.aromaticRings || '-',
            heavyAtoms: props.heavyAtoms || '-',
          },
          predictions: preds,
        })
        setAiSummary(data)
      } catch (e) {
        console.error('ai-summary failed:', e)
        setAiSummary({
          summary: 'Local AI not available — start LM Studio to generate AI insights.',
          key_insights: [],
        })
      } finally {
        setAiLoading(false)
      }
    }

    // Reset state for new molecule
    setPredictions([])
    setSimilarMols([])
    setAiSummary(null)
    setChatMessages([])
    setShowChat(false)
    setLocalSdf(null)

    // Execute in order: predictions first (needed for AI context), others in parallel
    setAiLoading(true)
    fetchPreds().then(preds => fetchAI(preds))
    fetchSimilar()
  }, [canonicalSmiles]) // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: currentMolecule intentionally excluded — it's an object that changes reference
  // on every poll cycle, which would cause infinite re-fetching. canonicalSmiles is the
  // stable identifier for molecule changes.

  /* ─── Copy SMILES to clipboard ─── */
  const handleCopySmiles = useCallback(() => {
    const smiles = canonicalSmiles || ''
    if (!smiles) return
    navigator.clipboard.writeText(smiles).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(console.error)
  }, [canonicalSmiles])

  /* ─── Fullscreen toggle ─── */
  const handleFullscreen = useCallback(() => {
    const el = viewerContainerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(console.error)
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(console.error)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  /* ─── Center/fit viewer ─── */
  const handleCenterViewer = useCallback(() => {
    window.dispatchEvent(new Event('viewer3d-fit'))
  }, [])

  /* ─── Chat: send message ─── */
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const newHistory = [...chatMessages, userMsg]
    setChatMessages(newHistory)
    setChatInput('')
    setChatLoading(true)

    // Build system context with real molecule data
    const props = currentMolecule || {}
    const predContext = predictions.map(p =>
      p.available
        ? `${p.endpoint_name}: ${p.status_label} (confidence: ${p.confidence})`
        : `${p.endpoint_name}: Model not yet available`
    ).join('\n')

    const systemPrompt = `You are Rogveda AI, a professional medicinal chemistry assistant.

Current Molecule Context:
SMILES: ${canonicalSmiles}
Molecular Formula: ${props.formula || '-'}
Molecular Weight: ${props.mw || '-'} g/mol
LogP: ${props.logP || '-'}
TPSA: ${props.tpsa || '-'} Å²
H-Bond Donors: ${props.hbd || '-'}
H-Bond Acceptors: ${props.hba || '-'}
Rotatable Bonds: ${props.rotBonds || '-'}
Aromatic Rings: ${props.aromaticRings || '-'}
Heavy Atoms: ${props.heavyAtoms || '-'}

ML Predictions:
${predContext || 'None available'}

Instructions:
1. If the user asks about the current molecule, base your answer on the data above. Do NOT fabricate predictions for categories marked 'not yet available'.
2. If the user asks a general chemistry question or about a completely different molecule, answer using your general knowledge, and do NOT mention the current molecule.`

    try {
      const data = await api.post('/api/chat/', {
        messages: newHistory.map(m => ({ role: m.role, content: m.content })),
        system_prompt: systemPrompt,
      })
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      const errMsg = e.status === 503
        ? 'Local AI not available — please start LM Studio to chat.'
        : `Error: ${e.message || 'Chat failed'}`
      setChatMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatMessages, chatLoading, canonicalSmiles, currentMolecule, predictions])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  /* ─── Element legend from current molecule ─── */
  const elements = parseFormulaElements(currentMolecule?.formula)

  /* ─── Cache similar molecule SVGs to avoid expensive RDKit calls every render ─── */
  const similarSvgs = useMemo(() => {
    if (!rdkit || !similarMols.length) return []
    return similarMols.slice(0, 4).map(mol => ({
      smiles: mol.canonical_smiles,
      tanimoto: mol.tanimoto,
      svg: generateSvg(rdkit, mol.canonical_smiles, 150, 100),
    }))
  }, [rdkit, similarMols])

  const noMolecule = !canonicalSmiles

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <>
      {/* ═══ ROW 1: Viewer | Molecular Info | AI Insight ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* ── COLUMN 1: Molecule Viewer ── */}
        <div style={cardStyle} ref={viewerContainerRef}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Molecule Viewer
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* 2D/3D toggle */}
              <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d', marginRight: '8px' }}>
                <button
                  onClick={() => setViewMode('2d')}
                  style={{
                    padding: '4px 14px', fontSize: '12px', fontWeight: 600,
                    border: 'none', cursor: 'pointer', borderRadius: '5px',
                    transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                    ...(viewMode === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
                  }}
                >2D</button>
                <button
                  onClick={() => setViewMode('3d')}
                  style={{
                    padding: '4px 14px', fontSize: '12px', fontWeight: 600,
                    border: 'none', cursor: 'pointer', borderRadius: '5px',
                    transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                    ...(viewMode === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
                  }}
                >3D</button>
              </div>
              {/* Control icons */}
              {[
                { icon: Icons.expand, label: 'Fullscreen', handler: handleFullscreen },
                { icon: Icons.target, label: 'Center', handler: handleCenterViewer },
                { icon: Icons.brightness, label: 'Toggle lighting', handler: () => setViewerBg(b => b === 'dark' ? 'light' : 'dark') },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.handler}
                  title={btn.label}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '30px', height: '30px', borderRadius: '6px',
                    border: '1px solid rgba(45,212,212,0.1)',
                    background: 'rgba(255,255,255,0.02)', color: '#94a3b8',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.1)'; e.currentTarget.style.color = accentColor }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94a3b8' }}
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Viewer area */}
          <div style={{
            height: '300px', borderRadius: '8px', overflow: 'hidden',
            background: viewerBg === 'dark' ? '#0a0e12' : '#e8ecf0',
            border: '1px solid rgba(45,212,212,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {noMolecule ? (
              <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Load a molecule to visualize</p>
            ) : viewMode === '3d' ? (
              is3dLoading ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Generating 3D structure...</p>
              ) : localSdf ? (
                <Viewer3D sdfBlock={localSdf} height="100%" bgColor={viewerBg === 'dark' ? '#0a0e12' : '#e8ecf0'} />
              ) : (
                <p style={{ color: '#64748b', fontSize: '13px' }}>3D structure unavailable</p>
              )
            ) : (
              svgHtml ? (
                <div dangerouslySetInnerHTML={{ __html: svgHtml }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              ) : (
                <p style={{ color: '#64748b', fontSize: '13px' }}>2D view unavailable</p>
              )
            )}
          </div>

          {/* Dynamic atom legend */}
          {elements.length > 0 && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', padding: '4px 0', flexWrap: 'wrap' }}>
              {elements.map(el => (
                <div key={el} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: getElementColor(el),
                    border: el === 'H' ? '1px solid #666' : 'none',
                  }} />
                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>{el}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── COLUMN 2: Molecular Information ── */}
        <div style={cardStyle}>
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: '0 0 14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            Molecular Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { label: 'SMILES', value: canonicalSmiles || '-', isSMILES: true },
              { label: 'Molecular Formula', value: currentMolecule?.formula || '-', isFormula: true },
              { label: 'Molecular Weight', value: currentMolecule?.mw && currentMolecule.mw !== '-' ? `${currentMolecule.mw} g/mol` : '-' },
              { label: 'LogP', value: currentMolecule?.logP || '-' },
              { label: 'TPSA', value: currentMolecule?.tpsa && currentMolecule.tpsa !== '-' ? `${currentMolecule.tpsa} Å²` : '-' },
              { label: 'H-Bond Donors', value: currentMolecule?.hbd || '-' },
              { label: 'H-Bond Acceptors', value: currentMolecule?.hba || '-' },
              { label: 'Rotatable Bonds', value: currentMolecule?.rotBonds || '-' },
              { label: 'Aromatic Rings', value: currentMolecule?.aromaticRings || '-' },
              { label: 'Heavy Atoms', value: currentMolecule?.heavyAtoms || '-' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>{row.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {row.isFormula ? (
                    <span
                      style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}
                      dangerouslySetInnerHTML={{ __html: formulaToHtml(row.value) }}
                    />
                  ) : (
                    <span style={{
                      color: '#e2e8f0', fontSize: '13px', fontWeight: 500,
                      ...(row.isSMILES ? { maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '12px' } : {})
                    }}>{row.value}</span>
                  )}
                  {row.isSMILES && canonicalSmiles && (
                    <button
                      onClick={handleCopySmiles}
                      title={copied ? 'Copied!' : 'Copy SMILES'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '4px',
                        border: 'none', background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                        color: copied ? '#4ade80' : '#94a3b8',
                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                      }}
                    >
                      {copied ? Icons.check : Icons.copy}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COLUMN 3: AI Insight ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ color: accentColor, display: 'flex' }}>{Icons.lightbulb}</span>
            <h3 style={{ color: accentColor, fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              AI Insight
            </h3>
          </div>

          {noMolecule ? (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', lineHeight: 1.6 }}>
              Load a molecule to generate AI insights.
            </p>
          ) : aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', padding: '12px 0' }}>
              <div style={{
                width: '16px', height: '16px', border: '2px solid rgba(45,212,212,0.3)',
                borderTopColor: accentColor, borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Generating AI insights...
            </div>
          ) : (
            <p style={{
              color: '#c8d0d8', fontSize: '13px', lineHeight: 1.7, margin: '0 0 16px',
              minHeight: '80px',
            }}>
              {aiSummary?.summary || 'AI insight unavailable.'}
            </p>
          )}

          {/* Ask More panel */}
          <div
            onClick={() => canonicalSmiles && setShowChat(true)}
            style={{
              marginTop: 'auto',
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(45,212,212,0.05)',
              border: '1px solid rgba(45,212,212,0.12)',
              cursor: canonicalSmiles ? 'pointer' : 'default',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '12px',
              opacity: canonicalSmiles ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (canonicalSmiles) e.currentTarget.style.background = 'rgba(45,212,212,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.05)' }}
          >
            <span style={{ color: accentColor, display: 'flex', flexShrink: 0 }}>{Icons.chat}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: accentColor, fontWeight: 600, fontSize: '14px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {chatLoading ? (
                  <>
                    <div style={{
                      width: '12px', height: '12px', border: '2px solid rgba(45,212,212,0.3)',
                      borderTopColor: accentColor, borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    Processing AI Response...
                  </>
                ) : (
                  'Ask More'
                )}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.4 }}>
                Have more questions about this molecule? Chat with AI to explore deeper insights, alternatives or predictions.
              </div>
            </div>
            <span style={{ color: accentColor, display: 'flex', flexShrink: 0 }}>{Icons.chevronRight}</span>
          </div>
        </div>
      </div>

      {/* ═══ ROW 2: Bioactivity Predictions | Report + Save ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* ── LEFT: Bioactivity Predictions ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ color: accentColor, display: 'flex' }}>{Icons.gear}</span>
            <h3 style={{ color: accentColor, fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Bioactivity Predictions
            </h3>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 150px 1fr',
            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px', fontWeight: 600, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Target / Activity</span>
            <span>Prediction</span>
            <span>Confidence</span>
          </div>

          {noMolecule ? (
            <div style={{ padding: '20px 0', color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>
              Load a molecule to see predictions.
            </div>
          ) : predLoading ? (
            <div style={{ padding: '20px 0', color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
              Loading predictions...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {predictions.map((pred, i) => {
                const colors = getBadgeColors(pred.status_label)
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 150px 1fr',
                    alignItems: 'center', padding: '12px 0',
                    borderBottom: i < predictions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
                      {pred.endpoint_name}
                    </span>
                    {pred.available ? (
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '4px 12px', borderRadius: '4px',
                        background: colors.bg, color: colors.color,
                        display: 'inline-block', textAlign: 'center',
                        width: 'fit-content',
                      }}>
                        {pred.status_label}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '11px', fontWeight: 500, fontStyle: 'italic',
                        color: '#64748b',
                      }}>
                        {pred.status_label}
                      </span>
                    )}
                    {pred.available && pred.confidence !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: colors.color, fontSize: '13px', fontWeight: 600, minWidth: '36px' }}>
                          {pred.confidence.toFixed(2)}
                        </span>
                        <div style={{
                          flex: 1, height: '8px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.round(pred.confidence * 100)}%`,
                            height: '100%', borderRadius: '4px',
                            background: colors.barColor,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: '8px' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Report Generation + Save & Exit ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Report Generation */}
          <div style={{
            background: 'linear-gradient(135deg, #0d1a1c 0%, #0a1e20 100%)',
            border: '1px solid rgba(45,212,212,0.15)',
            borderRadius: '10px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <h3 style={{ color: accentColor, fontWeight: 700, fontSize: '16px', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {Icons.report}
              Report Generation
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
              Generate a detailed report of your results.
            </p>
            <select
              value={reportFormat}
              onChange={e => setReportFormat(e.target.value)}
              style={{
                width: '100%', background: '#081214',
                border: '1px solid rgba(45,212,212,0.15)', color: '#e2e8f0',
                fontSize: '13px', borderRadius: '8px', padding: '10px 12px',
                marginBottom: '14px', outline: 'none', appearance: 'none',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              }}
            >
              <option>Comprehensive Report (PDF)</option>
              <option>Summary Report (PDF)</option>
              <option>Data Export (CSV)</option>
            </select>
            <button
              onClick={() => onGenerateReport?.(reportFormat)}
              style={{
                width: '100%', padding: '12px 0', fontWeight: 700, fontSize: '14px',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
                color: '#000', fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: '0 4px 15px rgba(45,212,212,0.25)',
                transition: 'all 0.2s ease', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {Icons.download}
              Generate Report
            </button>
          </div>

          {/* Save & Exit */}
          <div style={{ ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ color: accentColor, display: 'flex' }}>{Icons.save}</span>
                <h3 style={{ color: accentColor, fontWeight: 700, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Save & Exit
                </h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.4 }}>
                Save your current workspace and exit.
              </p>
            </div>
            <button
              onClick={onSaveExperiment || (() => window.location.href = '/')}
              style={{
                width: '100%', padding: '12px 0', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontSize: '14px', fontWeight: 600,
                background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.12)',
                color: accentColor, cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0d1a1c' }}
            >
              {Icons.save}
              Save & Exit
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ROW 3: Similar Molecules | Key Insights ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* ── LEFT: Similar Molecules ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: accentColor, display: 'flex' }}>{Icons.molecule}</span>
              <h3 style={{ color: accentColor, fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Similar Molecules
              </h3>
            </div>
          </div>

          {noMolecule ? (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Load a molecule to find similar compounds.</p>
          ) : simLoading ? (
            <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>Searching similar molecules...</p>
          ) : similarMols.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>No similar molecules found.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {similarSvgs.map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(45,212,212,0.08)',
                  borderRadius: '8px',
                  padding: '10px',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.08)'}
                >
                  {item.svg ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                      style={{ width: '100%', height: '80px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    />
                  ) : (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '11px' }}>No image</div>
                  )}
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '6px', fontWeight: 500 }}>
                    Similarity: {Number(item.tanimoto ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Key Insights ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ color: accentColor, display: 'flex' }}>{Icons.document}</span>
            <h3 style={{ color: accentColor, fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Key Insights
            </h3>
          </div>

          {noMolecule ? (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Load a molecule to see key insights.</p>
          ) : aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
              <div style={{
                width: '16px', height: '16px', border: '2px solid rgba(45,212,212,0.3)',
                borderTopColor: accentColor, borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Generating insights...
            </div>
          ) : aiSummary?.key_insights?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {aiSummary.key_insights.map((insight, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ display: 'flex', flexShrink: 0, marginTop: '1px' }}>{Icons.checkCircle}</span>
                  <span style={{ color: '#c8d0d8', fontSize: '13px', lineHeight: 1.5 }}>{insight}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>
              {aiSummary?.summary?.includes('not available') ? 'Local AI not available — start LM Studio to generate insights.' : 'No key insights available.'}
            </p>
          )}
        </div>
      </div>

      {/* ═══ CHAT MODAL ═══ */}
      {showChat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(5, 11, 13, 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowChat(false)}
          />
          <div style={{
            position: 'relative', width: '560px', maxHeight: '75vh',
            background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.2)',
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(45,212,212,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: accentColor, display: 'flex' }}>{Icons.chat}</span>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Ask More — AI Chat
                </h2>
              </div>
              <button
                onClick={() => setShowChat(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                {Icons.close}
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '200px', maxHeight: '50vh' }}>
              {chatMessages.length === 0 && (
                <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: 'auto 0' }}>
                  Ask anything about this molecule. The AI knows its computed properties and prediction results.
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: '10px',
                    fontSize: '13px', lineHeight: 1.6,
                    ...(msg.role === 'user' ? {
                      background: 'rgba(45,212,212,0.15)', color: '#e2e8f0',
                      borderBottomRightRadius: '4px',
                    } : {
                      background: 'rgba(255,255,255,0.05)', color: '#c8d0d8',
                      borderBottomLeftRadius: '4px',
                    }),
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', color: '#64748b',
                    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <div style={{
                      width: '14px', height: '14px', border: '2px solid rgba(45,212,212,0.3)',
                      borderTopColor: accentColor, borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid rgba(45,212,212,0.1)',
              display: 'flex', gap: '8px',
            }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about this molecule..."
                style={{
                  flex: 1, background: '#081214', border: '1px solid rgba(45,212,212,0.15)',
                  borderRadius: '8px', padding: '10px 14px', color: '#fff',
                  fontSize: '13px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                }}
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '40px', height: '40px', borderRadius: '8px',
                  border: 'none', cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  background: chatLoading || !chatInput.trim() ? 'rgba(45,212,212,0.1)' : accentColor,
                  color: chatLoading || !chatInput.trim() ? '#64748b' : '#000',
                  transition: 'all 0.2s',
                }}
              >
                {Icons.send}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spin animation keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
