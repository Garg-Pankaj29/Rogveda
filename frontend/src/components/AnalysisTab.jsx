import { useState, useEffect, useCallback } from 'react'
import Viewer3D from './Viewer3D'
import api from '../lib/apiClient'

/* ═══════════════════════════════════════════
   SVG ICON HELPERS
   ═══════════════════════════════════════════ */
const Icons = {
  info:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  fit:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  brain:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>,
  code:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
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
const labelColor = '#94a3b8'
const accentColor = '#2dd4d4'

/* ═══════════════════════════════════════════
   Status badge color logic
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
export default function AnalysisTab({
  rdkit,
  ketcherRef,
  currentMolecule,
  canonicalSmiles,
  setCanonicalSmiles,
  sdfBlock,
  setSdfBlock,
  inputSmiles,
  setInputSmiles,
  show3d,
  setShow3d,
  is3dLoading,
  setIs3dLoading,
  error,
  setError,
  logActivity,
  onSaveExperiment,
  onGenerateReport,
  handleLoadSmiles,
  handleClearSmiles,
  last3dSmiles,
}) {
  const [analysisView, setAnalysisView] = useState('2d') // '2d' or '3d'
  const [predictions, setPredictions] = useState([])
  const [predLoading, setPredLoading] = useState(false)
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')

  // Phase 13 Remediation state
  const [remediationLoading, setRemediationLoading] = useState({})
  const [remediationResults, setRemediationResults] = useState({})

  // Phase 16 Synthesizability state
  const [synthData, setSynthData] = useState(null)
  const [synthLoading, setSynthLoading] = useState(false)

  /* ─── Fetch ML predictions whenever the molecule changes ─── */
  const fetchPredictions = useCallback(async (smiles) => {
    if (!smiles) {
      setPredictions([])
      return
    }
    setPredLoading(true)
    try {
      const data = await api.post('/api/molecule/predict-all', { smiles })
      setPredictions(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('predict-all failed:', e)
      setPredictions([])
    } finally {
      setPredLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPredictions(canonicalSmiles)
    // Clear remediation state on new molecule
    setRemediationResults({})
    setRemediationLoading({})
    // Phase 16: Fetch synthesizability
    setSynthData(null)
    if (canonicalSmiles) {
      setSynthLoading(true)
      api.post('/api/molecule/synthesizability', { smiles: canonicalSmiles })
        .then(data => setSynthData(data))
        .catch(e => console.error('Synthesizability fetch failed:', e))
        .finally(() => setSynthLoading(false))
    }
  }, [canonicalSmiles, fetchPredictions])

  /* ─── Phase 13: Handle Remediation Suggestion ─── */
  const handleRemediate = async (flaggedPred) => {
    if (!canonicalSmiles) return
    
    // Find a sensible default protect_endpoint: the first "Active" activity endpoint
    let protectEndpoint = 'antiinflammatory'
    const activePred = predictions.find(p => p.status_label === 'Active' && p.endpoint_name !== flaggedPred.endpoint_name)
    if (activePred) {
      // Mapping name to id (naive fallback if needed, better to map properly)
      const mapping = {
        'Anti-inflammatory': 'antiinflammatory',
        'Antioxidant': 'antioxidant',
        'Antimicrobial': 'antimicrobial',
        'Anticancer': 'anticancer'
      }
      protectEndpoint = mapping[activePred.endpoint_name] || protectEndpoint
    }

    const flaggedMapping = {
      'hERG Cardiotoxicity': 'herg',
      'Tox21 Mitochondrial Toxicity': 'tox21_mmp'
    }
    const flaggedId = flaggedMapping[flaggedPred.endpoint_name]
    if (!flaggedId) return

    setRemediationLoading(prev => ({ ...prev, [flaggedPred.endpoint_name]: true }))
    try {
      const data = await api.post('/api/remediation/find', {
        smiles: canonicalSmiles,
        flagged_endpoint: flaggedId,
        protect_endpoint: protectEndpoint
      })
      setRemediationResults(prev => ({ ...prev, [flaggedPred.endpoint_name]: data }))
    } catch (e) {
      console.error('Remediation failed:', e)
      setRemediationResults(prev => ({ 
        ...prev, 
        [flaggedPred.endpoint_name]: { error: e.message || 'Failed to search for fixes.' } 
      }))
    } finally {
      setRemediationLoading(prev => ({ ...prev, [flaggedPred.endpoint_name]: false }))
    }
  }

  /* ─── Generate 3D for analysis view ─── */
  const handleAnalysis3D = async () => {
    if (!rdkit || !ketcherRef?.current) return

    let mol = null, latestSmiles = ''
    try {
      const molblock = await ketcherRef.current.getMolfile()
      if (!molblock || molblock.trim() === '') { setError('Canvas is empty.'); return }
      mol = rdkit.get_mol(molblock)
      if (!mol || !mol.is_valid()) { setError('Invalid structure.'); return }
      latestSmiles = mol.get_smiles()
      setCanonicalSmiles(latestSmiles)
      setInputSmiles(latestSmiles)
    } catch (e) {
      setError('Error: ' + e.message); return
    } finally {
      if (mol) mol.delete()
    }
    if (!latestSmiles) { setError('No molecule to view.'); return }

    if (latestSmiles === last3dSmiles?.current && sdfBlock) {
      setAnalysisView('3d')
      return
    }

    setError('')
    setIs3dLoading(true)
    try {
      const response = await api.post('/api/molecule/3d', { smiles: latestSmiles })
      setSdfBlock(response.sdf_block)
      if (last3dSmiles) last3dSmiles.current = latestSmiles
      setAnalysisView('3d')
      logActivity('3D model generated (Analysis)')
    } catch (err) {
      setError('3D generation failed: ' + (err.message || 'Unknown error'))
    } finally {
      setIs3dLoading(false)
    }
  }

  /* ─── Export image ─── */
  const handleExportImage = () => {
    if (analysisView === '2d') {
      // Export the SVG thumbnail from currentMolecule
      if (!currentMolecule?.thumbnailSvg) return
      const svgStr = currentMolecule.thumbnailSvg
        .replace(/opacity="0"/g, 'opacity="1"')
        .replace(/fill="none"/g, 'fill="#fff"')
      const blob = new Blob([svgStr], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'molecule_2d.svg'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // For 3D, use 3Dmol's built-in pngURI for reliable capture
      try {
        if (window.__viewer3d_pngURI) {
          const url = window.__viewer3d_pngURI()
          if (url) {
            const a = document.createElement('a')
            a.href = url
            a.download = 'molecule_3d.png'
            a.click()
          }
        } else {
          // Fallback: try to find canvas
          const canvas = document.querySelector('#analysis-3d-viewer canvas')
          if (canvas) {
            const url = canvas.toDataURL('image/png')
            const a = document.createElement('a')
            a.href = url
            a.download = 'molecule_3d.png'
            a.click()
          }
        }
      } catch (e) { console.error('Export failed:', e) }
    }
    logActivity('Image exported')
  }

  /* ─── Property rows definition ─── */
  const properties = currentMolecule && currentMolecule.formula !== '-' ? currentMolecule : null
  const propRows = properties ? [
    { label: 'Molecular Formula', value: properties.formula !== '-' ? properties.formula.replace(/([0-9]+)/g, '<sub>$1</sub>') : '—', html: true },
    { label: 'Molecular Weight', value: properties.mw !== '-' ? `${properties.mw} g/mol` : '-' },
    { label: 'Exact Mass', value: properties.exactMass !== '-' ? `${properties.exactMass} Da` : '-' },
    { label: 'LogP (Crippen)', value: properties.logP },
    { label: 'Topological Polar\nSurface Area (TPSA)', value: properties.tpsa !== '-' ? `${properties.tpsa} Å²` : '-' },
    { label: 'H-Bond Donors', value: properties.hbd },
    { label: 'H-Bond Acceptors', value: properties.hba },
    { label: 'Rotatable Bonds', value: properties.rotBonds },
    { label: 'Total Rings', value: properties.totalRings },
    { label: 'Aromatic Rings', value: properties.aromaticRings },
    { label: 'Heavy Atoms', value: properties.heavyAtoms },
    { label: 'Heteroatoms', value: properties.heteroAtoms },
    { label: 'Fraction Csp³', value: properties.fractionCsp3 },
    { label: 'Molar Refractivity', value: properties.molarRefractivity },
    { label: 'Chiral Centers', value: properties.chiralCenters },
    { label: 'Amide Bonds', value: properties.amideBonds },
    { label: 'Saturated Rings', value: properties.saturatedRings },
  ] : [
    { label: 'Molecular Formula', value: '—' },
    { label: 'Molecular Weight', value: '—' },
    { label: 'Exact Mass', value: '—' },
    { label: 'LogP (Crippen)', value: '—' },
    { label: 'Topological Polar\nSurface Area (TPSA)', value: '—' },
    { label: 'H-Bond Donors', value: '—' },
    { label: 'H-Bond Acceptors', value: '—' },
    { label: 'Rotatable Bonds', value: '—' },
    { label: 'Total Rings', value: '—' },
    { label: 'Aromatic Rings', value: '—' },
    { label: 'Heavy Atoms', value: '—' },
    { label: 'Heteroatoms', value: '—' },
    { label: 'Fraction Csp³', value: '—' },
    { label: 'Molar Refractivity', value: '—' },
    { label: 'Chiral Centers', value: '—' },
    { label: 'Amide Bonds', value: '—' },
    { label: 'Saturated Rings', value: '—' },
  ]

  return (
    <>
      {/* ── SUB-TOOLBAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', marginBottom: '20px' }}>
        {/* 2D / 3D segmented toggle */}
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d' }}>
          <button
            onClick={() => setAnalysisView('2d')}
            style={{
              padding: '6px 14px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', borderRadius: '6px',
              transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
              ...(analysisView === '2d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
            }}
          >2D View</button>
          <button
            onClick={handleAnalysis3D}
            disabled={is3dLoading}
            style={{
              padding: '6px 14px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: is3dLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
              transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
              opacity: is3dLoading ? 0.3 : 1,
              ...(analysisView === '3d' ? { background: accentColor, color: '#000' } : { background: 'transparent', color: '#94a3b8' })
            }}
          >{is3dLoading ? '...' : '3D View'}</button>
        </div>

        {/* Fit to Screen */}
        <button
          onClick={() => {
            if (analysisView === '3d') {
              window.dispatchEvent(new CustomEvent('viewer3d-fit'))
            } else if (ketcherRef?.current) {
               // Optional: fit Ketcher in 2D if needed, but Ketcher usually handles its own canvas.
               // RDKit SVG is automatically scaled to fit its viewBox, so 2D doesn't need a fit action here.
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px', fontSize: '13px',
            borderRadius: '6px', border: '1px solid rgba(45,212,212,0.1)',
            background: 'rgba(255,255,255,0.02)', color: '#94a3b8',
            cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)'; e.currentTarget.style.color = accentColor }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94a3b8' }}
        >{Icons.fit} Fit to Screen</button>

        {/* Export Image */}
        <button
          onClick={handleExportImage}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px', fontSize: '13px',
            borderRadius: '6px', border: '1px solid rgba(45,212,212,0.1)',
            background: 'rgba(255,255,255,0.02)', color: '#94a3b8',
            cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)'; e.currentTarget.style.color = accentColor }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94a3b8' }}
        >{Icons.download} Export Image</button>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px', fontSize: '13px', borderRadius: '8px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* ── MAIN THREE-COLUMN LAYOUT ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '45fr 28fr 27fr',
        gap: '16px',
        width: '100%',
        minHeight: '600px',
        alignItems: 'stretch'
      }}>

        {/* ──── COLUMN 1: 2D/3D Viewer (~45%) ──── */}
        <div style={{
          gridColumn: '1 / 2',
          display: 'flex', flexDirection: 'column',
          borderRadius: '8px', overflow: 'hidden',
          border: '1px solid rgba(45,212,212,0.15)', background: '#0d1a1c',
          position: 'relative', minHeight: '600px',
        }}>
          {analysisView === '2d' ? (
            /* 2D SVG view of current molecule */
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#081214' }}>
              {currentMolecule?.thumbnailSvg ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      // Generate a larger SVG for the analysis view if rdkit available
                      if (rdkit && canonicalSmiles) {
                        let mol = null
                        try {
                          mol = rdkit.get_mol(canonicalSmiles)
                          if (mol && mol.is_valid()) {
                            let svg = mol.get_svg(500, 400)
                            svg = svg.replace(/<rect[^>]*fill=['"]#FFFFFF['"][^>]*>/i, '<rect opacity="0" fill="none" />')
                            svg = svg.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
                            mol.delete()
                            return svg
                          }
                          if (mol) mol.delete()
                        } catch (e) {
                          if (mol) mol.delete()
                        }
                      }
                      return currentMolecule.thumbnailSvg
                    })()
                  }}
                  style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#475569' }}>
                  <svg style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  <p style={{ fontSize: '14px', margin: 0 }}>No molecule loaded. Draw or load a SMILES below.</p>
                </div>
              )}
            </div>
          ) : (
            /* 3D Viewer */
            <div id="analysis-3d-viewer" style={{ flex: 1, background: '#050b0d' }}>
              {sdfBlock ? (
                <Viewer3D sdfBlock={sdfBlock} height="100%" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: '14px' }}>
                  No 3D structure available.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ──── COLUMN 2: Molecular Properties (~28%) ──── */}
        <div style={{ gridColumn: '2 / 3', ...cardStyle, padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Molecular Properties
            </h3>
            <div 
              style={{ position: 'relative', display: 'flex', color: '#64748b', cursor: 'help' }}
              onMouseEnter={e => e.currentTarget.lastChild.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.lastChild.style.opacity = '0'}
            >
              {Icons.info}
              <div style={{
                position: 'absolute', top: '100%', left: '0', marginTop: '8px',
                background: '#1e293b', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '12px',
                whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', zIndex: 100,
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontWeight: 400
              }}>
                Descriptors computed via RDKit
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {propRows.map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < propRows.length - 1 ? '1px solid rgba(45,212,212,0.06)' : 'none',
              }}>
                <span style={{ color: labelColor, fontSize: '13px', lineHeight: 1.3, whiteSpace: 'pre-line', maxWidth: '55%' }}>
                  {row.label}
                </span>
                {row.html ? (
                  <span
                    dangerouslySetInnerHTML={{ __html: row.value || '—' }}
                    style={{ color: '#fff', fontSize: '14px', fontWeight: 500, fontFamily: 'monospace', textAlign: 'right' }}
                  />
                ) : (
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500, fontFamily: 'monospace', textAlign: 'right' }}>
                    {row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ──── COLUMN 3: Sidebar Cards (~27%) ──── */}
        <div style={{ gridColumn: '3 / 4', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ─ Current Molecule Card ─ */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: '0 0 12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Current Molecule
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                width: '100px', height: '80px',
                background: '#081214', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(45,212,212,0.08)', flexShrink: 0, overflow: 'hidden',
              }}>
                {currentMolecule?.thumbnailSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: currentMolecule.thumbnailSvg }}
                    style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '4px',
                      filter: 'invert(0.85) hue-rotate(180deg) brightness(1.2)',
                    }}
                  />
                ) : (
                  <span style={{ color: '#475569', fontSize: '10px', fontStyle: 'italic' }}>No molecule</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', minWidth: 0 }}>
                <div
                  dangerouslySetInnerHTML={{ __html: currentMolecule?.formulaHtml || '-' }}
                  style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 500, fontSize: '15px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.3 }}>Molecular Weight</span>
                  <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 500, fontSize: '14px', lineHeight: 1.3 }}>
                    {currentMolecule?.mw && currentMolecule.mw !== '-' ? `${currentMolecule.mw} g/mol` : '-'}
                  </span>
                </div>
                {currentMolecule?.lastEdited && currentMolecule.lastEdited !== '-' && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px', lineHeight: 1.3 }}>Last Edited</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.3 }}>{currentMolecule.lastEdited}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─ ML Predictions Card ─ */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ color: accentColor, display: 'flex' }}>{Icons.brain}</span>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif', flex: 1 }}>
                ML Predictions
              </h3>
              <div 
                style={{ position: 'relative', display: 'flex', color: '#64748b', cursor: 'help' }}
                onMouseEnter={e => e.currentTarget.lastChild.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.lastChild.style.opacity = '0'}
              >
                {Icons.info}
                <div style={{
                  position: 'absolute', top: '100%', right: '0', marginTop: '8px',
                  background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                  width: '220px', lineHeight: 1.4, opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', zIndex: 100,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontWeight: 400
                }}>
                  Predictions from trained ML models. Only models with available weights show real confidence scores.
                </div>
              </div>
            </div>

            {predLoading ? (
              <div style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>Loading predictions...</div>
            ) : predictions.length === 0 && !canonicalSmiles ? (
              <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>Load a molecule to see predictions.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {predictions.map((pred, i) => {
                  const colors = getBadgeColors(pred.status_label)
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
                          {pred.endpoint_name}
                        </span>
                        {pred.available ? (
                          <span style={{
                            fontSize: '11px', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '4px',
                            background: colors.bg, color: colors.color,
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
                      </div>
                      {pred.available && pred.confidence !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            flex: 1, height: '6px', borderRadius: '3px',
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.round(pred.confidence * 100)}%`,
                              height: '100%', borderRadius: '3px',
                              background: colors.barColor,
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <span style={{ color: colors.color, fontSize: '12px', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                            {Math.round(pred.confidence * 100)}%
                          </span>
                        </div>
                      ) : pred.available === false ? (
                        <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.03)', marginTop: '2px' }} />
                      ) : null}

                      {/* Phase 13: Suggest Fix button for High Risk predictions */}
                      {pred.status_label === 'High Risk' && (
                        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                          {!remediationResults[pred.endpoint_name] && !remediationLoading[pred.endpoint_name] && (
                            <button
                              onClick={() => handleRemediate(pred)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(45,212,212,0.1)', color: accentColor,
                                border: `1px solid rgba(45,212,212,0.3)`,
                                borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                              onMouseOver={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.2)' }}
                              onMouseOut={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.1)' }}
                            >
                              {Icons.code} Suggest a Fix
                            </button>
                          )}
                          
                          {remediationLoading[pred.endpoint_name] && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid rgba(45,212,212,0.3)', borderTopColor: accentColor, animation: 'spin 1s linear infinite' }} />
                              Searching for structural fixes...
                            </div>
                          )}

                          {remediationResults[pred.endpoint_name] && (
                            <div style={{
                              marginTop: '6px', background: 'rgba(0,0,0,0.2)', 
                              border: '1px solid rgba(45,212,212,0.2)', borderRadius: '6px', padding: '10px'
                            }}>
                              {remediationResults[pred.endpoint_name].error ? (
                                <div style={{ color: '#f87171', fontSize: '12px' }}>{remediationResults[pred.endpoint_name].error}</div>
                              ) : remediationResults[pred.endpoint_name].found ? (
                                <div>
                                  <div style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '6px', lineHeight: 1.4 }}>
                                    <strong>Suggested Fix:</strong> {remediationResults[pred.endpoint_name].transforms_applied.join(' + ')}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', lineHeight: 1.4 }}>
                                    {remediationResults[pred.endpoint_name].explanation}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button
                                      onClick={() => handleLoadSmiles(remediationResults[pred.endpoint_name].remediated_smiles)}
                                      style={{
                                        background: accentColor, color: '#000', border: 'none',
                                        borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Apply to Editor
                                    </button>
                                    <span style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', maxWidth: '120px', textAlign: 'right' }}>
                                      Computational suggestion for further validation
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No structural fix found within search limits.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─ Phase 16: Synthesizability Card ─ */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ color: accentColor, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </span>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, fontFamily: 'Inter, system-ui, sans-serif', flex: 1 }}>
                Synthesizability
              </h3>
              <div 
                style={{ position: 'relative', display: 'flex', color: '#64748b', cursor: 'help' }}
                onMouseEnter={e => e.currentTarget.lastChild.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.lastChild.style.opacity = '0'}
              >
                {Icons.info}
                <div style={{
                  position: 'absolute', top: '100%', right: '0', marginTop: '8px',
                  background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                  width: '240px', lineHeight: 1.4, opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', zIndex: 100,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontWeight: 400
                }}>
                  SA_Score (Ertl & Schuffenhauer, 2009). 1 = easy, 10 = very difficult. Reactive group flags indicate synthesis-relevant hazards.
                </div>
              </div>
            </div>

            {synthLoading ? (
              <div style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>Assessing synthesis feasibility...</div>
            ) : !synthData && !canonicalSmiles ? (
              <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>Load a molecule to assess.</div>
            ) : synthData ? (
              <div>
                {/* SA_Score display */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: labelColor, fontSize: '13px' }}>SA_Score</span>
                    <div style={{ color: '#fff', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {synthData.sa_score}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: 600,
                    padding: '4px 12px', borderRadius: '6px',
                    background: synthData.difficulty_label === 'easy'
                      ? 'rgba(34,197,94,0.15)'
                      : synthData.difficulty_label === 'moderate'
                        ? 'rgba(251,191,36,0.15)'
                        : 'rgba(239,68,68,0.15)',
                    color: synthData.difficulty_label === 'easy'
                      ? '#4ade80'
                      : synthData.difficulty_label === 'moderate'
                        ? '#fbbf24'
                        : '#f87171',
                  }}>
                    {synthData.difficulty_label.charAt(0).toUpperCase() + synthData.difficulty_label.slice(1)}
                  </span>
                </div>

                {/* Score bar */}
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{
                    width: `${Math.min(synthData.sa_score / 10 * 100, 100)}%`,
                    height: '100%', borderRadius: '3px',
                    background: synthData.difficulty_label === 'easy'
                      ? '#4ade80'
                      : synthData.difficulty_label === 'moderate'
                        ? '#fbbf24'
                        : '#f87171',
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Reactive group flags */}
                {synthData.reactive_group_flags && synthData.reactive_group_flags.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ color: labelColor, fontSize: '12px', display: 'block', marginBottom: '6px' }}>Reactive Groups Detected</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {synthData.reactive_group_flags.map((flag, i) => (
                        <div
                          key={i}
                          style={{ position: 'relative' }}
                          onMouseEnter={e => { const tip = e.currentTarget.querySelector('.synth-tip'); if (tip) tip.style.opacity = '1' }}
                          onMouseLeave={e => { const tip = e.currentTarget.querySelector('.synth-tip'); if (tip) tip.style.opacity = '0' }}
                        >
                          <span style={{
                            fontSize: '11px', fontWeight: 600,
                            padding: '3px 8px', borderRadius: '4px',
                            background: 'rgba(239,68,68,0.12)',
                            color: '#f87171',
                            cursor: 'help',
                          }}>
                            {flag.name}{flag.count > 1 ? ` ×${flag.count}` : ''}
                          </span>
                          <div className="synth-tip" style={{
                            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                            marginBottom: '6px', background: '#1e293b', color: '#e2e8f0',
                            padding: '6px 10px', borderRadius: '4px', fontSize: '11px',
                            whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s',
                            pointerEvents: 'none', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                          }}>
                            {flag.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caveat */}
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>
                  Computational estimate for planning purposes
                </div>
              </div>
            ) : (
              <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>Could not assess synthesizability.</div>
            )}
          </div>

          {/* ─ Report Generation Card ─ */}
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
            }}>
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

          {/* ─ Save and Exit ─ */}
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

      {/* ── BOTTOM SMILES BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '56px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%', borderRadius: '8px 0 0 8px', overflow: 'hidden', padding: '0 16px', gap: '8px', border: '1px solid rgba(45,212,212,0.15)', borderRight: 'none', background: '#0d1a1c' }}>
          <span style={{ color: '#64748b', display: 'flex' }}>{Icons.code}</span>
          <input
            type="text"
            value={inputSmiles}
            onChange={(e) => setInputSmiles(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadSmiles()}
            placeholder="Enter SMILES (e.g. CC(=O)OC1=CC=CC=C1)"
            style={{ flex: 1, background: 'transparent', fontSize: '14px', color: '#fff', border: 'none', outline: 'none', fontFamily: 'monospace', height: '100%' }}
          />
          {inputSmiles && (
            <button onClick={handleClearSmiles} style={{ padding: '0 8px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#64748b'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <button
          onClick={handleLoadSmiles}
          style={{ padding: '0 32px', height: '100%', fontWeight: 700, fontSize: '14px', borderRadius: '0 8px 8px 0', border: 'none', cursor: 'pointer', background: accentColor, color: '#000', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 0.2s', minWidth: '90px' }}
          onMouseEnter={e => e.target.style.opacity = '0.85'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >Load</button>
      </div>
    </>
  )
}
