import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import KetcherEditor from './KetcherEditor'
import Viewer3D from './Viewer3D'
import api from '../lib/apiClient'
import { computeProperties } from '../lib/chemistry'
import { experimentService } from '../lib/experimentService'

/* ═══════════════════════════════════════════
   CONSTANTS & STYLES
   ═══════════════════════════════════════════ */
const accentColor = '#2dd4d4'
const cardStyle = {
  background: '#0d1a1c',
  border: '1px solid rgba(45,212,212,0.12)',
  borderRadius: '8px',
  padding: '16px',
}

/* ═══════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════ */
const Icons = {
  info:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  download:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  report:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  save:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  arrow:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  plus:      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  swap:      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="16 7 21 12 16 17"/><line x1="21" y1="12" x2="3" y2="12"/><polyline points="8 7 3 12 8 17"/></svg>,
  pencil:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  smiles:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  history:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  weight:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/></svg>,
  formula:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  logp:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  hbond:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  propComp:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  structComp:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>,
  simScore:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  activity:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>,
  zoomIn:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  expand:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  chevDown:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
}

/* ═══════════════════════════════════════════
   HELPER: Parse molecular formula into subscripted HTML
   ═══════════════════════════════════════════ */
function formulaToHtml(formula) {
  if (!formula || formula === '-') return '-'
  return formula.replace(/(\d+)/g, '<sub>$1</sub>')
}

/* ═══════════════════════════════════════════
   HELPER: Generate SVG from SMILES using RDKit
   ═══════════════════════════════════════════ */
function generateSvg(rdkit, smiles, w = 300, h = 250) {
  if (!rdkit || !smiles) return ''
  let mol = null
  try {
    mol = rdkit.get_mol(smiles)
    if (!mol || !mol.is_valid()) return ''
    let svg = mol.get_svg(w, h)
    svg = svg.replace(/<rect[^>]*fill=['"]#FFFFFF['"][^>]*>/i, '<rect opacity="0" fill="none" />')
    svg = svg.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
    return svg
  } catch (e) {
    return ''
  } finally {
    if (mol) mol.delete()
  }
}

/* ═══════════════════════════════════════════
   HELPER: Count atoms by element from SMILES
   (reused from ModificationTab pattern)
   ═══════════════════════════════════════════ */
function getAtomCounts(rdkit, smiles) {
  if (!rdkit || !smiles) return {}
  let mol = null
  try {
    mol = rdkit.get_mol(smiles)
    if (!mol || !mol.is_valid()) return {}
    const molBlockWithHs = mol.add_hs()
    const molBlock = molBlockWithHs || mol.get_molblock()
    const lines = molBlock.split('\n')
    const countLine = lines[3]
    const parts = countLine.trim().split(/\s+/)
    const numAtoms = parseInt(parts[0])
    const numBonds = parseInt(parts[1])
    const atomMap = {}
    for (let i = 0; i < numAtoms; i++) {
      const atomLine = lines[4 + i]
      if (atomLine) {
        const atomParts = atomLine.trim().split(/\s+/)
        const symbol = atomParts[3]
        if (symbol) atomMap[symbol] = (atomMap[symbol] || 0) + 1
      }
    }
    return { atoms: atomMap, numBonds, numAtoms }
  } catch (e) {
    return {}
  } finally {
    if (mol) mol.delete()
  }
}

/* ═══════════════════════════════════════════
   HELPER: Get ring count from descriptors
   ═══════════════════════════════════════════ */
function getRingCount(rdkit, smiles) {
  if (!rdkit || !smiles) return 0
  let mol = null
  try {
    mol = rdkit.get_mol(smiles)
    if (!mol || !mol.is_valid()) return 0
    const descStr = mol.get_descriptors()
    if (!descStr) return 0
    const desc = JSON.parse(descStr)
    return desc.NumRings ?? desc.numRings ?? 0
  } catch (e) {
    return 0
  } finally {
    if (mol) mol.delete()
  }
}

/* ═══════════════════════════════════════════
   HELPER: Compute Tanimoto similarity client-side via RDKit
   ═══════════════════════════════════════════ */
function computeTanimoto(rdkit, smilesA, smilesB) {
  if (!rdkit || !smilesA || !smilesB) return null
  let molA = null, molB = null
  try {
    molA = rdkit.get_mol(smilesA)
    molB = rdkit.get_mol(smilesB)
    if (!molA || !molA.is_valid() || !molB || !molB.is_valid()) return null
    // In RDKit.js, get_morgan_fp takes a JSON string or nothing, and returns a string (often bit vector or base64)
    // To be safe, we can use get_morgan_fp_as_uint8array if available, or just a simple exact match fallback if it fails.
    // However, since we might not have the correct RDKit.js API, let's just return a placeholder or do a safe calculation if possible.
    // For now, let's use the simplest RDKit.js morgan_fp JSON API:
    const fpA = molA.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 }))
    const fpB = molB.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 }))
    if (!fpA || !fpB) return null
    
    // In many RDKit.js versions, this returns a string of 1s and 0s or a base64 string.
    // If it's 1s and 0s:
    if (fpA.length > 0 && (fpA[0] === '0' || fpA[0] === '1') && fpA.length === fpB.length) {
      let intersection = 0, union = 0
      for (let i = 0; i < fpA.length; i++) {
        if (fpA[i] === '1' || fpB[i] === '1') union++
        if (fpA[i] === '1' && fpB[i] === '1') intersection++
      }
      return union === 0 ? 0 : intersection / union
    }
    
    // Fallback if not a simple bit string
    return null
  } catch (e) {
    return null
  } finally {
    if (molA) molA.delete()
    if (molB) molB.delete()
  }
}

/* ═══════════════════════════════════════════
   TOOLTIP WRAPPER
   ═══════════════════════════════════════════ */
function Tooltip({ text, children }) {
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', color: '#64748b', cursor: 'help' }}
      onMouseEnter={e => e.currentTarget.lastChild.style.opacity = '1'}
      onMouseLeave={e => e.currentTarget.lastChild.style.opacity = '0'}
    >
      {children}
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px',
        background: '#1e293b', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '12px',
        whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', zIndex: 100,
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontWeight: 400,
      }}>
        {text}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CIRCULAR GAUGE — Tanimoto score
   ═══════════════════════════════════════════ */
function SimilarityGauge({ score, size = 80 }) {
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const hasScore = score !== null && score !== undefined
  const percent = hasScore ? score : 0
  const offset = circumference - percent * circumference

  const color = !hasScore ? '#334155'
    : percent >= 0.7 ? '#4ade80'
    : percent >= 0.4 ? '#f59e0b'
    : '#f87171'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size > 100 ? '22px' : '14px', fontWeight: 700, color: hasScore ? color : '#475569',
        fontFamily: 'monospace',
      }}>
        {hasScore ? (percent * 100).toFixed(0) + '%' : 'N/A'}
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function CompareTab({
  isActive,
  rdkit,
  canonicalSmiles,
  currentMolecule,
  onSaveExperiment,
  onGenerateReport,
  logActivity,
}) {
  /* ── Molecule A state ── */
  const [molASource, setMolASource] = useState(() => localStorage.getItem('rogveda_compare_mola_source') || 'original')
  const [molASmiles, setMolASmiles] = useState('')
  const [molAViewMode, setMolAViewMode] = useState('2d')
  const [molASdfBlock, setMolASdfBlock] = useState('')
  const [molASdfLoading, setMolASdfLoading] = useState(false)
  const molASdfRef = useRef('')

  /* ── Molecule B state ── */
  const [molBSmiles, setMolBSmiles] = useState('')
  const [molBInputMode, setMolBInputMode] = useState('SMILES') // 'Draw' | 'SMILES' | 'From History'
  const [molBSmilesInput, setMolBSmilesInput] = useState('')
  const [molBViewMode, setMolBViewMode] = useState('2d')
  const [molBSdfBlock, setMolBSdfBlock] = useState('')
  const [molBSdfLoading, setMolBSdfLoading] = useState(false)
  const molBSdfRef = useRef('')
  const molBKetcherRef = useRef(null)
  const [molBKetcherReady, setMolBKetcherReady] = useState(false)
  const [molBKetcherTheme, setMolBKetcherTheme] = useState('light')

  /* ── Sub-nav ── */
  const [activeSubNav, setActiveSubNav] = useState('property')

  /* ── Predictions ── */
  const [predA, setPredA] = useState(null)
  const [predB, setPredB] = useState(null)
  const [isComparing, setIsComparing] = useState(false)
  const [predALoading, setPredALoading] = useState(false)
  const [predBLoading, setPredBLoading] = useState(false)

  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        if (molBKetcherRef.current && typeof molBKetcherRef.current.forceResize === 'function') {
          molBKetcherRef.current.forceResize()
          setTimeout(() => {
            const k = molBKetcherRef.current.getKetcherInstance()
            if (k) {
              if (typeof k.setZoom === 'function') k.setZoom(1)
              if (k.editor && typeof k.editor.centerStruct === 'function') k.editor.centerStruct()
            }
          }, 50)
        }
      }, 150)
    }
  }, [isActive])

  const predARef = useRef('')
  const predBRef = useRef('')

  /* ── Report format ── */
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')

  /* ── Build Molecule A source options from real workspace state ── */
  const molAOptions = useMemo(() => {
    const options = []
    if (canonicalSmiles) {
      options.push({ id: 'original', label: 'Original molecule', smiles: canonicalSmiles })
    }
    // Pull modification history for this molecule
    try {
      const storedDict = JSON.parse(localStorage.getItem('rogveda_mod_history') || '{}')
      if (canonicalSmiles && storedDict[canonicalSmiles]) {
        const hist = storedDict[canonicalSmiles].history || []
        if (hist.length > 0) {
          const lastEntry = hist[hist.length - 1]
          if (lastEntry.smiles && lastEntry.smiles !== canonicalSmiles) {
            options.push({
              id: 'modified',
              label: 'Current molecule (after modification)',
              smiles: lastEntry.smiles,
            })
          }
          // Also add intermediate modification history entries
          hist.forEach((entry, i) => {
            if (i < hist.length - 1 && entry.smiles !== canonicalSmiles) {
              options.push({
                id: `mod_${i}`,
                label: `Modification #${i + 1} (${entry.timestamp || ''})`,
                smiles: entry.smiles,
              })
            }
          })
        }
      }
    } catch (e) { /* ignore */ }
    return options
  }, [canonicalSmiles])

  /* ── Resolve Molecule A SMILES whenever source changes ── */
  useEffect(() => {
    const opt = molAOptions.find(o => o.id === molASource)
    if (opt) {
      setMolASmiles(opt.smiles)
    } else if (molAOptions.length > 0) {
      setMolASource(molAOptions[0].id)
      setMolASmiles(molAOptions[0].smiles)
    } else {
      setMolASmiles('')
    }
  }, [molASource, molAOptions])

  /* ── Compute properties ── */
  const propsA = useMemo(() => {
    if (!rdkit || !molASmiles) return null
    return computeProperties(rdkit, molASmiles)
  }, [rdkit, molASmiles])

  const propsB = useMemo(() => {
    if (!rdkit || !molBSmiles) return null
    return computeProperties(rdkit, molBSmiles)
  }, [rdkit, molBSmiles])

  /* ── Tanimoto ── */
  const tanimoto = useMemo(() => {
    return computeTanimoto(rdkit, molASmiles, molBSmiles)
  }, [rdkit, molASmiles, molBSmiles])

  /* ── SVGs ── */
  const svgA = useMemo(() => generateSvg(rdkit, molASmiles, 300, 250), [rdkit, molASmiles])
  const svgB = useMemo(() => generateSvg(rdkit, molBSmiles, 300, 250), [rdkit, molBSmiles])

  /* ── 3D for Molecule A ── */
  const handleA3D = useCallback(async () => {
    if (!molASmiles) return
    if (molAViewMode === '3d') { setMolAViewMode('2d'); return }
    if (molASdfRef.current === molASmiles && molASdfBlock) { setMolAViewMode('3d'); return }
    setMolASdfLoading(true)
    try {
      const resp = await api.post('/api/molecule/3d', { smiles: molASmiles })
      setMolASdfBlock(resp.sdf_block)
      molASdfRef.current = molASmiles
      setMolAViewMode('3d')
    } catch (e) { console.error('3D failed for A:', e) }
    finally { setMolASdfLoading(false) }
  }, [molASmiles, molAViewMode, molASdfBlock])

  /* ── 3D for Molecule B ── */
  const handleB3D = useCallback(async () => {
    if (!molBSmiles) return
    if (molBViewMode === '3d') { setMolBViewMode('2d'); return }
    if (molBSdfRef.current === molBSmiles && molBSdfBlock) { setMolBViewMode('3d'); return }
    setMolBSdfLoading(true)
    try {
      const resp = await api.post('/api/molecule/3d', { smiles: molBSmiles })
      setMolBSdfBlock(resp.sdf_block)
      molBSdfRef.current = molBSmiles
      setMolBViewMode('3d')
    } catch (e) { console.error('3D failed for B:', e) }
    finally { setMolBSdfLoading(false) }
  }, [molBSmiles, molBViewMode, molBSdfBlock])

  /* ── Load Molecule B from SMILES input ── */
  const handleLoadBSmiles = useCallback(() => {
    if (!molBSmilesInput.trim()) return
    if (rdkit) {
      let mol = null
      try {
        mol = rdkit.get_mol(molBSmilesInput.trim())
        if (!mol || !mol.is_valid()) return
        const canonical = mol.get_smiles()
        setMolBSmiles(canonical)
        logActivity?.('Compare: loaded Molecule B from SMILES')
      } catch (e) { /* ignore */ }
      finally { if (mol) mol.delete() }
    }
  }, [molBSmilesInput, rdkit, logActivity])

  /* ── Poll Molecule B's Ketcher editor (Draw mode) ── */
  useEffect(() => {
    if (molBInputMode !== 'Draw' || !rdkit || !molBKetcherReady || !molBKetcherRef.current) return
    let isPolling = true
    let lastSmiles = ''
    const poll = async () => {
      if (!isPolling) return
      try {
        const molfile = await molBKetcherRef.current.getMolfile()
        if (!molfile || molfile.length < 50) { if (lastSmiles) { lastSmiles = ''; setMolBSmiles('') } return }
        const mol = rdkit.get_mol(molfile)
        if (!mol || !mol.is_valid()) { if (mol) mol.delete(); return }
        const smiles = mol.get_smiles()
        mol.delete()
        if (!smiles || smiles === lastSmiles) return
        lastSmiles = smiles
        setMolBSmiles(smiles)
      } catch (e) { /* ignore */ }
      finally { if (isPolling) setTimeout(poll, 800) }
    }
    poll()
    return () => { isPolling = false }
  }, [rdkit, molBKetcherReady, molBInputMode])

  /* ── Sync SMILES to Ketcher when entering Draw mode ── */
  useEffect(() => {
    if (molBInputMode === 'Draw' && molBKetcherReady && molBKetcherRef.current && molBSmiles) {
      const t = setTimeout(() => {
        if (molBKetcherRef.current) {
          molBKetcherRef.current.setMolecule(molBSmiles).catch(() => {})
        }
      }, 500)
      return () => clearTimeout(t)
    }
  }, [molBInputMode, molBKetcherReady])

  /* ── Fetch hERG predictions ── */
  useEffect(() => {
    if (!molASmiles || predARef.current === molASmiles) return
    predARef.current = molASmiles
    setPredALoading(true)
    api.post('/api/molecule/predict', { smiles: molASmiles })
      .then(data => setPredA(data))
      .catch(() => setPredA(null))
      .finally(() => setPredALoading(false))
  }, [molASmiles])

  useEffect(() => {
    if (!molBSmiles || predBRef.current === molBSmiles) return
    predBRef.current = molBSmiles
    setPredBLoading(true)
    api.post('/api/molecule/predict', { smiles: molBSmiles })
      .then(data => setPredB(data))
      .catch(() => setPredB(null))
      .finally(() => setPredBLoading(false))
  }, [molBSmiles])

  /* ══════════════════════════════════════════════════
     SWAP A ↔ B
     ASSUMPTION: The cyan double-arrow icon between the two panels
     is intended as a functional "Swap A and B" button. If the design
     intent is purely decorative, remove this handler and the onClick.
     ══════════════════════════════════════════════════ */
  const handleSwap = useCallback(() => {
    const prevASmiles = molASmiles
    const prevBSmiles = molBSmiles
    // Move B → A (find or create a source option)
    if (prevBSmiles) {
      // Add B as a custom option to A's dropdown
      setMolASource('__custom__')
      setMolASmiles(prevBSmiles)
    } else {
      setMolASmiles('')
    }
    // Move A → B
    setMolBSmiles(prevASmiles)
    setMolBSmilesInput(prevASmiles)
    setMolBInputMode('SMILES')
    // Reset 3D views
    setMolAViewMode('2d')
    setMolBViewMode('2d')
    logActivity?.('Compare: swapped Molecule A and B')
  }, [molASmiles, molBSmiles, logActivity])

  /* ── Structural changes diff (reusing ModificationTab pattern) ── */
  const structuralChanges = useMemo(() => {
    if (!rdkit || !molASmiles || !molBSmiles) return []
    const dataA = getAtomCounts(rdkit, molASmiles)
    const dataB = getAtomCounts(rdkit, molBSmiles)
    if (!dataA.atoms || !dataB.atoms) return []
    const changes = []
    const allElements = new Set([...Object.keys(dataA.atoms), ...Object.keys(dataB.atoms)])
    const sorted = [...allElements].sort((a, b) => {
      if (a === 'C') return -1; if (b === 'C') return 1
      if (a === 'H') return -1; if (b === 'H') return 1
      return a.localeCompare(b)
    })
    for (const el of sorted) {
      const o = dataA.atoms[el] || 0
      const m = dataB.atoms[el] || 0
      if (o !== m) {
        const diff = m - o
        changes.push({ type: diff > 0 ? 'added' : 'removed', text: `${diff > 0 ? '+' : ''}${diff} ${el} atom${Math.abs(diff) > 1 ? 's' : ''}` })
      }
    }
    if (dataA.numBonds !== undefined && dataB.numBonds !== undefined) {
      const bondDiff = dataB.numBonds - dataA.numBonds
      if (bondDiff !== 0) {
        changes.push({ type: bondDiff > 0 ? 'added' : 'removed', text: `${bondDiff > 0 ? '+' : ''}${bondDiff} bond${Math.abs(bondDiff) > 1 ? 's' : ''}` })
      }
    }
    const ringsA = getRingCount(rdkit, molASmiles)
    const ringsB = getRingCount(rdkit, molBSmiles)
    if (ringsA !== ringsB) {
      changes.push({ type: ringsB > ringsA ? 'added' : 'removed', text: `Ring count: ${ringsA} → ${ringsB}` })
    } else {
      changes.push({ type: 'unchanged', text: `Ring count unchanged (${ringsA})` })
    }
    if (dataA.numAtoms !== undefined && dataB.numAtoms !== undefined) {
      const totalDiff = dataB.numAtoms - dataA.numAtoms
      if (totalDiff !== 0) {
        changes.push({ type: totalDiff > 0 ? 'added' : 'removed', text: `Total atoms: ${dataA.numAtoms} → ${dataB.numAtoms} (${totalDiff > 0 ? '+' : ''}${totalDiff})` })
      }
    }
    return changes
  }, [rdkit, molASmiles, molBSmiles])

  /* ── Key Differences text ── */
  const keyDifferences = useMemo(() => {
    if (!propsA || !propsB) return []
    const diffs = []
    const logpA = parseFloat(propsA.logP), logpB = parseFloat(propsB.logP)
    if (!isNaN(logpA) && !isNaN(logpB) && Math.abs(logpA - logpB) > 0.01) {
      diffs.push(`LogP differs by ${Math.abs(logpA - logpB).toFixed(2)}`)
    }
    const mwA = parseFloat(propsA.mw), mwB = parseFloat(propsB.mw)
    if (!isNaN(mwA) && !isNaN(mwB) && Math.abs(mwA - mwB) > 0.01) {
      diffs.push(`Molecular weight differs by ${Math.abs(mwA - mwB).toFixed(2)} g/mol`)
    }
    if (propsA.formula !== propsB.formula && propsA.formula !== '-' && propsB.formula !== '-') {
      diffs.push(`Formula differs: ${propsA.formula} vs ${propsB.formula}`)
    }
    const hbdA = parseInt(propsA.hbd), hbdB = parseInt(propsB.hbd)
    if (!isNaN(hbdA) && !isNaN(hbdB) && hbdA !== hbdB) {
      diffs.push(`H-Bond Donors: ${hbdA} vs ${hbdB} (Δ = ${hbdB - hbdA > 0 ? '+' : ''}${hbdB - hbdA})`)
    }
    const hbaA = parseInt(propsA.hba), hbaB = parseInt(propsB.hba)
    if (!isNaN(hbaA) && !isNaN(hbaB) && hbaA !== hbaB) {
      diffs.push(`H-Bond Acceptors: ${hbaA} vs ${hbaB} (Δ = ${hbaB - hbaA > 0 ? '+' : ''}${hbaB - hbaA})`)
    }
    return diffs
  }, [propsA, propsB])

  /* ── Experiment history for "From History" mode ── */
  const experimentHistory = useMemo(() => {
    const list = []
    try {
      // 1. Saved Experiments
      const exps = experimentService.getLocalExperiments()
      exps.forEach(exp => {
        list.push({ id: exp.id, name: exp.name || 'Saved Experiment', molfile: exp.molfile, date: exp.date, type: 'Experiment' })
      })
      // 2. Modification History
      const mods = JSON.parse(localStorage.getItem('rogveda_mod_history') || '{}')
      Object.entries(mods).forEach(([baseSmiles, data]) => {
        if (data.history && Array.isArray(data.history)) {
          data.history.forEach((h, i) => {
            if (h.smiles) {
              list.push({
                id: `mod_${baseSmiles.substring(0, 10)}_${i}`,
                name: `Modification ${i + 1}`,
                smiles: h.smiles,
                date: h.timestamp || new Date().toISOString(),
                type: 'Modification'
              })
            }
          })
        }
      })
      // Sort by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch (e) { console.error('Error parsing history:', e) }

    // 3. Compare History
    try {
      const cmp = JSON.parse(localStorage.getItem('rogveda_compare_history') || '[]')
      cmp.forEach((h, i) => {
        // avoid duplicates
        if (!list.find(item => item.smiles === h.smiles)) {
          list.push({
            id: `cmp_${i}`,
            name: `Compared Molecule`,
            smiles: h.smiles,
            date: h.timestamp || new Date().toISOString(),
            type: 'Comparison'
          })
        }
      })
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch (e) { /* ignore */ }

    return list
  }, [molBInputMode]) // re-read when user switches to From History

  /* ── No molecule loaded guard ── */
  if (!canonicalSmiles) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid rgba(45,212,212,0.1)', background: '#0d1a1c', height: '650px' }}>
        <div style={{ textAlign: 'center' }}>
          <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: accentColor, opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/><path d="M13 2h4a2 2 0 0 1 2 2v4"/><path d="M2 13v4a2 2 0 0 0 2 2h4"/></svg>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d1d5db', marginBottom: '4px' }}>No Molecule Loaded</h2>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px' }}>
            Please draw or load a molecule on the <span style={{ color: accentColor }}>Draw</span> tab first, then return here to compare.
          </p>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  const subNavItems = [
    { id: 'property', label: 'Property Comparison', icon: Icons.propComp },
    { id: 'structural', label: 'Structural Comparison', icon: Icons.structComp },
    { id: 'similarity', label: 'Similarity Score', icon: Icons.simScore },
    { id: 'activity', label: 'Activity Prediction', icon: Icons.activity },
  ]

  const hasMolB = !!molBSmiles

  return (
    <>
      {/* ── TOP ROW: Two panels + swap button ── */}
      <div style={{ display: 'flex', gap: '0px', marginBottom: '16px', alignItems: 'stretch', position: 'relative' }}>

        {/* ── LEFT PANEL: Molecule A (From Workspace) ── */}
        <div style={{ flex: 1, ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
              Molecule A <span style={{ color: '#94a3b8', fontWeight: 400 }}>(From Workspace)</span>
            </h3>
            <Tooltip text="Molecule A is sourced from your current workspace molecule or modification history">{Icons.info}</Tooltip>
          </div>

          {/* Source dropdown + 2D/3D toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            {/* Dropdown */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <select
                value={molASource}
                onChange={e => setMolASource(e.target.value)}
                style={{
                  width: '100%', background: '#081214', border: '1px solid rgba(45,212,212,0.15)', color: '#e2e8f0',
                  fontSize: '13px', borderRadius: '6px', padding: '8px 32px 8px 12px', outline: 'none', appearance: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                }}
              >
                {molAOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
                {molASource === '__custom__' && (
                  <option value="__custom__">Custom (swapped)</option>
                )}
              </select>
            </div>

            {/* 2D / 3D toggle */}
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d' }}>
              <button onClick={() => setMolAViewMode('2d')} style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                ...(molAViewMode === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}>2D View</button>
              <button onClick={handleA3D} disabled={molASdfLoading} style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: molASdfLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif', opacity: molASdfLoading ? 0.5 : 1,
                ...(molAViewMode === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}>{molASdfLoading ? '...' : '3D View'}</button>
            </div>
          </div>

          {/* Canvas area */}
          <div style={{
            flex: 1, minHeight: '350px', background: '#081214', borderRadius: '6px',
            border: '1px solid rgba(45,212,212,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            {molAViewMode === '3d' && molASdfBlock ? (
              <Viewer3D sdfBlock={molASdfBlock} height="100%" />
            ) : (
              svgA ? (
                <div
                  dangerouslySetInnerHTML={{ __html: svgA }}
                  style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                  }}
                />
              ) : (
                <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>No structure</span>
              )
            )}
          </div>
        </div>

        {/* ── SWAP BUTTON ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 8px', zIndex: 10,
        }}>
          <button
            onClick={handleSwap}
            title="Swap Molecule A and B"
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(45,212,212,0.1)', border: '1px solid rgba(45,212,212,0.25)',
              color: accentColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.2)'; e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            {Icons.swap}
          </button>
        </div>

        {/* ── RIGHT PANEL: Molecule B (From your Input) ── */}
        <div style={{ flex: 1, ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Molecule B <span style={{ color: '#94a3b8', fontWeight: 400 }}>(From your Input)</span>
              </h3>
              <Tooltip text="Add a second molecule to compare against Molecule A">{Icons.info}</Tooltip>
            </div>

            {/* Mode buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'Draw', icon: Icons.pencil },
                { id: 'SMILES', icon: Icons.smiles },
                { id: 'From History', icon: Icons.history },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => {
                    if (molBInputMode === mode.id && mode.id === 'From History') {
                      setMolBInputMode('SMILES')
                    } else {
                      setMolBInputMode(mode.id)
                    }
                  }}
                  style={{
                    padding: '5px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                    border: '1px solid rgba(45,212,212,0.15)', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    ...(molBInputMode === mode.id
                      ? { background: accentColor, color: '#000', borderColor: accentColor }
                      : { background: 'transparent', color: '#94a3b8' })
                  }}
                >
                  {mode.icon} {mode.id}
                </button>
              ))}
            </div>
          </div>

          {/* SMILES input bar (shown in SMILES mode) */}
          {molBInputMode === 'SMILES' && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={molBSmilesInput}
                onChange={e => setMolBSmilesInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoadBSmiles()}
                placeholder="Enter SMILES (e.g. CC(C)Cc1ccc(cc1)C(C)C(=O)O)"
                style={{
                  flex: 1, background: '#081214', border: '1px solid rgba(45,212,212,0.15)',
                  color: '#e2e8f0', fontSize: '13px', borderRadius: '6px', padding: '8px 12px',
                  outline: 'none', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleLoadBSmiles}
                style={{
                  padding: '8px 16px', fontWeight: 600, fontSize: '13px', borderRadius: '6px',
                  border: 'none', cursor: 'pointer', background: accentColor, color: '#000',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >Load</button>
            </div>
          )}

          {/* From History list */}
          {molBInputMode === 'From History' && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {experimentHistory.length === 0 ? (
                <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '8px' }}>No saved experiments found.</span>
              ) : experimentHistory.map(exp => (
                <div
                  key={exp.id}
                  onClick={() => {
                    if (exp.smiles) {
                      setMolBSmiles(exp.smiles)
                      logActivity?.('Compare: loaded Molecule B from modification history')
                    } else if (exp.molfile && rdkit) {
                      let mol = null
                      try {
                        mol = rdkit.get_mol(exp.molfile)
                        if (mol && mol.is_valid()) {
                          setMolBSmiles(mol.get_smiles())
                          logActivity?.('Compare: loaded Molecule B from experiment history')
                        }
                      } catch (e) { /* ignore */ }
                      finally { if (mol) mol.delete() }
                    }
                  }}
                  style={{
                    padding: '8px 12px', background: 'rgba(45,212,212,0.05)', border: '1px solid rgba(45,212,212,0.12)',
                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,212,0.05)'}
                >
                  <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
                    {exp.name} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>({exp.type})</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Last modified: {new Date(exp.date).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Canvas / Empty state */}
          <div style={{
            flex: 1, minHeight: '350px', background: '#081214', borderRadius: '6px',
            border: hasMolB ? '1px solid rgba(45,212,212,0.08)' : '2px dashed rgba(45,212,212,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            {molBInputMode === 'Draw' ? (
              /* Ketcher editor for Draw mode */
              <div style={{ position: 'absolute', inset: 0 }}>
                <KetcherEditor ref={molBKetcherRef} theme={molBKetcherTheme} onLoad={() => setMolBKetcherReady(true)} />
                {/* Light/Dark theme toggle */}
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#050b0d', borderRadius: '8px', border: '1px solid rgba(45,212,212,0.15)', zIndex: 10 }}>
                  <span style={{ color: molBKetcherTheme === 'light' ? '#f59e0b' : '#64748b', transition: 'color 0.2s', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  </span>
                  <div
                    onClick={() => setMolBKetcherTheme(t => t === 'dark' ? 'light' : 'dark')}
                    style={{
                      width: '32px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer',
                      background: molBKetcherTheme === 'dark' ? '#0a1618' : '#cbd5e1',
                      border: molBKetcherTheme === 'dark' ? '2px solid #00bfa5' : '2px solid #cbd5e1',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '1px', width: '12px', height: '12px', borderRadius: '50%',
                      background: molBKetcherTheme === 'dark' ? '#00bfa5' : '#fff',
                      boxShadow: molBKetcherTheme === 'light' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                      left: molBKetcherTheme === 'dark' ? '14px' : '2px', transition: 'all 0.2s'
                    }} />
                  </div>
                  <span style={{ color: molBKetcherTheme === 'dark' ? '#00bfa5' : '#64748b', transition: 'color 0.2s', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  </span>
                </div>
              </div>
            ) : hasMolB ? (
              /* Show molecule B structure */
              molBViewMode === '3d' && molBSdfBlock ? (
                <Viewer3D sdfBlock={molBSdfBlock} height="100%" />
              ) : (
                svgB ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: svgB }}
                    style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '16px', filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                    }}
                  />
                ) : (
                  <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Processing...</span>
                )
              )
            ) : (
              /* Empty state */
              <div style={{ textAlign: 'center', color: '#475569' }}>
                <div style={{ color: 'rgba(45,212,212,0.3)', marginBottom: '12px' }}>{Icons.plus}</div>
                <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.6, maxWidth: '280px' }}>
                  Draw, paste SMILES or select from experiment history to add your molecule.
                </p>
              </div>
            )}

            {/* 2D/3D toggle for Molecule B (only when populated and not in Draw mode) */}
            {hasMolB && molBInputMode !== 'Draw' && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d' }}>
                <button onClick={() => setMolBViewMode('2d')} style={{
                  padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px',
                  transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                  ...(molBViewMode === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
                }}>2D</button>
                <button onClick={handleB3D} disabled={molBSdfLoading} style={{
                  padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: molBSdfLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
                  transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif', opacity: molBSdfLoading ? 0.5 : 1,
                  ...(molBViewMode === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
                }}>{molBSdfLoading ? '...' : '3D'}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display: 'flex', gap: '16px' }}>

        {/* ── LEFT: Sub-nav ── */}
        <div style={{ flex: '0 0 15%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {subNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSubNav(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', fontSize: '13px', fontWeight: 500,
                border: activeSubNav === item.id ? '1px solid rgba(45,212,212,0.3)' : '1px solid rgba(45,212,212,0.08)',
                borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
                background: activeSubNav === item.id ? 'rgba(45,212,212,0.08)' : '#0d1a1c',
                color: activeSubNav === item.id ? accentColor : '#94a3b8',
              }}
              onMouseEnter={e => { if (activeSubNav !== item.id) e.currentTarget.style.background = 'rgba(45,212,212,0.04)' }}
              onMouseLeave={e => { if (activeSubNav !== item.id) e.currentTarget.style.background = '#0d1a1c' }}
            >
              <span style={{ display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* ── MIDDLE: Comparison Results ── */}
        <div style={{ flex: '6', ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: accentColor }}>Comparison Results</h3>
            <Tooltip text="Side-by-side comparison of molecular properties">{Icons.info}</Tooltip>
          </div>

          {/* ═══ Property Comparison ═══ */}
          {activeSubNav === 'property' && (
            <div>
              {/* Stat cards row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Molecular Weight', icon: Icons.weight, valA: propsA?.mw && propsA.mw !== '-' ? `${propsA.mw} g/mol` : '-', valB: propsB?.mw && propsB.mw !== '-' ? `${propsB.mw} g/mol` : '-' },
                  { label: 'Molecular Formula', icon: Icons.formula, valA: propsA?.formula || '-', valB: propsB?.formula || '-', isFormula: true },
                  { label: 'LogP', icon: Icons.logp, valA: propsA?.logP || '-', valB: propsB?.logP || '-' },
                  { label: 'H-Bond Donors', icon: Icons.hbond, valA: propsA?.hbd || '-', valB: propsB?.hbd || '-' },
                  { label: 'H-Bond Acceptors', icon: Icons.hbond, valA: propsA?.hba || '-', valB: propsB?.hba || '-' },
                ].map((stat, i) => (
                  <div key={i} style={{
                    flex: '1 1 150px', background: '#081214', border: '1px solid rgba(45,212,212,0.08)',
                    borderRadius: '8px', padding: '14px', textAlign: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ color: '#64748b', display: 'flex' }}>{stat.icon}</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>{stat.label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <div>
                        {stat.isFormula ? (
                          <div dangerouslySetInnerHTML={{ __html: formulaToHtml(stat.valA) }} style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }} />
                        ) : (
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{stat.valA}</div>
                        )}
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Molecule A</div>
                      </div>
                      <div>
                        {stat.isFormula ? (
                          <div dangerouslySetInnerHTML={{ __html: formulaToHtml(stat.valB) }} style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }} />
                        ) : (
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{stat.valB}</div>
                        )}
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Molecule B</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Structural Similarity section */}
              <div style={{ borderTop: '1px solid rgba(45,212,212,0.08)', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: accentColor }}>
                  Structural Similarity
                  <span style={{ marginLeft: '8px' }}><Tooltip text="Tanimoto coefficient computed from Morgan fingerprints (radius=2, 2048 bits)">{Icons.info}</Tooltip></span>
                </h4>
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                  {/* Gauge */}
                  <div style={{ textAlign: 'center' }}>
                    <SimilarityGauge score={tanimoto} size={80} />
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginTop: '8px' }}>Similarity Score</div>
                    {!hasMolB && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>(Requires second molecule)</div>
                    )}
                  </div>

                  {/* Key Differences */}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>Key Differences</h4>
                    {hasMolB && keyDifferences.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {keyDifferences.map((diff, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{diff}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Molecular weight, formula and properties will be compared once the second molecule is added.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Structural similarity will be calculated based on the two molecules provided.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Structural Comparison ═══ */}
          {activeSubNav === 'structural' && (
            <div style={{ minHeight: '150px' }}>
              {!hasMolB ? (
                <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
                  Add Molecule B to see structural comparison.
                </div>
              ) : structuralChanges.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
                  No structural differences detected.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                  {structuralChanges.map((change, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: change.type === 'added' ? '#4ade80' : change.type === 'removed' ? '#f87171' : '#64748b',
                        boxShadow: change.type === 'added' ? '0 0 6px rgba(74,222,128,0.5)' : change.type === 'removed' ? '0 0 6px rgba(248,113,113,0.5)' : 'none',
                      }} />
                      <span style={{
                        color: change.type === 'added' ? '#4ade80' : change.type === 'removed' ? '#f87171' : '#94a3b8',
                        fontSize: '14px', fontWeight: 500,
                      }}>{change.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Similarity Score ═══ */}
          {activeSubNav === 'similarity' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
              <SimilarityGauge score={tanimoto} size={140} />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginTop: '16px' }}>
                Tanimoto Similarity
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                {hasMolB
                  ? `Morgan fingerprints (radius=2, 2048 bits) — Score: ${tanimoto !== null ? (tanimoto * 100).toFixed(1) + '%' : 'N/A'}`
                  : 'Add Molecule B to calculate similarity score'}
              </div>
              {hasMolB && tanimoto !== null && (
                <div style={{
                  marginTop: '16px', padding: '10px 20px', borderRadius: '8px',
                  background: tanimoto >= 0.7 ? 'rgba(74,222,128,0.1)' : tanimoto >= 0.4 ? 'rgba(245,158,11,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${tanimoto >= 0.7 ? 'rgba(74,222,128,0.2)' : tanimoto >= 0.4 ? 'rgba(245,158,11,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  fontSize: '13px', fontWeight: 500,
                  color: tanimoto >= 0.7 ? '#4ade80' : tanimoto >= 0.4 ? '#f59e0b' : '#f87171',
                }}>
                  {tanimoto >= 0.7 ? 'High similarity — molecules are structurally related'
                    : tanimoto >= 0.4 ? 'Moderate similarity — some shared structural features'
                    : 'Low similarity — molecules are structurally distinct'}
                </div>
              )}
            </div>
          )}

          {/* ═══ Activity Prediction ═══ */}
          {activeSubNav === 'activity' && (
            <div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {/* Molecule A prediction */}
                <div style={{ flex: 1, background: '#081214', border: '1px solid rgba(45,212,212,0.08)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: accentColor }}>Molecule A — hERG Prediction</h4>
                  {predALoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                      <div style={{ width: '14px', height: '14px', border: '2px solid rgba(45,212,212,0.3)', borderTop: `2px solid ${accentColor}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Loading prediction...
                    </div>
                  ) : predA ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Label:</span>
                        <span style={{ color: predA.label?.includes('active') && !predA.label?.includes('inactive') ? '#f87171' : '#4ade80', fontSize: '13px', fontWeight: 600 }}>{predA.label || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Probability:</span>
                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace' }}>{predA.probability_active !== undefined ? (predA.probability_active * 100).toFixed(1) + '%' : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Confidence:</span>
                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>{predA.confidence || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>-</span>
                  )}
                </div>

                {/* Molecule B prediction */}
                <div style={{ flex: 1, background: '#081214', border: '1px solid rgba(45,212,212,0.08)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: accentColor }}>Molecule B — hERG Prediction</h4>
                  {!hasMolB ? (
                    <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Add Molecule B to see prediction</span>
                  ) : predBLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                      <div style={{ width: '14px', height: '14px', border: '2px solid rgba(45,212,212,0.3)', borderTop: `2px solid ${accentColor}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Loading prediction...
                    </div>
                  ) : predB ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Label:</span>
                        <span style={{ color: predB.label?.includes('active') && !predB.label?.includes('inactive') ? '#f87171' : '#4ade80', fontSize: '13px', fontWeight: 600 }}>{predB.label || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Probability:</span>
                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace' }}>{predB.probability_active !== undefined ? (predB.probability_active * 100).toFixed(1) + '%' : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Confidence:</span>
                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>{predB.confidence || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Prediction unavailable</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Report Generation + Save ── */}
        <div style={{ flex: '0 0 25%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Report Generation Card */}
          <div style={{
            background: 'linear-gradient(135deg, #0d1a1c 0%, #0a1e20 100%)',
            border: '1px solid rgba(45,212,212,0.15)', borderRadius: '10px',
            padding: '20px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <h3 style={{ color: accentColor, fontWeight: 700, fontSize: '16px', margin: '0 0 4px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Report Generation
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 14px' }}>
              Generate a detailed report of your results.
            </p>

            <select
              value={reportFormat}
              onChange={e => setReportFormat(e.target.value)}
              style={{
                width: '100%', background: '#081214',
                border: '1px solid rgba(45,212,212,0.15)', color: '#e2e8f0',
                fontSize: '13px', borderRadius: '8px', padding: '10px 12px',
                marginBottom: '14px', outline: 'none', appearance: 'none', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
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
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {Icons.download}
              Generate Report
            </button>
          </div>

          {/* Save & Exit */}
          <button
            onClick={onSaveExperiment || (() => window.location.href = '/')}
            style={{
              width: '100%', padding: '16px 0', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
              fontSize: '15px', fontWeight: 600,
              background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.12)',
              color: accentColor, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0d1a1c' }}
          >
            {Icons.save}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>Save & Exit</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>Save current comparison</span>
            </div>
            {Icons.arrow}
          </button>
        </div>
      </div>

      {/* Spin animation for loading indicators */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
