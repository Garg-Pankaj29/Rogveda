import { useState, useEffect, useRef, useCallback } from 'react'
import KetcherEditor from './KetcherEditor'
import Viewer3D from './Viewer3D'
import api from '../lib/apiClient'
import { computeProperties } from '../lib/chemistry'

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
  info:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  chevLeft: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevRight:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  report:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  save:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  arrow:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  brain:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>,
  sun:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
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
function generateSvg(rdkit, smiles, w = 250, h = 200) {
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
   STAT BLOCK — MW / Formula / LogP
   ═══════════════════════════════════════════ */
function StatBlock({ label, value, isHtml = false }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500, marginBottom: '4px', letterSpacing: '0.03em' }}>{label}</div>
      {isHtml ? (
        <div
          dangerouslySetInnerHTML={{ __html: value || '-' }}
          style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}
        />
      ) : (
        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{value || '-'}</div>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function ModificationTab({
  isActive,
  rdkit,
  currentMolecule,
  canonicalSmiles,
  onSaveExperiment,
  onGenerateReport,
  logActivity,
}) {
  /* ── State ── */
  const modifyKetcherRef = useRef(null)
  const [modifyKetcherReady, setModifyKetcherReady] = useState(false)
  const [modifiedSmiles, setModifiedSmiles] = useState('')
  const [modifiedProps, setModifiedProps] = useState(null)
  const [modifiedSvg, setModifiedSvg] = useState('')

  // View toggles: 2d / 3d
  const [origView, setOrigView] = useState('2d')
  const [modView, setModView] = useState('2d')
  // 3D state for original
  const [origSdfBlock, setOrigSdfBlock] = useState('')
  const [origSdfLoading, setOrigSdfLoading] = useState(false)
  const origSdfSmiles = useRef('')
  // 3D state for modified
  const [modSdfBlock, setModSdfBlock] = useState('')
  const [modSdfLoading, setModSdfLoading] = useState(false)
  const modSdfSmiles = useRef('')

  // Edit history
  const [history, setHistory] = useState([]) // [{smiles, timestamp, props, svg}]
  const [historyIndex, setHistoryIndex] = useState(-1) // -1 = live (latest)

  // Modification Analysis sub-tabs
  const [analysisSubTab, setAnalysisSubTab] = useState('insights')

  // Insights state
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const lastInsightsSmiles = useRef('')

  // Report format
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')

  const [theme, setTheme] = useState('light')

  // Shortlist state (Phase 12)
  const [shortlistResults, setShortlistResults] = useState([])
  const [shortlistLoading, setShortlistLoading] = useState(false)
  const [shortlistError, setShortlistError] = useState('')
  const [shortlistTarget, setShortlistTarget] = useState('antiinflammatory')
  const [shortlistVisible, setShortlistVisible] = useState(false)

  // Track the original smiles we initialized the editor with
  const initializedSmiles = useRef('')
  const [activeHistorySmiles, setActiveHistorySmiles] = useState('')

  /* ── Initialize the modification editor with current molecule ── */
  useEffect(() => {
    if (!canonicalSmiles) {
      initializedSmiles.current = ''
      setActiveHistorySmiles('')
      return
    }

    if (!isActive || !modifyKetcherReady || !modifyKetcherRef.current) return
    if (initializedSmiles.current === canonicalSmiles) return
    
    initializedSmiles.current = canonicalSmiles

    const initEditor = async () => {
      try {
        let storedDict = {}
        try {
          storedDict = JSON.parse(localStorage.getItem('rogveda_mod_history') || '{}')
        } catch (err) {
          console.warn('Failed to parse rogveda_mod_history from localStorage, resetting.')
          localStorage.removeItem('rogveda_mod_history')
        }
        const savedData = storedDict[canonicalSmiles]
        
        // Use v2 to ignore previously corrupted localStorage data
        if (savedData && savedData.v === 2 && savedData.history && savedData.history.length > 0) {
          setHistory(savedData.history)
          setHistoryIndex(-1)
          setActiveHistorySmiles(canonicalSmiles)
          const lastEntry = savedData.history[savedData.history.length - 1]
          
          setModifiedSmiles(lastEntry.smiles)
          setModifiedProps(lastEntry.props)
          setModifiedSvg(lastEntry.svg)
          
          if (lastEntry.molfile) {
            await modifyKetcherRef.current.setMolecule(lastEntry.molfile)
          } else {
            await modifyKetcherRef.current.setMolecule(lastEntry.smiles)
          }

          setTimeout(() => {
            const k = modifyKetcherRef.current.getKetcherInstance()
            if (k && k.editor) k.editor.centerStruct()
          }, 500)
        } else {
          await modifyKetcherRef.current.setMolecule(canonicalSmiles)
          setHistory([])
          setHistoryIndex(-1)
          setActiveHistorySmiles(canonicalSmiles)
          setModifiedSmiles('')
          setModifiedProps(null)
          setModifiedSvg('')
          setInsights([])
          lastInsightsSmiles.current = ''
          
          setTimeout(() => {
            const k = modifyKetcherRef.current.getKetcherInstance()
            if (k && k.editor) k.editor.centerStruct()
          }, 500)
        }
      } catch (e) {
        console.error('Failed to initialize modification editor:', e)
      }
    }
    initEditor()
  }, [isActive, modifyKetcherReady, canonicalSmiles])

  // Force resize on tab activation
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        if (modifyKetcherRef.current && typeof modifyKetcherRef.current.forceResize === 'function') {
          modifyKetcherRef.current.forceResize()
          setTimeout(() => {
            const k = modifyKetcherRef.current.getKetcherInstance()
            if (k) {
              if (typeof k.setZoom === 'function') k.setZoom(1)
              if (k.editor && typeof k.editor.centerStruct === 'function') k.editor.centerStruct()
            }
          }, 50)
        }
      }, 150)
    }
  }, [isActive])

  // Save history to local storage
  useEffect(() => {
    if (canonicalSmiles && activeHistorySmiles === canonicalSmiles && history.length > 0) {
      try {
        const storedDict = JSON.parse(localStorage.getItem('rogveda_mod_history') || '{}')
        storedDict[canonicalSmiles] = {
          smiles: canonicalSmiles,
          history,
          v: 2
        }
        localStorage.setItem('rogveda_mod_history', JSON.stringify(storedDict))
      } catch (e) {
        // ignore
      }
    }
  }, [canonicalSmiles, activeHistorySmiles, history])

  /* ── Poll the modification editor for changes ── */
  useEffect(() => {
    if (!rdkit || !modifyKetcherReady || !modifyKetcherRef.current || !isActive) return
    let isPolling = true
    let lastSmiles = ''

    const poll = async () => {
      if (!isPolling) return
      try {
        const molfile = await modifyKetcherRef.current.getMolfile()
        if (!molfile || molfile.length < 50) {
          if (lastSmiles !== '') {
            lastSmiles = ''
            setModifiedSmiles('')
            setModifiedProps(null)
            setModifiedSvg('')
          }
          return
        }
        const mol = rdkit.get_mol(molfile)
        if (!mol || !mol.is_valid()) {
          if (mol) mol.delete()
          if (lastSmiles !== '') {
            lastSmiles = ''
            setModifiedSmiles('')
            setModifiedProps(null)
            setModifiedSvg('')
          }
          return
        }
        const smiles = mol.get_smiles()
        mol.delete()

        if (!smiles) {
          if (lastSmiles !== '') {
            lastSmiles = ''
            setModifiedSmiles('')
            setModifiedProps(null)
            setModifiedSvg('')
          }
          return
        }
        if (smiles === lastSmiles) return
        lastSmiles = smiles
        setModifiedSmiles(smiles)

        const props = computeProperties(rdkit, smiles)
        setModifiedProps(props)

        const svg = generateSvg(rdkit, smiles, 250, 200)
        setModifiedSvg(svg)

        setHistory(prev => {
          if (prev.length > 0 && prev[prev.length - 1].smiles === smiles) return prev
          const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
          return [...prev, { smiles, molfile, timestamp: ts, props, svg }]
        })
        setHistoryIndex(-1)

      } catch (e) {
        // Ignore polling errors silently
      } finally {
        if (isPolling) setTimeout(poll, 500)
      }
    }

    poll()
    return () => { isPolling = false }
  }, [rdkit, modifyKetcherReady, isActive])

  /* ── 3D generation for original molecule ── */
  const handleOrig3D = useCallback(async () => {
    if (!canonicalSmiles) return
    if (origView === '3d') { setOrigView('2d'); return }
    if (origSdfSmiles.current === canonicalSmiles && origSdfBlock) {
      setOrigView('3d')
      return
    }
    setOrigSdfLoading(true)
    try {
      const resp = await api.post('/api/molecule/3d', { smiles: canonicalSmiles })
      setOrigSdfBlock(resp.sdf_block)
      origSdfSmiles.current = canonicalSmiles
      setOrigView('3d')
    } catch (e) {
      console.error('3D generation failed for original:', e)
    } finally {
      setOrigSdfLoading(false)
    }
  }, [canonicalSmiles, origView, origSdfBlock])

  /* ── Determine what to display in Modified column ── */
  const isViewingHistory = historyIndex >= 0 && historyIndex < history.length
  const displayEntry = isViewingHistory ? history[historyIndex] : null
  const displaySmiles = isViewingHistory ? displayEntry.smiles : modifiedSmiles
  const displayProps = isViewingHistory ? displayEntry.props : modifiedProps
  const displaySvg = isViewingHistory ? displayEntry.svg : modifiedSvg

  /* ── 3D generation for modified molecule ── */
  const handleMod3D = useCallback(async () => {
    const smiles = displaySmiles
    if (!smiles) return
    if (modView === '3d') { setModView('2d'); return }
    if (modSdfSmiles.current === smiles && modSdfBlock) {
      setModView('3d')
      return
    }
    setModSdfLoading(true)
    try {
      const resp = await api.post('/api/molecule/3d', { smiles })
      setModSdfBlock(resp.sdf_block)
      modSdfSmiles.current = smiles
      setModView('3d')
    } catch (e) {
      console.error('3D generation failed for modified:', e)
    } finally {
      setModSdfLoading(false)
    }
  }, [displaySmiles, modView, modSdfBlock])

  /* ── History navigation ── */
  const canGoBack = history.length > 0 && (historyIndex === -1 ? true : historyIndex > 0)
  const canGoForward = isViewingHistory && historyIndex < history.length - 1

  const goBack = () => {
    if (historyIndex === -1) {
      setHistoryIndex(Math.max(0, history.length - 2))
    } else if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
    }
  }

  const goForward = () => {
    if (isViewingHistory) {
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(-1)
      } else {
        setHistoryIndex(historyIndex + 1)
      }
    }
  }

  /* ── Original molecule SVG ── */
  const originalSvg = generateSvg(rdkit, canonicalSmiles, 250, 200)

  /* ── Original molecule properties ── */
  const originalProps = currentMolecule && currentMolecule.mw && currentMolecule.mw !== '-'
    ? currentMolecule
    : (canonicalSmiles ? computeProperties(rdkit, canonicalSmiles) : null)

  /* ── Compute property deltas ── */
  const computeDeltas = useCallback(() => {
    if (!originalProps || !displayProps) return []
    const propKeys = [
      { key: 'mw', label: 'Molecular Weight', unit: ' g/mol', decimals: 2 },
      { key: 'logP', label: 'LogP (Crippen)', unit: '', decimals: 2 },
      { key: 'tpsa', label: 'TPSA', unit: ' Å²', decimals: 2 },
      { key: 'hbd', label: 'H-Bond Donors', unit: '', decimals: 0 },
      { key: 'hba', label: 'H-Bond Acceptors', unit: '', decimals: 0 },
      { key: 'rotBonds', label: 'Rotatable Bonds', unit: '', decimals: 0 },
      { key: 'aromaticRings', label: 'Aromatic Rings', unit: '', decimals: 0 },
      { key: 'heavyAtoms', label: 'Heavy Atoms', unit: '', decimals: 0 },
      { key: 'fractionCsp3', label: 'Fraction Csp³', unit: '', decimals: 2 },
      { key: 'totalRings', label: 'Total Rings', unit: '', decimals: 0 },
      { key: 'heteroAtoms', label: 'Heteroatoms', unit: '', decimals: 0 },
      { key: 'molarRefractivity', label: 'Molar Refractivity', unit: '', decimals: 2 },
    ]
    return propKeys.map(({ key, label, unit, decimals }) => {
      const orig = parseFloat(originalProps[key])
      const mod = parseFloat(displayProps[key])
      const origVal = isNaN(orig) ? '-' : orig.toFixed(decimals) + unit
      const modVal = isNaN(mod) ? '-' : mod.toFixed(decimals) + unit
      let delta = '-'
      if (!isNaN(orig) && !isNaN(mod)) {
        const d = mod - orig
        delta = (d >= 0 ? '+' : '') + d.toFixed(decimals) + unit
      }
      return { label, origVal, modVal, delta }
    })
  }, [originalProps, displayProps])

  /* ── Compute structural changes (textual diff) ── */
  // Future enhancement: render a visual highlight-diff overlay on the 2D structures
  const computeStructuralChanges = useCallback(() => {
    if (!rdkit || !canonicalSmiles || !displaySmiles) return []
    const origData = getAtomCounts(rdkit, canonicalSmiles)
    const modData = getAtomCounts(rdkit, displaySmiles)
    if (!origData.atoms || !modData.atoms) return []

    const changes = []

    const allElements = new Set([...Object.keys(origData.atoms), ...Object.keys(modData.atoms)])
    const sorted = [...allElements].sort((a, b) => {
      if (a === 'C') return -1; if (b === 'C') return 1
      if (a === 'H') return -1; if (b === 'H') return 1
      return a.localeCompare(b)
    })
    for (const el of sorted) {
      const o = origData.atoms[el] || 0
      const m = modData.atoms[el] || 0
      if (o !== m) {
        const diff = m - o
        changes.push({
          type: diff > 0 ? 'added' : 'removed',
          text: `${diff > 0 ? '+' : ''}${diff} ${el} atom${Math.abs(diff) > 1 ? 's' : ''}`,
        })
      }
    }

    if (origData.numBonds !== undefined && modData.numBonds !== undefined) {
      const bondDiff = modData.numBonds - origData.numBonds
      if (bondDiff !== 0) {
        changes.push({
          type: bondDiff > 0 ? 'added' : 'removed',
          text: `${bondDiff > 0 ? '+' : ''}${bondDiff} bond${Math.abs(bondDiff) > 1 ? 's' : ''}`,
        })
      }
    }

    const origRings = getRingCount(rdkit, canonicalSmiles)
    const modRings = getRingCount(rdkit, displaySmiles)
    if (origRings !== modRings) {
      changes.push({
        type: modRings > origRings ? 'added' : 'removed',
        text: `Ring count: ${origRings} → ${modRings}`,
      })
    } else {
      changes.push({ type: 'unchanged', text: `Ring count unchanged (${origRings})` })
    }

    if (origData.numAtoms !== undefined && modData.numAtoms !== undefined) {
      const totalDiff = modData.numAtoms - origData.numAtoms
      if (totalDiff !== 0) {
        changes.push({
          type: totalDiff > 0 ? 'added' : 'removed',
          text: `Total atoms: ${origData.numAtoms} → ${modData.numAtoms} (${totalDiff > 0 ? '+' : ''}${totalDiff})`,
        })
      }
    }

    return changes
  }, [rdkit, canonicalSmiles, displaySmiles])

  /* ── Fetch AI insights ── */
  const fetchInsights = useCallback(async () => {
    if (!originalProps || !displayProps || !displaySmiles) return
    if (displaySmiles === canonicalSmiles) {
      setInsights([])
      return
    }
    if (lastInsightsSmiles.current === displaySmiles) return
    lastInsightsSmiles.current = displaySmiles

    setInsightsLoading(true)
    setInsightsError('')

    const deltas = computeDeltas().filter(d => d.delta !== '-' && d.delta !== '+0' && d.delta !== '+0.00' && d.delta !== '+0.00 g/mol' && d.delta !== '+0.00 Å²')
    if (deltas.length === 0) {
      setInsights(['No significant property changes detected between the original and modified molecule.'])
      setInsightsLoading(false)
      return
    }

    const deltaList = deltas.map(d => `${d.label}: ${d.origVal} to ${d.modVal} (Change: ${d.delta})`).join('\n')
    const prompt = `I modified a molecule. Here are the property changes:\n${deltaList}\n\nPlease analyze these changes. Give me exactly 6 to 7 short bullet points explaining how this affects the molecule's properties. Start each bullet point with a dash (-). DO NOT include any introductory or concluding text. ONLY output the 6 to 7 bullet points, nothing else.`

    try {
      const resp = await api.post('/api/chat/', {
        system_prompt: 'You are a helpful medicinal chemistry assistant.',
        messages: [{ role: 'user', content: prompt }]
      })

      const text = resp.reply || ''

      const bullets = text
        .split('\n')
        .map(l => l.replace(/^[\s•\-\*\d.]+/, '').trim())
        .filter(l => l.length > 10)
        .slice(0, 8)

      if (bullets.length === 0) {
        if (!text.trim()) {
          setInsightsError('AI returned an empty response. Please try modifying the molecule again or check your local AI model.')
          setInsights([])
        } else {
          setInsights([text.trim()])
        }
      } else {
        setInsights(bullets)
      }
    } catch (e) {
      console.warn('LM Studio not available:', e.message)
      setInsightsError('Local AI not available — ' + e.message + '. Ensure LM Studio is running and CORS is enabled.')
      setInsights([])
    } finally {
      setInsightsLoading(false)
    }
  }, [originalProps, displayProps, displaySmiles, canonicalSmiles, computeDeltas])

  // Auto-fetch insights when the Insights tab is active and modified molecule changes
  useEffect(() => {
    if (analysisSubTab === 'insights' && displaySmiles && displaySmiles !== canonicalSmiles) {
      fetchInsights()
    }
  }, [analysisSubTab, displaySmiles, canonicalSmiles, fetchInsights])

  /* ── Fetch shortlist suggestions (Phase 12) ── */
  const fetchShortlist = useCallback(async () => {
    if (!canonicalSmiles) return
    setShortlistLoading(true)
    setShortlistError('')
    setShortlistResults([])
    setShortlistVisible(true)
    try {
      const resp = await api.post('/api/modification/shortlist', {
        smiles: canonicalSmiles,
        target_endpoint: shortlistTarget,
      })
      setShortlistResults(resp.shortlist || [])
      if (!resp.shortlist || resp.shortlist.length === 0) {
        setShortlistError('No applicable transforms found for this molecule.')
      }
    } catch (e) {
      console.error('Shortlist fetch failed:', e)
      setShortlistError(e.message || 'Failed to generate suggestions. Check that the backend is running.')
    } finally {
      setShortlistLoading(false)
    }
  }, [canonicalSmiles, shortlistTarget])

  /* ── Apply a shortlist suggestion to the editor ── */
  const applyShortlistSuggestion = useCallback(async (smiles) => {
    if (!modifyKetcherRef.current) return
    try {
      await modifyKetcherRef.current.setMolecule(smiles)
      setTimeout(() => {
        const k = modifyKetcherRef.current.getKetcherInstance()
        if (k && k.editor) k.editor.centerStruct()
      }, 300)
      logActivity?.(`Applied suggestion: ${smiles}`)
    } catch (e) {
      console.error('Failed to apply suggestion:', e)
    }
  }, [logActivity])

  /* ── Handle Modify Ketcher load ── */
  const handleModifyKetcherLoad = useCallback(() => {
    setModifyKetcherReady(true)
  }, [])

  /* ── No molecule loaded guard ── */
  if (!canonicalSmiles) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid rgba(45,212,212,0.1)', background: '#0d1a1c', height: '650px' }}>
        <div style={{ textAlign: 'center' }}>
          <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: accentColor, opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d1d5db', marginBottom: '4px' }}>No Molecule Loaded</h2>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px' }}>
            Please draw or load a molecule on the <span style={{ color: accentColor }}>Draw</span> tab first, then return here to modify it.
          </p>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  const deltas = computeDeltas()
  const structuralChanges = computeStructuralChanges()

  return (
    <>
      {/* ── TOP ROW: Three Columns ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>

        {/* ── COLUMN 1: Original Molecule ── */}
        <div style={{ flex: '3', ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>Original Molecule</h3>
            <Tooltip text="The unmodified molecule from your current workspace">{Icons.info}</Tooltip>
          </div>

          {/* 2D / 3D toggle */}
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d', marginBottom: '12px', alignSelf: 'flex-start' }}>
            <button
              onClick={() => setOrigView('2d')}
              style={{
                padding: '5px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                ...(origView === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}
            >2D View</button>
            <button
              onClick={handleOrig3D}
              disabled={origSdfLoading}
              style={{
                padding: '5px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: origSdfLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif', opacity: origSdfLoading ? 0.5 : 1,
                ...(origView === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}
            >{origSdfLoading ? '...' : '3D View'}</button>
          </div>

          {/* Structure display */}
          <div style={{
            flex: 1, minHeight: '250px', background: '#081214', borderRadius: '6px',
            border: '1px solid rgba(45,212,212,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            {origView === '3d' && origSdfBlock ? (
              <Viewer3D sdfBlock={origSdfBlock} height="100%" />
            ) : (
              originalSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: originalSvg }}
                  style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px',
                    filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                  }}
                />
              ) : (
                <span style={{ color: '#475569', fontSize: '12px', fontStyle: 'italic' }}>No structure</span>
              )
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', padding: '8px 0', borderTop: '1px solid rgba(45,212,212,0.08)' }}>
            <StatBlock label="Molecular Weight" value={originalProps?.mw && originalProps.mw !== '-' ? `${originalProps.mw} g/mol` : '-'} />
            <StatBlock label="Formula" value={formulaToHtml(originalProps?.formula)} isHtml={true} />
            <StatBlock label="LogP" value={originalProps?.logP || '-'} />
          </div>
        </div>

        {/* ── COLUMN 2: Molecular Editor ── */}
        <div style={{ flex: '4', ...cardStyle, display: 'flex', flexDirection: 'column', padding: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>Molecular Editor</h3>
              <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>(Modify the molecule directly)</span>
              <Tooltip text="Edit the molecule here — changes appear live in the Modified Molecule panel">{Icons.info}</Tooltip>
            </div>
            {/* Theme toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: theme === 'light' ? '#f59e0b' : '#64748b', display: 'flex', transition: 'color 0.2s' }}>{Icons.sun}</span>
              <div 
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                style={{ 
                  width: '40px', height: '22px', 
                  cursor: 'pointer', background: theme === 'dark' ? '#0a1618' : '#cbd5e1',
                  border: theme === 'dark' ? '2px solid #00bfa5' : '2px solid #cbd5e1',
                  borderRadius: '12px', position: 'relative', transition: 'all 0.2s' 
                }}
              >
                <div style={{ 
                  position: 'absolute', top: '1px', 
                  width: '16px', height: '16px', 
                  background: theme === 'dark' ? '#00bfa5' : '#fff', borderRadius: '50%', 
                  boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  left: theme === 'dark' ? '22px' : '2px'
                }} />
              </div>
              <span style={{ color: theme === 'dark' ? '#00bfa5' : '#64748b', display: 'flex', transition: 'color 0.2s', paddingLeft: '4px' }}>{Icons.moon}</span>
            </div>
          </div>

          {/* Editor canvas */}
          <div style={{
            flex: 1, minHeight: '300px', position: 'relative',
            borderTop: '1px solid rgba(45,212,212,0.08)',
          }}>
            <KetcherEditor ref={modifyKetcherRef} theme={theme} onLoad={handleModifyKetcherLoad} />
          </div>
        </div>

        {/* ── COLUMN 3: Modified Molecule ── */}
        <div style={{ flex: '3', ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>Modified Molecule</h3>
            <Tooltip text="Live preview of the modified structure from the editor">{Icons.info}</Tooltip>
          </div>

          {/* 2D / 3D toggle */}
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d', marginBottom: '12px', alignSelf: 'flex-start' }}>
            <button
              onClick={() => setModView('2d')}
              style={{
                padding: '5px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                ...(modView === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}
            >2D View</button>
            <button
              onClick={handleMod3D}
              disabled={modSdfLoading}
              style={{
                padding: '5px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: modSdfLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
                transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif', opacity: modSdfLoading ? 0.5 : 1,
                ...(modView === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
              }}
            >{modSdfLoading ? '...' : '3D View'}</button>
          </div>

          {/* Structure display with history chevrons */}
          <div style={{
            flex: 1, minHeight: '250px', position: 'relative',
            display: 'flex', alignItems: 'center',
          }}>
            {/* Left chevron */}
            <button
              onClick={goBack}
              disabled={!canGoBack}
              style={{
                position: 'absolute', left: '-4px', zIndex: 5,
                background: canGoBack ? 'rgba(45,212,212,0.1)' : 'transparent',
                border: canGoBack ? '1px solid rgba(45,212,212,0.2)' : '1px solid rgba(100,116,139,0.1)',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canGoBack ? 'pointer' : 'default',
                color: canGoBack ? accentColor : '#334155',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (canGoBack) e.currentTarget.style.background = 'rgba(45,212,212,0.2)' }}
              onMouseLeave={e => { if (canGoBack) e.currentTarget.style.background = 'rgba(45,212,212,0.1)' }}
            >{Icons.chevLeft}</button>

            {/* Structure */}
            <div style={{
              flex: 1, height: '100%', background: '#081214', borderRadius: '6px',
              border: '1px solid rgba(45,212,212,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', margin: '0 28px',
            }}>
              {modView === '3d' && modSdfBlock ? (
                <Viewer3D sdfBlock={modSdfBlock} height="100%" />
              ) : (
                displaySvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: displaySvg }}
                    style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '8px',
                      filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                    }}
                  />
                ) : (
                  <span style={{ color: '#475569', fontSize: '12px', fontStyle: 'italic' }}>Awaiting edits…</span>
                )
              )}
            </div>

            {/* Right chevron */}
            <button
              onClick={goForward}
              disabled={!canGoForward}
              style={{
                position: 'absolute', right: '-4px', zIndex: 5,
                background: canGoForward ? 'rgba(45,212,212,0.1)' : 'transparent',
                border: canGoForward ? '1px solid rgba(45,212,212,0.2)' : '1px solid rgba(100,116,139,0.1)',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canGoForward ? 'pointer' : 'default',
                color: canGoForward ? accentColor : '#334155',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (canGoForward) e.currentTarget.style.background = 'rgba(45,212,212,0.2)' }}
              onMouseLeave={e => { if (canGoForward) e.currentTarget.style.background = 'rgba(45,212,212,0.1)' }}
            >{Icons.chevRight}</button>
          </div>

          {/* History indicator */}
          {isViewingHistory && (
            <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '11px', color: '#f59e0b' }}>
              Viewing history: edit {historyIndex + 1} of {history.length} ({displayEntry?.timestamp})
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', padding: '8px 0', borderTop: '1px solid rgba(45,212,212,0.08)' }}>
            <StatBlock label="Molecular Weight" value={displayProps?.mw && displayProps.mw !== '-' ? `${displayProps.mw} g/mol` : '-'} />
            <StatBlock label="Formula" value={formulaToHtml(displayProps?.formula)} isHtml={true} />
            <StatBlock label="LogP" value={displayProps?.logP || '-'} />
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Analysis + Report ── */}
      <div style={{ display: 'flex', gap: '16px' }}>

        {/* ── LEFT: Modification Analysis ── */}
        <div style={{ flex: '7', ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>Modification Analysis</h3>
            <Tooltip text="Compare properties between original and modified structures">{Icons.info}</Tooltip>
          </div>

          {/* Sub-tab bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            {[
              { id: 'insights', label: 'Insights' },
              { id: 'comparison', label: 'Property Comparison' },
              { id: 'structural', label: 'Structural Changes' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAnalysisSubTab(tab.id)}
                style={{
                  padding: '8px 20px', fontSize: '13px', fontWeight: 500,
                  border: '1px solid rgba(45,212,212,0.15)', borderRadius: '6px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  ...(analysisSubTab === tab.id
                    ? { background: accentColor, color: '#000', borderColor: accentColor }
                    : { background: 'transparent', color: '#94a3b8' })
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* ── Insights sub-tab ── */}
          {analysisSubTab === 'insights' && (
            <div style={{ minHeight: '150px' }}>
              {!displaySmiles || displaySmiles === canonicalSmiles ? (
                <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
                  Make an edit in the Molecular Editor to see AI-powered insights about your modifications.
                </div>
              ) : insightsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: accentColor, fontSize: '14px', padding: '20px 0' }}>
                  <div style={{
                    width: '16px', height: '16px', border: '2px solid rgba(45,212,212,0.3)',
                    borderTop: `2px solid ${accentColor}`, borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Generating insights from local AI…
                </div>
              ) : insightsError ? (
                <div style={{ color: '#f59e0b', fontSize: '14px', padding: '20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {Icons.brain}
                  {insightsError}
                </div>
              ) : insights.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                  {insights.map((bullet, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                        background: accentColor, boxShadow: `0 0 6px ${accentColor}`,
                      }} />
                      <span style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}>{bullet}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* ── Property Comparison sub-tab ── */}
          {analysisSubTab === 'comparison' && (
            <div style={{ overflowX: 'auto' }}>
              {!displaySmiles || displaySmiles === canonicalSmiles ? (
                <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
                  Make an edit in the Molecular Editor to see a property comparison.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Property', 'Original', 'Modified', 'Δ (Delta)'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '10px 12px',
                          borderBottom: '1px solid rgba(45,212,212,0.15)',
                          color: accentColor, fontWeight: 600, fontSize: '12px',
                          letterSpacing: '0.03em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deltas.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(45,212,212,0.06)' }}>
                        <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 500 }}>{row.label}</td>
                        <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{row.origVal}</td>
                        <td style={{ padding: '10px 12px', color: '#fff', fontFamily: 'monospace' }}>{row.modVal}</td>
                        <td style={{
                          padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600,
                          color: row.delta === '-' ? '#475569'
                            : row.delta.startsWith('+') ? '#4ade80'
                            : row.delta.startsWith('-') ? '#f87171'
                            : '#94a3b8'
                        }}>{row.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Structural Changes sub-tab ── */}
          {analysisSubTab === 'structural' && (
            <div style={{ minHeight: '120px' }}>
              {!displaySmiles || displaySmiles === canonicalSmiles ? (
                <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
                  Make an edit in the Molecular Editor to see structural changes.
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
                        background: change.type === 'added' ? '#4ade80'
                          : change.type === 'removed' ? '#f87171'
                          : '#64748b',
                        boxShadow: change.type === 'added' ? '0 0 6px rgba(74,222,128,0.5)'
                          : change.type === 'removed' ? '0 0 6px rgba(248,113,113,0.5)'
                          : 'none',
                      }} />
                      <span style={{
                        color: change.type === 'added' ? '#4ade80'
                          : change.type === 'removed' ? '#f87171'
                          : '#94a3b8',
                        fontSize: '14px', fontWeight: 500,
                      }}>{change.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Report Generation + Save ── */}
        <div style={{ flex: '3', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Report Generation Card */}
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
              Generate a detailed report of your modifications.
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
                transition: 'all 0.2s ease', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {Icons.download}
              Generate Report
            </button>
          </div>

          {/* ── Suggest Best Modifications (Phase 12) ── */}
          <div style={{
            background: 'linear-gradient(135deg, #0d1a1c 0%, #0a1e20 100%)',
            border: '1px solid rgba(45,212,212,0.15)',
            borderRadius: '10px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <h3 style={{ color: accentColor, fontWeight: 700, fontSize: '16px', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {Icons.brain}
              Suggest Best Modifications
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
              Auto-rank structural modifications optimized for your target.
            </p>

            {/* Target endpoint selector */}
            <select
              value={shortlistTarget}
              onChange={e => setShortlistTarget(e.target.value)}
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
              <option value="antiinflammatory">Target: Anti-inflammatory</option>
              <option value="anticancer">Target: Anticancer</option>
              <option value="antioxidant">Target: Antioxidant</option>
              <option value="antimicrobial">Target: Antimicrobial</option>
            </select>

            <button
              onClick={fetchShortlist}
              disabled={shortlistLoading || !canonicalSmiles}
              style={{
                width: '100%', padding: '12px 0', fontWeight: 700, fontSize: '14px',
                borderRadius: '8px', border: 'none',
                cursor: shortlistLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: shortlistLoading
                  ? 'linear-gradient(135deg, #1a3a3a 0%, #163030 100%)'
                  : 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
                color: shortlistLoading ? '#64748b' : '#000',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: shortlistLoading ? 'none' : '0 4px 15px rgba(45,212,212,0.25)',
                transition: 'all 0.2s ease', letterSpacing: '0.02em',
                opacity: !canonicalSmiles ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!shortlistLoading && canonicalSmiles) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {shortlistLoading ? (
                <>
                  <div style={{
                    width: '16px', height: '16px', border: '2px solid rgba(45,212,212,0.3)',
                    borderTop: `2px solid ${accentColor}`, borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Analyzing transforms…
                </>
              ) : (
                <>
                  {Icons.brain}
                  Suggest Best Modifications
                </>
              )}
            </button>

            {/* ── Shortlist Results ── */}
            {shortlistVisible && (
              <div style={{ marginTop: '16px' }}>
                {shortlistError && !shortlistLoading && (
                  <div style={{ color: '#f59e0b', fontSize: '13px', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {Icons.info}
                    {shortlistError}
                  </div>
                )}

                {shortlistResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {shortlistResults.map((item, idx) => {
                      const targetPred = item.predictions?.find(p => p.endpoint_id === shortlistTarget)
                      const riskPreds = item.predictions?.filter(p => ['herg', 'tox21_mmp'].includes(p.endpoint_id) && p.available) || []
                      return (
                        <div
                          key={idx}
                          style={{
                            background: '#081214',
                            border: '1px solid rgba(45,212,212,0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            transition: 'border-color 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.1)'}
                        >
                          {/* Header: rank + name + score */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: idx === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                : idx === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                                : 'linear-gradient(135deg, #78716c, #57534e)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 700, color: '#000', flexShrink: 0,
                            }}>{item.rank}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.transform_name}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '13px', fontWeight: 700, fontFamily: 'monospace',
                              color: item.score >= 0.5 ? '#4ade80' : item.score >= 0 ? '#facc15' : '#f87171',
                              flexShrink: 0,
                            }}>
                              {item.score >= 0 ? '+' : ''}{item.score.toFixed(3)}
                            </div>
                          </div>

                          {/* Description */}
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', lineHeight: 1.4 }}>
                            {item.transform_description}
                          </div>

                          {/* Property deltas */}
                          {item.property_deltas && Object.keys(item.property_deltas).length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              {Object.entries(item.property_deltas).map(([key, val]) => (
                                <div key={key} style={{ fontSize: '11px' }}>
                                  <span style={{ color: '#94a3b8' }}>{key}: </span>
                                  <span style={{
                                    fontFamily: 'monospace', fontWeight: 600,
                                    color: val.delta > 0 ? '#4ade80' : val.delta < 0 ? '#f87171' : '#94a3b8',
                                  }}>
                                    {val.delta > 0 ? '+' : ''}{val.delta}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Predictions summary */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {targetPred && targetPred.available && (
                              <span style={{
                                fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                                background: targetPred.status_label === 'Active'
                                  ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                                color: targetPred.status_label === 'Active' ? '#4ade80' : '#f87171',
                                border: `1px solid ${targetPred.status_label === 'Active' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                              }}>
                                {targetPred.endpoint_name}: {targetPred.status_label} ({(targetPred.confidence * 100).toFixed(0)}%)
                              </span>
                            )}
                            {riskPreds.map((rp, ri) => (
                              <span key={ri} style={{
                                fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                                background: rp.status_label === 'Low Risk'
                                  ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                color: rp.status_label === 'Low Risk' ? '#4ade80' : '#f87171',
                                border: `1px solid ${rp.status_label === 'Low Risk' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
                              }}>
                                {rp.endpoint_name}: {rp.status_label}
                              </span>
                            ))}
                          </div>

                          {/* Apply button */}
                          <button
                            onClick={() => applyShortlistSuggestion(item.product_smiles)}
                            style={{
                              width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600,
                              borderRadius: '6px', cursor: 'pointer',
                              background: 'transparent',
                              border: '1px solid rgba(45,212,212,0.2)',
                              color: accentColor,
                              fontFamily: 'Inter, system-ui, sans-serif',
                              transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)'; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.4)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.2)' }}
                          >
                            {Icons.arrow}
                            Apply to Editor
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save and Exit */}
          <button
            onClick={onSaveExperiment || (() => window.location.href = '/')}
            style={{
              width: '100%', padding: '14px 0', borderRadius: '8px',
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
            Save and Exit Workspace
            {Icons.arrow}
          </button>
        </div>
      </div>

      {/* Spin animation for loading indicators */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
