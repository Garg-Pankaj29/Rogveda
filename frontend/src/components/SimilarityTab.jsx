import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import api from '../lib/apiClient'
import { computeProperties } from '../lib/chemistry'

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
const MATCH_TOLERANCE = 0.05  // 5% tolerance for continuous property matching
const accentColor = '#2dd4d4'
const cardStyle = {
  background: '#0d1a1c',
  border: '1px solid rgba(45,212,212,0.12)',
  borderRadius: '8px',
  padding: '20px',
}

/* ═══════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════ */
const Icons = {
  info:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  edit:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  clear:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  import:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  history:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  search:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  arrow:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  check:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  close:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}


/* ═══════════════════════════════════════════
   TOOLTIP WRAPPER
   ═══════════════════════════════════════════ */
function Tooltip({ text, children, style = {} }) {
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', color: '#64748b', cursor: 'help', ...style }}
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
   ACTION BUTTON — reused for Edit/Clear/Import/From History
   ═══════════════════════════════════════════ */
function ActionButton({ icon, label, onClick, disabled = false, disabledTooltip = '' }) {
  const btn = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', fontSize: '12px', fontWeight: 500,
        borderRadius: '6px',
        border: disabled ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(45,212,212,0.15)',
        background: disabled ? 'rgba(100,116,139,0.05)' : 'rgba(45,212,212,0.05)',
        color: disabled ? '#475569' : accentColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(45,212,212,0.12)' } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(45,212,212,0.05)' } }}
    >
      {icon} {label}
    </button>
  )
  if (disabled && disabledTooltip) {
    return <Tooltip text={disabledTooltip}>{btn}</Tooltip>
  }
  return btn
}


/* ═══════════════════════════════════════════
   HELPER: Check if two property values "match"
   ═══════════════════════════════════════════ */
function propsMatch(queryVal, matchVal, isInteger, isString) {
  if (queryVal === '-' || matchVal === '-' || queryVal == null || matchVal == null) return false
  if (isString) return String(queryVal) === String(matchVal)
  const qNum = parseFloat(queryVal)
  const mNum = parseFloat(matchVal)
  if (isNaN(qNum) || isNaN(mNum)) return false
  if (isInteger) return qNum === mNum
  // Continuous: within MATCH_TOLERANCE of each other
  if (qNum === 0 && mNum === 0) return true
  const avg = (Math.abs(qNum) + Math.abs(mNum)) / 2
  if (avg === 0) return true
  return Math.abs(qNum - mNum) / avg <= MATCH_TOLERANCE
}


/* ═══════════════════════════════════════════
   HELPER: Generate SVG thumbnail for a SMILES
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
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function SimilarityTab({
  rdkit,
  canonicalSmiles,
  currentMolecule,
  onSaveExperiment,
  onGenerateReport,
  logActivity,
  onSwitchToDrawTab,
}) {
  // Search state
  const [searchType, setSearchType] = useState('structural')
  const [metric, setMetric] = useState('tanimoto_ecfp4')
  const [threshold, setThreshold] = useState(0.70)
  const [maxResults, setMaxResults] = useState(50)
  const [customSmiles, setCustomSmiles] = useState('')
  const effectiveSmiles = customSmiles || canonicalSmiles

  // Results state
  const [results, setResults] = useState(null)       // null = no search yet, [] = empty results
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [resultsSubTab, setResultsSubTab] = useState('matched')
  const [showAllResults, setShowAllResults] = useState(false)

  // Report
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')

  /* ─── Run Similarity Search ─── */
  const handleSearch = useCallback(async () => {
    if (!effectiveSmiles) {
      setSearchError('No query molecule loaded. Please draw or enter a molecule first.')
      return
    }
    setIsSearching(true)
    setSearchError('')
    setResults(null)
    try {
      const endpoint = searchType === 'substructure' ? '/api/molecule/substructure' : '/api/molecule/similar'
      const data = await api.post(endpoint, {
        smiles: effectiveSmiles,
        threshold: searchType === 'substructure' ? 0.0 : threshold,
        metric: searchType === 'substructure' ? 'substructure' : metric,
        top_n: maxResults,
      })
      setResults(data.hits || [])
      logActivity?.(`${searchType === 'substructure' ? 'Substructure' : 'Similarity'} search: ${(data.hits || []).length} hits`)
    } catch (e) {
      console.error('Search failed:', e)
      setSearchError(e.message || 'Search failed. Please try again.')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [effectiveSmiles, threshold, maxResults, searchType, metric, logActivity])

  /* ─── Compute properties for query and top match ─── */
  const queryProps = useMemo(() => {
    if (!rdkit || !effectiveSmiles) return null
    return computeProperties(rdkit, effectiveSmiles)
  }, [rdkit, effectiveSmiles])

  const topMatch = results && results.length > 0 ? results[0] : null

  const topMatchProps = useMemo(() => {
    if (!rdkit || !topMatch) return null
    return computeProperties(rdkit, topMatch.canonical_smiles)
  }, [rdkit, topMatch])

  /* ─── Property comparison rows ─── */
  const propertyRows = [
    { label: 'Molecular Formula', qKey: 'formula', isInt: false, isString: true },
    { label: 'Molecular Weight (g/mol)', qKey: 'mw', isInt: false },
    { label: 'Exact Mass (Da)', qKey: 'exactMass', isInt: false },
    { label: 'LogP', qKey: 'logP', isInt: false },
    { label: 'TPSA (Å²)', qKey: 'tpsa', isInt: false },
    { label: 'H-Bond Donors', qKey: 'hbd', isInt: true },
    { label: 'H-Bond Acceptors', qKey: 'hba', isInt: true },
    { label: 'Rotatable Bonds', qKey: 'rotBonds', isInt: true },
    { label: 'Total Rings', qKey: 'totalRings', isInt: true },
    { label: 'Aromatic Rings', qKey: 'aromaticRings', isInt: true },
    { label: 'Saturated Rings', qKey: 'saturatedRings', isInt: true },
    { label: 'Heavy Atoms', qKey: 'heavyAtoms', isInt: true },
    { label: 'Heteroatoms', qKey: 'heteroAtoms', isInt: true },
    { label: 'Fraction Csp³', qKey: 'fractionCsp3', isInt: false },
    { label: 'Molar Refractivity', qKey: 'molarRefractivity', isInt: false },
    { label: 'Chiral Centers', qKey: 'chiralCenters', isInt: true },
    { label: 'Amide Bonds', qKey: 'amideBonds', isInt: true },
  ]

  /* ─── SVG for top 5 similar compounds ─── */
  const compoundCards = useMemo(() => {
    if (!rdkit || !results || results.length === 0) return []
    return results.slice(0, 5).map(hit => {
      let finalSvg = hit.svg 
        ? hit.svg.replace(/<rect[^>]*(?:fill=['"]#FFFFFF['"]|fill:#FFFFFF)[^>]*>/i, '<rect opacity="0" fill="none" />').replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
        : generateSvg(rdkit, hit.canonical_smiles, 150, 120);
      return {
        ...hit,
        svg: finalSvg,
      }
    })
  }, [rdkit, results])

  /* ─── Query molecule SVG (larger, for the card) ─── */
  const querySvg = useMemo(() => {
    if (!rdkit || !effectiveSmiles) return ''
    return generateSvg(rdkit, effectiveSmiles, 340, 260)
  }, [rdkit, effectiveSmiles])

  /* ─── Download results as CSV ─── */
  const handleDownloadResults = () => {
    if (!results || results.length === 0) return
    const header = 'Name,SMILES,Tanimoto Similarity'
    const rows = results.map(h => `"${h.name}","${h.canonical_smiles}",${h.tanimoto}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `similarity_results_${queryLabel || 'search'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    logActivity?.('Similarity results exported as CSV')
  }

  /* ─── Threshold input sync ─── */
  const handleThresholdInput = (val) => {
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0 && num <= 1) setThreshold(Math.round(num * 100) / 100)
  }

  return (
    <>
      {/* ── GRID LAYOUT FOR PERFECT SYMMETRY ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '35fr 28fr 37fr',
        gap: '16px',
        width: '100%',
        alignItems: 'stretch'
      }}>

        {/* ──── COLUMN 1: Query Molecule (~35%) ──── */}
        <div style={{ gridColumn: '1 / 2', ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Query Molecule
            </h3>
            <Tooltip text="The molecule you're searching similar compounds for">
              {Icons.info}
            </Tooltip>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <ActionButton icon={Icons.edit} label="Edit" onClick={() => onSwitchToDrawTab?.()} />
            <ActionButton icon={Icons.clear} label="Clear" onClick={() => { /* Clear is handled by switching to Draw and clearing there */ onSwitchToDrawTab?.() }} />
            <ActionButton icon={Icons.import} label="Import" onClick={() => { /* TODO: Reuse Import from Draw tab — stub for now */ alert('Import: Switch to Draw tab to import a molecule file.') }} />
            <ActionButton icon={Icons.history} label="From History" onClick={() => { /* TODO: Reuse history mechanism from Draw tab */ alert('From History: Switch to Draw tab to load from history.') }} />
          </div>

          {/* Canvas / SVG area */}
          <div style={{
            flex: 1, minHeight: '260px',
            background: '#081214', borderRadius: '8px',
            border: '1px solid rgba(45,212,212,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {querySvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: querySvg }}
                style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '12px',
                  filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#475569', padding: '20px' }}>
                <svg style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                <p style={{ fontSize: '13px', margin: 0 }}>No molecule loaded.<br/>Switch to the Draw tab to draw or load a molecule.</p>
              </div>
            )}
          </div>

          {/* SMILES Input (optional) */}
          <div>
            <label style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
              SMILES Input (optional)
            </label>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#081214', borderRadius: '6px',
              border: '1px solid rgba(45,212,212,0.1)',
              padding: '0 12px', height: '36px',
            }}>
              <input
                type="text"
                value={customSmiles}
                onChange={e => setCustomSmiles(e.target.value)}
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#fff', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif',
                }}
              />
              {customSmiles && (
                <button
                  onClick={() => setCustomSmiles('')}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: '0 2px' }}
                >
                  {Icons.close}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ──── COLUMN 2: Search Options (~28%) ──── */}
        <div style={{ flex: '0 0 28%', ...cardStyle, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Search Options
          </h3>

          {/* Search Type */}
          <div>
            <label style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Search Type</label>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d' }}>
              <button
                onClick={() => setSearchType('structural')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.2s',
                  ...(searchType === 'structural'
                    ? { background: accentColor, color: '#000' }
                    : { background: 'transparent', color: '#94a3b8' })
                }}
              >Structural Similarity</button>
              <button
                onClick={() => setSearchType('substructure')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.2s',
                  ...(searchType === 'substructure'
                    ? { background: accentColor, color: '#000' }
                    : { background: 'transparent', color: '#94a3b8' })
                }}
              >Substructure</button>
            </div>
          </div>

          {/* Similarity Metric and Threshold (hidden for substructure) */}
          {searchType !== 'substructure' && (
            <>
              {/* Similarity Metric */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <label style={{ color: '#94a3b8', fontSize: '13px' }}>Similarity Metric</label>
                  <Tooltip text="Select a fingerprint representation (Morgan ECFP4/ECFP6, MACCS) and comparison algorithm (Tanimoto, Dice).">
                    {Icons.info}
                  </Tooltip>
                </div>
                <select
                  value={metric}
                  onChange={e => setMetric(e.target.value)}
                  style={{
                    width: '100%', background: '#081214',
                    border: '1px solid rgba(45,212,212,0.15)', color: '#e2e8f0',
                    fontSize: '13px', borderRadius: '6px', padding: '10px 12px',
                    outline: 'none', appearance: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                  }}
                >
                  <option value="tanimoto_ecfp4">Tanimoto (ECFP4)</option>
                  <option value="tanimoto_ecfp6">Tanimoto (ECFP6)</option>
                  <option value="dice_ecfp4">Dice (ECFP4)</option>
                  <option value="tanimoto_maccs">Tanimoto (MACCS)</option>
                </select>
              </div>

              {/* Similarity Threshold */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Similarity Threshold</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={threshold}
                    onChange={e => setThreshold(parseFloat(e.target.value))}
                    style={{
                      flex: 1, height: '6px', appearance: 'none', background: '#081214',
                      borderRadius: '3px', outline: 'none', cursor: 'pointer',
                      accentColor: accentColor,
                    }}
                  />
                  <input
                    type="number"
                    min="0" max="1" step="0.01"
                    value={threshold}
                    onChange={e => handleThresholdInput(e.target.value)}
                    style={{
                      width: '60px', background: '#081214',
                      border: '1px solid rgba(45,212,212,0.15)', color: '#fff',
                      fontSize: '13px', borderRadius: '6px', padding: '6px 8px',
                      textAlign: 'center', outline: 'none',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Max Results */}
          <div>
            <label style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Max Results</label>
            <select
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value))}
              style={{
                width: '100%', background: '#081214',
                border: '1px solid rgba(45,212,212,0.15)', color: '#e2e8f0',
                fontSize: '13px', borderRadius: '6px', padding: '10px 12px',
                outline: 'none', appearance: 'none', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Find Similar button */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !effectiveSmiles}
            style={{
              width: '100%', padding: '14px 0', fontWeight: 700, fontSize: '14px',
              borderRadius: '8px', border: 'none',
              cursor: isSearching || !effectiveSmiles ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: isSearching || !effectiveSmiles
                ? 'rgba(45,212,212,0.3)'
                : 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
              color: '#000', fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: '0 4px 15px rgba(45,212,212,0.25)',
              transition: 'all 0.2s ease', letterSpacing: '0.02em',
              opacity: isSearching || !effectiveSmiles ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!isSearching && effectiveSmiles) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {isSearching ? (
              <>Searching...</>
            ) : (
              <>Find Similar Molecules {Icons.arrow}</>
            )}
          </button>
        </div>

        {/* ──── COLUMN 3: Similarity Results (~37%) ──── */}
        <div style={{ gridColumn: '3 / 4', ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
          {/* Title + score bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Similarity Results
            </h3>
            {topMatch && (
              <div style={{ textAlign: 'right', minWidth: '140px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
                  Overall {searchType === 'substructure' ? 'Match' : 'Similarity'}: <span style={{ color: accentColor, fontWeight: 600 }}>
                    {searchType === 'substructure' ? 'Substructure Match' : Number(topMatch.tanimoto ?? 0).toFixed(2)}
                  </span>
                </div>
                {searchType !== 'substructure' && (
                  <>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${Math.round(Number(topMatch.tanimoto ?? 0) * 100)}%`,
                        height: '100%', borderRadius: '3px',
                        background: `linear-gradient(90deg, ${accentColor}, #22b8b8)`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', textAlign: 'right' }}>
                      {Number(topMatch.tanimoto ?? 0).toFixed(2)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(45,212,212,0.1)' }}>
            {[
              { id: 'matched', label: 'Matched Properties' },
              { id: 'comparison', label: 'Property Comparison' },
              { id: 'alignment', label: 'Structural Alignment' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setResultsSubTab(tab.id)}
                style={{
                  padding: '8px 12px', fontSize: '12px', fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.2s', background: 'transparent',
                  ...(resultsSubTab === tab.id
                    ? { color: accentColor, borderBottom: `2px solid ${accentColor}` }
                    : { color: '#64748b', borderBottom: '2px solid transparent' })
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* Sub-tab content */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {resultsSubTab === 'matched' ? (
              /* ── Matched Properties table ── */
              results === null ? (
                <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                  Run a search to see property comparisons.
                </div>
              ) : results.length === 0 ? (
                <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                  No matches found above the threshold.
                </div>
              ) : (
                <div style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  borderRadius: '6px',
                  border: '1px solid rgba(45,212,212,0.08)',
                  background: '#081214',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(45,212,212,0.3) transparent',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#0a1618', zIndex: 2, boxShadow: '0 1px 0 rgba(45,212,212,0.1)' }}>
                      <tr>
                        {['Property', 'Query Molecule', 'Top Match (1)', 'Match'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '8px 10px', color: '#94a3b8', fontWeight: 600,
                            borderBottom: '1px solid rgba(45,212,212,0.1)', fontSize: '11px',
                            letterSpacing: '0.04em', textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {propertyRows.map((row, i) => {
                        const qVal = queryProps?.[row.qKey] ?? '-'
                        const mVal = topMatchProps?.[row.qKey] ?? '-'
                        const isMatch = propsMatch(qVal, mVal, row.isInt, row.isString)
                        
                        const formatVal = (v) => {
                          if (row.qKey === 'formula' && v !== '-') return v.replace(/([0-9]+)/g, '<sub>$1</sub>')
                          return v
                        }
                        
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(45,212,212,0.05)' }}>
                            <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{row.label}</td>
                            <td 
                              style={{ padding: '7px 10px', color: '#fff', fontFamily: 'monospace', fontWeight: 500 }}
                              dangerouslySetInnerHTML={{ __html: formatVal(qVal) }}
                            />
                            <td 
                              style={{ padding: '7px 10px', color: '#fff', fontFamily: 'monospace', fontWeight: 500 }}
                              dangerouslySetInnerHTML={{ __html: formatVal(mVal) }}
                            />
                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                              {isMatch ? Icons.check : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : resultsSubTab === 'comparison' ? (
              /* ── Property Comparison ── */
              results === null || results.length === 0 ? (
                <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                  Run a search to see property comparisons.
                </div>
              ) : (
                <div style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  padding: '16px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(45,212,212,0.3) transparent',
                }}>
                  {propertyRows.filter(r => !r.isString).map(row => {
                    const rawQ = queryProps?.[row.qKey]
                    const rawM = topMatchProps?.[row.qKey]
                    
                    const parseVal = (v) => {
                      if (v === null || v === undefined || v === '-') return null
                      const n = typeof v === 'number' ? v : parseFloat(v)
                      return isNaN(n) ? null : n
                    }
                    
                    const qNum = parseVal(rawQ)
                    const mNum = parseVal(rawM)
                    const qVal = qNum ?? 0
                    const mVal = mNum ?? 0
                    const maxVal = Math.max(Math.abs(qVal), Math.abs(mVal)) || 1
                    const qPct = qNum !== null ? Math.min(100, Math.max(0, (Math.abs(qVal) / maxVal) * 100)) : 0
                    const mPct = mNum !== null ? Math.min(100, Math.max(0, (Math.abs(mVal) / maxVal) * 100)) : 0
                    
                    const formatDisplay = (num, isInt) => {
                      if (num === null) return '-'
                      return isInt ? Math.round(num) : num.toFixed(2)
                    }

                    return (
                      <div key={row.qKey} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                          <span>{row.label}</span>
                          <span style={{ color: '#cbd5e1', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: '#fff' }}>{formatDisplay(qNum, row.isInt)}</span>
                            <span style={{ opacity: 0.3 }}>vs</span>
                            <span style={{ color: accentColor }}>{formatDisplay(mNum, row.isInt)}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', width: '100%', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${qPct}%`, background: '#fff', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', width: '100%', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${mPct}%`, background: accentColor, borderRadius: '3px', transition: 'width 0.5s ease', opacity: 0.9 }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : resultsSubTab === 'alignment' ? (
              /* ── Structural Alignment ── */
              results === null || results.length === 0 ? (
                <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                  Run a search to see structural alignments.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '16px', padding: '16px', height: '100%', boxSizing: 'border-box', maxHeight: '280px' }}>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', letterSpacing: '0.04em' }}>
                      QUERY MOLECULE
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden' }}>
                      <div 
                        style={{ filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
                        dangerouslySetInnerHTML={{ __html: querySvg || '' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: `1px solid rgba(45,212,212,0.15)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(45,212,212,0.02)' }}>
                    <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: accentColor, borderBottom: '1px solid rgba(45,212,212,0.1)', background: 'rgba(45,212,212,0.05)', letterSpacing: '0.04em' }}>
                      TOP MATCH <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: '6px' }}>({searchType === 'substructure' ? 'SUBSTRUCTURE' : `SIMILARITY: ${Number(topMatch?.tanimoto ?? 0).toFixed(2)}`})</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden' }}>
                      <div 
                        style={{ filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
                        dangerouslySetInnerHTML={{ __html: compoundCards[0]?.svg || '' }}
                      />
                    </div>
                  </div>
                </div>
              )
            ) : null}
          </div>

          {/* Bottom actions */}
          {results && results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(45,212,212,0.08)', paddingTop: '12px' }}>
              <button
                onClick={handleDownloadResults}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                  borderRadius: '6px', border: '1px solid rgba(45,212,212,0.15)',
                  background: 'rgba(45,212,212,0.05)', color: '#e2e8f0',
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.05)' }}
              >
                {Icons.download} Download Results
              </button>
              <button
                onClick={() => setShowAllResults(true)}
                style={{
                  background: 'none', border: 'none',
                  color: accentColor, fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                View Full Results {Icons.arrow}
              </button>
            </div>
          )}
        </div>
      {/* Error message */}
      {searchError && (
        <div style={{ gridColumn: '1 / 4', padding: '12px', fontSize: '13px', borderRadius: '8px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5' }}>
          {searchError}
        </div>
      )}

      {/* ── BOTTOM ROW: Similar Compounds + Report ── */}
        {/* ── LEFT: Similar Compounds (~65%) ── */}
        <div style={{ gridColumn: '1 / 3', ...cardStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Similar Compounds
            </h3>
            {results && results.length > 5 && (
              <button
                onClick={() => setShowAllResults(true)}
                style={{
                  background: 'none', border: 'none', color: accentColor,
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                View All {Icons.arrow}
              </button>
            )}
          </div>

          {!results || results.length === 0 ? (
            <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
              {results === null
                ? 'Run a similarity search to see matching compounds.'
                : 'No similar compounds found above the threshold.'}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {compoundCards.map((card, i) => (
                <div
                  key={i}
                  style={{
                    flex: '0 0 170px', minWidth: '170px',
                    background: '#081214', borderRadius: '8px',
                    border: '1px solid rgba(45,212,212,0.08)',
                    padding: '12px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(45,212,212,0.08)'}
                >
                  <div style={{
                    width: '100%', height: '100px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', borderRadius: '4px',
                  }}>
                    {card.svg ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: card.svg }}
                        style={{
                          filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      />
                    ) : (
                      <span style={{ color: '#475569', fontSize: '10px' }}>No structure</span>
                    )}
                  </div>
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.name || 'Unnamed compound'}
                    </div>
                    <div style={{ color: accentColor, fontSize: '11px', fontWeight: 500 }}>
                      {searchType === 'substructure' ? 'Substructure Match' : `Similarity: ${Number(card.tanimoto ?? 0).toFixed(2)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Report Generation + Save (~35%) ── */}
        <div style={{ gridColumn: '3 / 4', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Report Generation Card — reuse the same pattern from AnalysisTab/MolecularSidebar */}
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Generate Report
            </button>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save and Exit Workspace
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>

      {/* ── MODAL: Full Results ── */}
      {showAllResults && results && createPortal(
        <div 
          onClick={() => setShowAllResults(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 11, 13, 0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
            padding: '20px', boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.2)',
              borderRadius: '12px', width: '800px', maxWidth: '100%',
              maxHeight: '100%', display: 'flex', flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(45,212,212,0.1)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Similar Compounds ({results.length})
              </h2>
              <button
                onClick={() => setShowAllResults(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                {Icons.close}
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '20px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {results.map((hit, i) => (
                <div
                  key={i}
                  style={{
                    background: '#081214', borderRadius: '8px',
                    border: '1px solid rgba(45,212,212,0.08)',
                    padding: '12px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px',
                  }}
                >
                  <div style={{
                    width: '100%', height: '120px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', borderRadius: '4px',
                  }}>
                    <div
                      dangerouslySetInnerHTML={{ 
                        __html: hit.svg 
                          ? hit.svg.replace(/<rect[^>]*(?:fill=['"]#FFFFFF['"]|fill:#FFFFFF)[^>]*>/i, '<rect opacity="0" fill="none" />').replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
                          : generateSvg(rdkit, hit.canonical_smiles, 150, 120) 
                      }}
                      style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                      }}
                    />
                  </div>
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hit.name}>
                      {hit.name || 'Unnamed compound'}
                    </div>
                    <div style={{ color: accentColor, fontSize: '11px', fontWeight: 500 }}>
                      {searchType === 'substructure' ? 'Substructure Match' : `Similarity: ${Number(hit.tanimoto ?? 0).toFixed(2)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
