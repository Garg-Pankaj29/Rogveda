import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import KetcherEditor from '../components/KetcherEditor'
import Viewer3D from '../components/Viewer3D'
import api from '../lib/apiClient'
import TopNav from '../components/TopNav'
import MolecularSidebar from '../components/MolecularSidebar'
import AnalysisTab from '../components/AnalysisTab'
import SimilarityTab from '../components/SimilarityTab'
import ModificationTab from '../components/ModificationTab'
import CompareTab from '../components/CompareTab'
import PredictionTab from '../components/PredictionTab'
import ChemicalSpaceTab from '../components/ChemicalSpaceTab'
import BatchScreening from './BatchScreening'
import { computeProperties } from '../lib/chemistry'
import { experimentService } from '../lib/experimentService'
import { addHistory, addNotification } from '../lib/events'
import useDebouncedAnalysis from '../hooks/useDebouncedAnalysis'

/**
 * Safely loads a molecule into Ketcher by ensuring the iframe has rendered
 * dimensions first. If we call setMolecule() while the container is 0x0
 * (e.g., right after switching to the Draw tab from another tab), Ketcher's 
 * internal zoomAccordingContent() calculates a 10% zoom and centerStruct() 
 * moves the molecule to (0,0) (top-left).
 * 
 * We deterministically wait for clientWidth > 0 before loading and then
 * apply the verified Redux zoom fix.
 */
async function loadMoleculeWhenReady(ketcherRef, molData) {
  try {
    // If the Ketcher container is always laid out (using visibility:hidden instead of display:none),
    // we don't need any complex polling loops or timeouts. Ketcher's native resize handler 
    // will already have the correct viewBox dimensions when this is called.
    
    // 1. Force Ketcher to re-read its container size just in case the window resized
    if (typeof ketcherRef.current?.forceResize === 'function') {
      ketcherRef.current.forceResize()
    }
    
    // 2. Load the molecule normally
    await ketcherRef.current.setMolecule(molData)

    const k = ketcherRef.current?.getKetcherInstance?.()
    if (!k || !k.editor) return

    // 3. Enforce 100% zoom and center ONCE
    k.editor.zoom(1)
    if (k.editor.event?.zoomChanged?.dispatch) {
      k.editor.event.zoomChanged.dispatch()
    }
    k.editor.centerStruct()

  } catch (e) {
    console.warn('loadMoleculeWhenReady: Could not load/reset zoom:', e)
  }
}
/* ══════════════════════════════════════════════
   SVG ICON HELPERS (inline, no emoji)
   ══════════════════════════════════════════════ */

const I = {
  // Tab icons
  drawTab: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
  analysis: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  modify: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="12" r="3" /><line x1="8.7" y1="7.5" x2="15.3" y2="10.5" /><line x1="8.7" y1="16.5" x2="15.3" y2="13.5" /></svg>,
  compare: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" /><path d="M13 2h4a2 2 0 0 1 2 2v4" /><path d="M2 13v4a2 2 0 0 0 2 2h4" /></svg>,
  predict: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></svg>,
  chemSpace: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" strokeDasharray="4 4" /><circle cx="12" cy="12" r="3" /><circle cx="7" cy="8" r="1.5" fill="currentColor" /><circle cx="16" cy="7" r="1.5" fill="currentColor" /><circle cx="17" cy="15" r="1.5" fill="currentColor" /><circle cx="8" cy="16" r="1.5" fill="currentColor" /></svg>,
  layers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>,
  // Sub-toolbar icons
  sun: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  moon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  fileNew: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
  folderOpen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  save: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  code: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
}

/* ══════════════════════════════════════════════
   HELPER: Parse molecular formula into subscripted HTML
   e.g. "C9H11NO2" => "C<sub>9</sub>H<sub>11</sub>NO<sub>2</sub>"
   ══════════════════════════════════════════════ */
function formulaToHtml(formula) {
  if (!formula || formula === '-') return '-'
  return formula.replace(/(\d+)/g, '<sub>$1</sub>')
}



/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function MoleculeDraw() {
  const [user, setUser] = useState(null)
  const [rdkit, setRdkit] = useState(null)
  const [isKetcherReady, setIsKetcherReady] = useState(false)

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('rogveda_active_tab') || 'Draw')
  const activeTabRef = useRef(activeTab)
  const pendingMolfile = useRef(null) // Stores molfile to load when Draw tab becomes visible
  
  useEffect(() => {
    localStorage.setItem('rogveda_active_tab', activeTab)
    activeTabRef.current = activeTab
  }, [activeTab])

  // When Draw tab becomes visible, load any pending molecule into Ketcher
  useEffect(() => {
    if (activeTab === 'Draw' && pendingMolfile.current && ketcherRef.current && isKetcherReady) {
      const molfile = pendingMolfile.current
      pendingMolfile.current = null
      ;(async () => {
        try {
          await loadMoleculeWhenReady(ketcherRef, molfile)
        } catch (e) {
          console.error('Failed to load pending molecule:', e)
        }
      })()
    }
  }, [activeTab, isKetcherReady])

  const [theme, setTheme] = useState('light')
  const [currentMolecule, setCurrentMolecule] = useState({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
  const [recentActivity, setRecentActivity] = useState([{ action: 'Workspace opened', timestamp: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }])
  const [activeExpName, setActiveExpName] = useState(null)

  const logActivity = useCallback((action) => {
    const ts = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    setRecentActivity(prev => [{ action, timestamp: ts }, ...prev].slice(0, 15))
    // Also push to global history
    addHistory(action)
  }, [])

  const [canonicalSmiles, setCanonicalSmiles] = useState('')
  const [sdfBlock, setSdfBlock] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [is3dLoading, setIs3dLoading] = useState(false)

  const [show3d, setShow3d] = useState(false)

  const ketcherRef = useRef(null)
  const [inputSmiles, setInputSmiles] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const expId = new URLSearchParams(location.search).get('expId')
  const isNew = new URLSearchParams(location.search).get('new') === 'true'
  const initialLoadDone = useRef(false)

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const last3dSmiles = useRef('')

  // ── Background AI insight data (computed on molecule change, debounced) ──
  const { bgAiData, bgAiReady, isAnalyzing } = useDebouncedAnalysis(
    canonicalSmiles, currentMolecule, api, addNotification, 300
  )

  const handleKetcherLoad = () => {
    setIsKetcherReady(true)
  }

  useEffect(() => {
    if (window.initRDKitModule) {
      window.initRDKitModule()
        .then((RDKitModule) => {
          setRdkit(RDKitModule)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error("Failed to initialize RDKit:", err)
          setError("Could not load RDKit backend.")
          setIsLoading(false)
        })
    } else {
      setError("RDKit script not found in index.html.")
      setIsLoading(false)
    }
    api.get('/api/auth/me').then(setUser).catch(console.error)
  }, [])

  // Poll Ketcher for changes — update formula, MW, thumbnail
  useEffect(() => {
    if (!rdkit || !isKetcherReady || !ketcherRef.current) return
    let isPolling = true
    let lastSmiles = ''

    const pollKetcher = async () => {
      if (!isPolling) return
      try {
        // Initial load of saved experiment or autosave
        if (!initialLoadDone.current) {
          initialLoadDone.current = true // Set immediately to prevent race conditions in setInterval

          if (isNew) {
            // Clear autosave and start fresh
            try { localStorage.removeItem('rogveda_autosave') } catch (err) { }
            setActiveExpName(null)
            await ketcherRef.current.setMolecule('')
            window.history.replaceState({}, document.title, '/draw')
            return
          }

          if (expId) {
            try {
              const exps = experimentService.getLocalExperiments() // Quick sync check for immediate load
              const exp = exps.find(e => e.id === expId)
              if (exp && exp.molfile) {
                setActiveExpName(exp.name)
                if (activeTabRef.current === 'Draw') {
                  await loadMoleculeWhenReady(ketcherRef, exp.molfile)
                } else {
                  pendingMolfile.current = exp.molfile
                }
                // Also update autosave so refresh retains this molecule
                localStorage.setItem('rogveda_autosave', exp.molfile)
                localStorage.setItem('rogveda_autosave_expId', expId)
                return
              }
            } catch (err) {
              console.error("Error loading experiment:", err)
            }
          } else {
            // Restore autosave + experiment context on plain /draw refresh
            try {
              const savedExpId = localStorage.getItem('rogveda_autosave_expId')
              if (savedExpId) {
                const exps = experimentService.getLocalExperiments()
                const exp = exps.find(e => e.id === savedExpId)
                if (exp) setActiveExpName(exp.name)
              }
              const autosave = localStorage.getItem('rogveda_autosave')
              if (autosave) {
                if (activeTabRef.current === 'Draw') {
                  await loadMoleculeWhenReady(ketcherRef, autosave)
                } else {
                  pendingMolfile.current = autosave
                }
                return
              }
            } catch (err) { }
          }
        }

        let molfile = null
        try {
          molfile = await ketcherRef.current.getMolfile()
        } catch (err) {
          return // Ignore intermittent Ketcher errors and retry next tick
        }

        if (!molfile || molfile.length < 50) {
          if (lastSmiles !== '') {
            lastSmiles = ''
            setCurrentMolecule({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
            setCanonicalSmiles('')
            setError('') // Clear error when canvas is cleared
          }
          return
        }

        const mol = rdkit.get_mol(molfile)
        if (!mol || !mol.is_valid()) {
          if (lastSmiles !== '') {
            lastSmiles = ''
            setCurrentMolecule({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
            setCanonicalSmiles('')
            setError('') // Clear error on invalid structure
          }
          if (mol) mol.delete()
          return
        }

        const smiles = mol.get_smiles()
        if (!smiles) {
          if (lastSmiles !== '') {
            lastSmiles = ''
            setCurrentMolecule({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
            setCanonicalSmiles('')
            setError('') // Clear error
          }
          mol.delete()
          return
        }

        if (smiles === lastSmiles) {
          mol.delete()
          return
        }
        lastSmiles = smiles
        setError('') // Clear error on new valid molecule

        // Update the canonical smiles so AnalysisTab refetches predictions
        setCanonicalSmiles(smiles)

        // Compute full properties
        const props = computeProperties(rdkit, smiles) || {}
        const mw = props.mw || '-'
        const formula = props.formula || '-'


        // Thumbnail SVG
        let thumbnailSvg = ''
        try {
          thumbnailSvg = mol.get_svg(200, 160)
          // Make background transparent and lines slightly thicker/better colored for dark mode
          thumbnailSvg = thumbnailSvg.replace(/<rect[^>]*fill=['"]#FFFFFF['"][^>]*>/i, '<rect opacity="0" fill="none" />')
          thumbnailSvg = thumbnailSvg.replace(/stroke-width:1\.0px/g, 'stroke-width:2.0px')
        } catch (e) {
          try { thumbnailSvg = mol.get_svg() } catch (e2) { }
        }

        const ts = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })

        // Always autosave current work so refresh never loses it
        // This MUST be outside the React state updater to guarantee it fires
        localStorage.setItem('rogveda_autosave', molfile)

        setCurrentMolecule(prev => {
          const changed = prev.mw !== mw || prev.formula !== formula
          if (changed) {
            logActivity('Structure edited')
          }
          return { formula, mw, ...props, formulaHtml: formulaToHtml(formula), lastEdited: ts, thumbnailSvg }
        })

        mol.delete()
      } catch (e) {
        console.error("Error in Ketcher polling loop:", e)
      } finally {
        if (isPolling) {
          setTimeout(pollKetcher, 1000)
        }
      }
    }

    // Start polling
    pollKetcher()

    return () => { isPolling = false }
  }, [rdkit, isKetcherReady, logActivity])

  // ── Background AI insight computation ──
  // Now handled by useDebouncedAnalysis hook (Phase 11).
  // The hook debounces backend calls by 300ms and uses AbortController
  // to cancel in-flight requests when new edits arrive.

  // Generate SMILES
  const handleGenerateSmiles = async () => {
    if (!rdkit || !ketcherRef.current) return
    setError('')
    let mol = null
    try {
      const molblock = await ketcherRef.current.getMolfile()
      if (!molblock || molblock.trim() === '') {
        setError('Canvas is empty. Please draw a molecule first.')
        return
      }
      mol = rdkit.get_mol(molblock)
      if (!mol || !mol.is_valid()) {
        setError('Invalid structure.')
        return
      }
      const smiles = mol.get_smiles()
      setCanonicalSmiles(smiles)
      setInputSmiles(smiles)
      logActivity('Generated SMILES: ' + smiles)
    } catch (err) {
      setError('Error: ' + err.message)
    } finally {
      if (mol) mol.delete()
    }
  }

  const handleGenerate3D = async () => {
    if (!rdkit || !ketcherRef.current) return
    let mol = null
    let latestSmiles = ''
    try {
      const molblock = await ketcherRef.current.getMolfile()
      if (!molblock || molblock.trim() === '') { setError('Canvas is empty.'); return }
      mol = rdkit.get_mol(molblock)
      if (!mol || !mol.is_valid()) { setError('Invalid structure.'); return }
      latestSmiles = mol.get_smiles()

      setCanonicalSmiles(latestSmiles)
      setInputSmiles(latestSmiles)
    } catch (e) {
      setError('Error: ' + e.message)
      return
    } finally {
      if (mol) mol.delete()
    }

    if (!latestSmiles) { setError('Generate a SMILES first.'); return }

    // Check if we already generated the 3D model for this EXACT molecule
    if (latestSmiles === last3dSmiles.current && sdfBlock) {
      setShow3d(true)
      return
    }

    setError('')
    setIs3dLoading(true)
    try {
      const response = await api.post('/api/molecule/3d', { smiles: latestSmiles })
      setSdfBlock(response.sdf_block)
      last3dSmiles.current = latestSmiles
      setShow3d(true)
      logActivity('3D model generated')
    } catch (err) {
      setError('3D generation failed: ' + (err.message || 'Unknown error'))
    } finally {
      setIs3dLoading(false)
    }
  }

  const handleLoadSmiles = async (smilesToLoad) => {
    const targetSmiles = (typeof smilesToLoad === 'string' ? smilesToLoad : inputSmiles).trim()
    if (!ketcherRef.current || !targetSmiles) return
    try {
      if (rdkit) {
        const tempMol = rdkit.get_mol(targetSmiles)
        if (!tempMol || !tempMol.is_valid()) {
          setError('Invalid SMILES input. Please check your syntax.')
          if (tempMol) tempMol.delete()
          return
        }
        tempMol.delete()
      }
      await loadMoleculeWhenReady(ketcherRef, targetSmiles)
      setError('')
      logActivity('Molecule loaded from SMILES')
    } catch (err) {
      setError('Could not load SMILES: ' + err.message)
    }
  }

  const handleClearSmiles = () => {
    setInputSmiles('')
  }

  const handleNew = () => {
    if (ketcherRef.current) ketcherRef.current.setMolecule('')
    setCanonicalSmiles('')
    setSdfBlock('')
    setShow3d(false)
    setInputSmiles('')
    setCurrentMolecule({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
    setActiveExpName(null)
    localStorage.removeItem('rogveda_autosave')
    localStorage.removeItem('rogveda_autosave_expId')
    logActivity('New molecule created')
  }

  const handleClear = () => {
    if (ketcherRef.current) ketcherRef.current.setMolecule('')
    setCurrentMolecule({ formula: '-', formulaHtml: '-', mw: '-', lastEdited: '-', thumbnailSvg: '' })
    setCanonicalSmiles('')
    setSdfBlock('')
    setShow3d(false)
    setActiveExpName(null)
    localStorage.removeItem('rogveda_autosave')
    localStorage.removeItem('rogveda_autosave_expId')
    logActivity('Canvas cleared')
  }

  const handleSaveOnly = async (isModification = false) => {
    try {
      const molfile = await ketcherRef.current.getMolfile()
      
      let currentExpId = expId || localStorage.getItem('rogveda_autosave_expId')
      let parentDbId = localStorage.getItem('rogveda_autosave_dbId')
      let newName = `Experiment ${new Date().toLocaleString()}`
      let nameToSave = activeExpName || newName

      if (isModification) {
        // Create a new experiment ID, link it to the parent
        currentExpId = Date.now().toString()
        nameToSave = `${activeExpName ? activeExpName + ' (Mod)' : newName}`
      }
      
      const expData = {
        id: currentExpId || Date.now().toString(),
        name: nameToSave,
        molfile,
        original_smiles: canonicalSmiles || undefined,
        date: new Date().toISOString()
      }

      // If it's a modification and we know the parent's DB ID, save it
      if (isModification && parentDbId) {
        expData.parent_experiment_id = parseInt(parentDbId, 10)
      } else if (!isModification) {
        // If not a modification, preserve existing parent_experiment_id if any (handled by backend mostly, but frontend can pass it)
        const allExps = experimentService.getLocalExperiments()
        const existing = allExps.find(e => e.id === currentExpId)
        if (existing && existing.parent_experiment_id) {
          expData.parent_experiment_id = existing.parent_experiment_id
        }
      }

      await experimentService.saveExperiment(expData)
      
      localStorage.setItem('rogveda_autosave_expId', expData.id)
      setActiveExpName(expData.name)
      localStorage.setItem('rogveda_autosave', molfile)
      
      // Update dbId in local storage after save so future saves overwrite this new one
      // We don't have the db_id immediately from local save until it syncs, but it'll sync instantly if online
      const synced = await experimentService.syncExperiments()
      const savedExp = synced.find(e => e.id === expData.id)
      if (savedExp && savedExp.db_id) {
        localStorage.setItem('rogveda_autosave_dbId', savedExp.db_id.toString())
      }

      logActivity(isModification ? 'Saved as modification' : 'Experiment saved')
      addNotification('Experiment Saved', `Saved "${nameToSave}" successfully.`)
    } catch (e) {
      console.error("Failed to save experiment:", e)
    }
  }

  const handleSaveExperiment = async () => {
    await handleSaveOnly()
    navigate('/home')
  }

  const handleGenerateReport = async (format = 'Comprehensive Report (PDF)') => {
    if (format === 'Data Export (CSV)') {
      const csvRows = [
        ['Property', 'Value'],
        ['SMILES Notation', canonicalSmiles || inputSmiles || 'Data yet to be calculated'],
        ['Molecular Formula', currentMolecule.formula || 'Data yet to be calculated'],
        ['Molecular Weight', currentMolecule.mw && currentMolecule.mw !== '-' ? currentMolecule.mw + ' g/mol' : 'Data yet to be calculated'],
        ['Exact Mass', currentMolecule.exactMass && currentMolecule.exactMass !== '-' ? currentMolecule.exactMass + ' Da' : 'Data yet to be calculated'],
        ['LogP (Crippen)', currentMolecule.logP || 'Data yet to be calculated'],
        ['TPSA', currentMolecule.tpsa && currentMolecule.tpsa !== '-' ? currentMolecule.tpsa + ' Å²' : 'Data yet to be calculated'],
        ['H-Bond Donors', currentMolecule.hbd || 'Data yet to be calculated'],
        ['H-Bond Acceptors', currentMolecule.hba || 'Data yet to be calculated'],
        ['Rotatable Bonds', currentMolecule.rotBonds || 'Data yet to be calculated'],
        ['Total Rings', currentMolecule.totalRings || 'Data yet to be calculated'],
        ['Aromatic Rings', currentMolecule.aromaticRings || 'Data yet to be calculated'],
        ['Heavy Atoms', currentMolecule.heavyAtoms || 'Data yet to be calculated'],
        ['Heteroatoms', currentMolecule.heteroAtoms || 'Data yet to be calculated'],
        ['Fraction Csp³', currentMolecule.fractionCsp3 || 'Data yet to be calculated'],
        ['Molar Refractivity', currentMolecule.molarRefractivity || 'Data yet to be calculated'],
        ['Chiral Centers', currentMolecule.chiralCenters || 'Data yet to be calculated'],
        ['Last Edited', currentMolecule.lastEdited || '-'],
      ]

      // Add predictions
      const bgPreds = bgAiData.current.predictions || []
      csvRows.push(['', ''])
      csvRows.push(['--- ML Predictions ---', ''])
      if (bgPreds.length > 0) {
        bgPreds.forEach(p => {
          csvRows.push([p.endpoint_name, p.available ? `${p.status_label} (${Math.round((p.confidence || 0) * 100)}%)` : 'Data yet to be calculated'])
        })
      } else {
        csvRows.push(['All endpoints', 'Data yet to be calculated'])
      }

      // Add similarity hits
      const bgSim = bgAiData.current.similarityHits || []
      csvRows.push(['', ''])
      csvRows.push(['--- Similarity Hits ---', ''])
      if (bgSim.length > 0) {
        bgSim.forEach((h, i) => {
          csvRows.push([`Hit ${i+1}: ${h.name}`, `Tanimoto: ${h.tanimoto}`])
        })
      } else {
        csvRows.push(['Similar molecules', 'Data yet to be calculated'])
      }

      // Add AI Summary
      const bgSummary = bgAiData.current.aiSummary || {}
      csvRows.push(['', ''])
      csvRows.push(['--- AI Summary ---', ''])
      if (bgSummary.summary && bgSummary.summary !== "Local AI not available — start LM Studio to generate AI insights.") {
        csvRows.push(['Summary', bgSummary.summary])
        const ki = bgSummary.key_insights || []
        ki.forEach((ins, i) => {
          csvRows.push([`Insight ${i+1}`, ins])
        })
      } else {
        csvRows.push(['Summary', 'Data yet to be calculated'])
      }

      const csvContent = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rogveda_molecular_analysis.csv'
      a.click()
      URL.revokeObjectURL(url)
      logActivity('Data exported as CSV')
      return
    }

    // ── Comprehensive Report via backend API ──
    logActivity(`Report generated (${format})`)

    // Prepare molecule SVG for the report
    let moleculeSvg = ''
    if (currentMolecule?.thumbnailSvg) {
      moleculeSvg = currentMolecule.thumbnailSvg
        .replace(/opacity="0"/g, 'opacity="1"')
        .replace(/fill="none"/g, 'fill="#fff"')
    }

    // Collect all background data
    const bg = bgAiData.current

    const reportPayload = {
      smiles: canonicalSmiles || inputSmiles || null,
      properties: {
        formula: currentMolecule.formula,
        mw: currentMolecule.mw,
        exactMass: currentMolecule.exactMass,
        logP: currentMolecule.logP,
        tpsa: currentMolecule.tpsa,
        hbd: currentMolecule.hbd,
        hba: currentMolecule.hba,
        rotBonds: currentMolecule.rotBonds,
        totalRings: currentMolecule.totalRings,
        aromaticRings: currentMolecule.aromaticRings,
        heavyAtoms: currentMolecule.heavyAtoms,
        heteroAtoms: currentMolecule.heteroAtoms,
        fractionCsp3: currentMolecule.fractionCsp3,
        molarRefractivity: currentMolecule.molarRefractivity,
        chiralCenters: currentMolecule.chiralCenters,
        amideBonds: currentMolecule.amideBonds,
        saturatedRings: currentMolecule.saturatedRings,
      },
      predictions: bg.predictions,
      ai_summary: bg.aiSummary,
      similarity_hits: bg.similarityHits,
      drug_likeness: bg.drugLikeness,
      activity_log: recentActivity,
      molecule_svg: moleculeSvg || null,
      report_format: format,
    }

    try {
      // 1. Generate report via backend
      const result = await api.post('/api/reports/generate', reportPayload)
      const htmlContent = result.html
      const reportName = result.name

      // 2. Open in print window
      const printWindow = window.open('', '', 'width=900,height=700')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
      }

      // 3. Auto-save to Saved Documents
      try {
        await api.post('/api/reports/documents', {
          name: reportName,
          format: format,
          html_content: htmlContent,
          smiles: canonicalSmiles || inputSmiles || null,
        })
        addNotification('Report Saved', `"${reportName}" has been saved to your documents.`)
      } catch (saveErr) {
        console.error('Failed to save document to DB:', saveErr)
        // Fallback to localStorage
        try {
          const docs = JSON.parse(localStorage.getItem('rogveda_documents') || '[]')
          docs.push({
            id: Date.now().toString(),
            name: reportName,
            date: new Date().toISOString(),
            format,
            content: htmlContent,
          })
          localStorage.setItem('rogveda_documents', JSON.stringify(docs))
        } catch (e) { console.error('localStorage fallback also failed:', e) }
      }
    } catch (err) {
      console.error('Report generation failed:', err)
      addNotification('Report Error', 'Failed to generate report. Please try again.')
    }
  }

  /* ─── Tab definitions (per-tab breadcrumb + tagline) ─── */
  const tabs = [
    { id: 'Draw', icon: I.drawTab, label: 'Draw', tagline: 'Design Molecules.\nDiscover Possibilities.' },
    { id: 'Analysis', icon: I.analysis, label: 'Molecular Analysis', tagline: 'Analyze Structures.\nUncover Insights.' },
    { id: 'Search', icon: I.search, label: 'Similarity Search', tagline: 'Explore Similarities.\nDiscover What\'s Next.' },
    { id: 'Modify', icon: I.modify, label: 'Molecular Modification', tagline: 'Modify Structures.\nOptimize Properties.' },
    { id: 'Compare', icon: I.compare, label: 'Compare Molecules', tagline: 'Design Molecules.\nDiscover Possibilities.' },
    { id: 'Prediction', icon: I.predict, label: 'Prediction & AI', tagline: 'Predict Properties.\nLeverage AI.' },
    { id: 'Batch', icon: I.layers, label: 'Batch Screening', tagline: 'Process Multiple.\nAnalyze at Scale.' },
    { id: 'ChemSpace', icon: I.chemSpace, label: 'Chemical Space', tagline: 'Map Your Molecule.\nExplore Drug Space.' },
  ]

  /* ─── Sub-toolbar action buttons ─── */
  const subToolbarActions = [
    { icon: I.fileNew, label: 'New', handler: handleClear },
    { icon: I.folderOpen, label: 'Open', handler: () => setShowOpenModal(true) },
    { icon: I.save, label: 'Save', handler: () => handleSaveOnly(false) },
    { 
      icon: I.modify, 
      label: 'Save as Mod', 
      handler: () => handleSaveOnly(true),
      visible: !!localStorage.getItem('rogveda_autosave_dbId') 
    },
    { icon: I.code, label: 'Get SMILES', handler: handleGenerateSmiles },
    { icon: I.clock, label: 'History', handler: () => setShowHistoryModal(true) },
    { icon: I.trash, label: 'Clear', handler: handleClear },
  ]


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050b0d' }}>
        <div style={{ color: '#2dd4d4', fontSize: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading Molecular Workspace...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{
      background: '#050b0d url("/molecular_workspace_bg.jpg") no-repeat center center fixed',
      backgroundSize: 'cover',
      paddingTop: '100px',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#ffffff',
      position: 'relative'
    }}>
      {/* Blurred overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5, 11, 13, 0.75)', backdropFilter: 'blur(12px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 50 }}>
        <TopNav user={user} />
      </div>
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1440px', margin: '0 auto', padding: '24px 32px 32px' }}>

        {/* Breadcrumbs */}
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link to="/home" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 4px' }}>&gt;</span>
          <span style={{ color: '#2dd4d4' }}>{tabs.find(t => t.id === activeTab)?.label || 'Draw'}</span>
        </div>

        {/* ── TITLE ROW ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '0.02em' }}>
                Molecular Workspace
              </h1>
              {activeExpName && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '20px', background: 'rgba(45,212,212,0.1)', border: '1px solid rgba(45,212,212,0.25)' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2dd4d4', boxShadow: '0 0 6px rgba(45,212,212,0.6)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#2dd4d4', letterSpacing: '0.03em' }}>{activeExpName}</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 20px', fontWeight: 400 }}>
              {activeExpName ? `Editing: ${activeExpName}` : 'Create, edit and visualize molecules. Switch between tools using the tabs above.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '1px', height: '32px', background: 'rgba(45,212,212,0.3)' }} />
            <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '14px', fontFamily: '"Playfair Display", Georgia, serif', color: '#2dd4d4', whiteSpace: 'pre-line' }}>
              {(tabs.find(t => t.id === activeTab)?.tagline || 'Design Molecules.\nDiscover Possibilities.').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── TAB BAR ── */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(45,212,212,0.1)', marginBottom: '20px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, justifyContent: 'center',
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 16px',
                fontSize: '14px', fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif',
                whiteSpace: 'nowrap',
                border: 'none', cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.2s',
                ...(activeTab === tab.id ? {
                  background: 'rgba(45,212,212,0.1)',
                  color: '#2dd4d4',
                  borderBottom: '2px solid #2dd4d4',
                } : {
                  background: 'transparent',
                  color: '#94a3b8',
                  borderBottom: '2px solid transparent',
                })
              }}
            >
              <span style={{ display: 'flex' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content wrapper — position:relative so Draw tab can be absolutely positioned inside */}
        <div style={{ position: 'relative' }}>

        <div style={{ display: activeTab === 'Analysis' ? 'block' : 'none' }}>
          <AnalysisTab
            rdkit={rdkit}
            ketcherRef={ketcherRef}
            currentMolecule={currentMolecule}
            canonicalSmiles={canonicalSmiles}
            setCanonicalSmiles={setCanonicalSmiles}
            sdfBlock={sdfBlock}
            setSdfBlock={setSdfBlock}
            inputSmiles={inputSmiles}
            setInputSmiles={setInputSmiles}
            show3d={show3d}
            setShow3d={setShow3d}
            is3dLoading={is3dLoading}
            setIs3dLoading={setIs3dLoading}
            error={error}
            setError={setError}
            logActivity={logActivity}
            onSaveExperiment={handleSaveExperiment}
            onGenerateReport={handleGenerateReport}
            handleLoadSmiles={handleLoadSmiles}
            handleClearSmiles={handleClearSmiles}
            last3dSmiles={last3dSmiles}
          />
        </div>

        {/* ── Similarity Search Tab ── */}
        <div style={{ display: activeTab === 'Search' ? 'block' : 'none' }}>
          <SimilarityTab
            rdkit={rdkit}
            canonicalSmiles={canonicalSmiles}
            currentMolecule={currentMolecule}
            onSaveExperiment={handleSaveExperiment}
            onGenerateReport={handleGenerateReport}
            logActivity={logActivity}
            onSwitchToDrawTab={() => setActiveTab('Draw')}
          />
        </div>

        {/* ── Molecular Modification Tab ── */}
        <div style={{ display: activeTab === 'Modify' ? 'block' : 'none' }}>
          <ModificationTab
            isActive={activeTab === 'Modify'}
            rdkit={rdkit}
            currentMolecule={currentMolecule}
            canonicalSmiles={canonicalSmiles}
            onSaveExperiment={handleSaveExperiment}
            onGenerateReport={handleGenerateReport}
            logActivity={logActivity}
          />
        </div>

        {/* ── Compare Molecules Tab ── */}
        <div style={{ display: activeTab === 'Compare' ? 'block' : 'none' }}>
          <CompareTab
            isActive={activeTab === 'Compare'}
            rdkit={rdkit}
            canonicalSmiles={canonicalSmiles}
            currentMolecule={currentMolecule}
            onSaveExperiment={handleSaveExperiment}
            onGenerateReport={handleGenerateReport}
            logActivity={logActivity}
          />
        </div>

        {/* ── Prediction & AI Tab ── */}
        <div style={{ display: activeTab === 'Prediction' ? 'block' : 'none' }}>
          <PredictionTab
            rdkit={rdkit}
            canonicalSmiles={canonicalSmiles}
            currentMolecule={currentMolecule}
            sdfBlock={sdfBlock}
            setSdfBlock={setSdfBlock}
            ketcherRef={ketcherRef}
            last3dSmiles={last3dSmiles}
            is3dLoading={is3dLoading}
            setIs3dLoading={setIs3dLoading}
            onSaveExperiment={handleSaveExperiment}
            onGenerateReport={handleGenerateReport}
            logActivity={logActivity}
            setActiveTab={setActiveTab}
          />
        </div>

        {/* ── Chemical Space Map Tab ── */}
        <div style={{ display: activeTab === 'ChemSpace' ? 'block' : 'none' }}>
          <ChemicalSpaceTab
            isActive={activeTab === 'ChemSpace'}
            canonicalSmiles={canonicalSmiles}
            currentMolecule={currentMolecule}
          />
        </div>

        {/* ── Batch Screening Tab ── */}
        <div style={{ display: activeTab === 'Batch' ? 'block' : 'none' }}>
          <BatchScreening isEmbedded={true} />
        </div>

        {activeTab !== 'Draw' && activeTab !== 'Analysis' && activeTab !== 'Search' && activeTab !== 'Modify' && activeTab !== 'Compare' && activeTab !== 'Prediction' && activeTab !== 'ChemSpace' && activeTab !== 'Batch' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid rgba(45,212,212,0.1)', background: '#0d1a1c', height: '650px' }}>
            <div style={{ textAlign: 'center' }}>
              <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#2dd4d4', opacity: 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d1d5db', marginBottom: '4px' }}>Coming Soon</h2>
              <p style={{ color: '#64748b', fontSize: '14px' }}>The <span style={{ color: '#2dd4d4' }}>{tabs.find(t => t.id === activeTab)?.label}</span> module is under development.</p>
              <div className="flex gap-2" style={{ marginTop: '16px', justifyContent: 'center' }}>
                <button
                  className="px-4 py-2 bg-[var(--r-accent)] text-black rounded hover:opacity-90 transition-opacity"
                  onClick={async () => {
                    let exps = []
                    try { exps = await experimentService.syncExperiments() } catch (e) { exps = experimentService.getLocalExperiments() }
                    
                    const existingExp = exps.find(e => e.id === currentExpId)
                    const expData = {
                      id: currentExpId || Date.now().toString(),
                      name: activeExpName || `Experiment ${new Date().toLocaleString()}`,
                      molfile: sdfBlock,
                      date: new Date().toISOString(),
                      properties_json: null,
                      predictions_json: null,
                      ai_insight: null
                    }
                    await experimentService.saveExperiment(expData)
                    setActiveExpName(expData.name)
                  }}
                >
                  Save Results
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{
          position: activeTab === 'Draw' ? 'relative' : 'absolute',
          visibility: activeTab === 'Draw' ? 'visible' : 'hidden',
          zIndex: activeTab === 'Draw' ? 1 : -1,
          opacity: activeTab === 'Draw' ? 1 : 0,
          pointerEvents: activeTab === 'Draw' ? 'auto' : 'none',
          width: '100%',
          top: 0, left: 0
        }}>
          {/* ── SUB-TOOLBAR ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', marginBottom: '20px' }}>
            {/* 2D Editor / 3D Viewer segmented toggle */}
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#050b0d' }}>
              <button
                onClick={() => setShow3d(false)}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', borderRadius: '6px',
                  transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                  ...(show3d ? { background: 'transparent', color: '#94a3b8' } : { background: '#2dd4d4', color: '#000' })
                }}
              >
                2D Editor
              </button>
              <button
                onClick={handleGenerate3D}
                disabled={is3dLoading}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: is3dLoading ? 'not-allowed' : 'pointer', borderRadius: '6px',
                  transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif',
                  opacity: is3dLoading ? 0.3 : 1,
                  ...(show3d ? { background: '#2dd4d4', color: '#000' } : { background: 'transparent', color: '#94a3b8' })
                }}
              >
                {is3dLoading ? '...' : '3D Viewer'}
              </button>
            </div>

            {/* Light/Dark theme toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
              <span style={{ color: theme === 'light' ? '#f59e0b' : '#64748b', display: 'flex', transition: 'color 0.2s', paddingRight: '2px' }}>{I.sun}</span>
              <div
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', position: 'relative',
                  cursor: 'pointer', background: theme === 'dark' ? '#0a1618' : '#cbd5e1',
                  border: theme === 'dark' ? '2px solid #00bfa5' : '2px solid #cbd5e1',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', width: '16px', height: '16px',
                  background: theme === 'dark' ? '#00bfa5' : '#fff', borderRadius: '50%',
                  boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.2s',
                  left: theme === 'dark' ? '22px' : '2px'
                }} />
              </div>
              <span style={{ color: theme === 'dark' ? '#00bfa5' : '#64748b', display: 'flex', transition: 'color 0.2s' }}>{I.moon}</span>
            </div>

            {/* Action buttons */}
            {subToolbarActions.filter(btn => btn.visible !== false).map((btn, i) => (
              <button
                key={i}
                onClick={btn.handler}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 10px', fontSize: '13px',
                  borderRadius: '6px', border: '1px solid rgba(45,212,212,0.1)',
                  background: 'rgba(255,255,255,0.02)', color: '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)'; e.currentTarget.style.color = '#2dd4d4' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94a3b8' }}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', fontSize: '13px', borderRadius: '8px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* ── MAIN TWO-COLUMN LAYOUT ── */}
          <div style={{ display: 'flex', gap: '16px', width: '100%', height: '650px', alignItems: 'stretch' }}>

            {/* LEFT: Ketcher Canvas (with its OWN native toolbars — no custom toolbar) */}
            <div style={{ flex: 1, display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)', background: '#0d1a1c', position: 'relative' }}>

              <div style={{ position: 'absolute', inset: 0, visibility: show3d ? 'hidden' : 'visible' }}>
                <KetcherEditor ref={ketcherRef} theme={theme} onLoad={handleKetcherLoad} />
              </div>

              <div style={{ position: 'absolute', inset: 0, background: '#050b0d', visibility: show3d ? 'visible' : 'hidden', zIndex: show3d ? 10 : -1 }}>
                {show3d && <Viewer3D sdfBlock={sdfBlock} height="100%" />}
              </div>

            </div>

            {/* RIGHT: Sidebar */}
            <MolecularSidebar
              currentMolecule={currentMolecule}
              recentActivity={recentActivity.slice(0, 3)}
              onGenerateReport={handleGenerateReport}
              onSaveExperiment={handleSaveExperiment}
              onViewAllActivity={() => setShowHistoryModal(true)}
              isAnalyzing={isAnalyzing}
            />
          </div>

          {/* ── BOTTOM SMILES BAR ── */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '56px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%', borderRadius: '8px 0 0 8px', overflow: 'hidden', padding: '0 16px', gap: '8px', border: '1px solid rgba(45,212,212,0.15)', borderRight: 'none', background: '#0d1a1c' }}>
              <span style={{ color: '#64748b', display: 'flex' }}>
                {I.code}
              </span>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            <button
              onClick={handleLoadSmiles}
              style={{ padding: '0 32px', height: '100%', fontWeight: 700, fontSize: '14px', borderRadius: '0 8px 8px 0', border: 'none', cursor: 'pointer', background: '#2dd4d4', color: '#000', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 0.2s', minWidth: '90px' }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Load
            </button>
          </div>
        </div>
        </div> {/* end tab content wrapper */}
      </div>


      {/* ── HISTORY MODAL ── */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(5, 11, 13, 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowHistoryModal(false)}
          />
          <div style={{ position: 'relative', width: '400px', maxHeight: '70vh', background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(45,212,212,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' }}>All Activity History</h2>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentActivity.length === 0 ? (
                <p style={{ color: '#475569', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>No activity recorded yet.</p>
              ) : (
                recentActivity.map((log, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: '#2dd4d4', boxShadow: '0 0 6px #2dd4d4' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>{log.action}</span>
                      <span style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OPEN EXPERIMENT MODAL ── */}
      {showOpenModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(5, 11, 13, 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowOpenModal(false)}
          />
          <div style={{ position: 'relative', width: '500px', maxHeight: '70vh', background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(45,212,212,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' }}>Saved Experiments</h2>
              <button onClick={() => setShowOpenModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                let exps = experimentService.getLocalExperiments()
                if (exps.length === 0) {
                  return <p style={{ color: '#475569', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>No saved experiments found.</p>
                }
                return exps.map(exp => (
                  <div key={exp.id} onClick={() => { setShowOpenModal(false); window.location.href = '/draw?expId=' + exp.id; }} style={{ padding: '12px 16px', background: 'rgba(45,212,212,0.05)', border: '1px solid rgba(45,212,212,0.15)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,212,0.05)'}>
                    <div style={{ fontSize: '15px', color: '#fff', fontWeight: 500, marginBottom: '4px' }}>{exp.name}</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>Last modified: {new Date(exp.date).toLocaleString()}</div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
