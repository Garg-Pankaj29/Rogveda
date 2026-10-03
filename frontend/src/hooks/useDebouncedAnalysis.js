/**
 * ROGVEDA — useDebouncedAnalysis Hook (Phase 11)
 *
 * Provides debounced backend analysis with AbortController support.
 * - Client-side RDKit validation stays instant (handled by polling loop).
 * - Backend calls (/predict-all, /similar, /ai-summary) fire only after
 *   the user stops editing for `delay` ms.
 * - Any in-flight request is aborted when a new edit arrives, preventing
 *   stale/out-of-order data from showing up.
 */

import { useRef, useEffect, useCallback, useState } from 'react'

/**
 * @param {string} canonicalSmiles - Current canonical SMILES string
 * @param {object} currentMolecule - Current molecule properties (for AI summary)
 * @param {object} api - The apiClient module
 * @param {Function} addNotification - Notification push function
 * @param {number} delay - Debounce delay in ms (default 300)
 * @returns {{ bgAiData, bgAiReady, isAnalyzing }}
 */
export default function useDebouncedAnalysis(
  canonicalSmiles,
  currentMolecule,
  api,
  addNotification,
  delay = 2000,
) {
  // Refs for persistent state across renders
  const bgAiData = useRef({ predictions: [], aiSummary: null, similarityHits: [], drugLikeness: {} })
  const bgAiSmiles = useRef('')
  const timerRef = useRef(null)
  const abortRef = useRef(null)

  // React state
  const [bgAiReady, setBgAiReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Snapshot currentMolecule into a ref so the async callback always reads
  // the latest value without triggering effect re-runs.
  const molRef = useRef(currentMolecule)
  useEffect(() => { molRef.current = currentMolecule }, [currentMolecule])

  useEffect(() => {
    // Nothing to do if SMILES is empty or unchanged
    if (!canonicalSmiles || canonicalSmiles === bgAiSmiles.current) return
    bgAiSmiles.current = canonicalSmiles
    setBgAiReady(false)

    // ── Cancel any pending debounce timer ──
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // ── Abort any in-flight backend request ──
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    // ── Debounce: wait `delay` ms, then fire ──
    timerRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      const { signal } = controller

      setIsAnalyzing(true)

      const computeBackground = async () => {
        try {
          const smiles = canonicalSmiles // capture for closure safety

          // 1. ML predictions
          let preds = []
          try {
            const data = await api.post('/api/molecule/predict-all', { smiles }, { signal })
            preds = Array.isArray(data) ? data : []
          } catch (e) {
            if (e.name === 'AbortError') return // silently exit on abort
            console.error('BG predict-all failed:', e)
          }

          // Check abort between sequential calls
          if (signal.aborted) return

          // 2. Similarity search
          let simHits = []
          try {
            const data = await api.post('/api/molecule/similar', {
              smiles, top_n: 6, threshold: 0.0, metric: 'tanimoto_ecfp4',
            }, { signal })
            simHits = data.hits || []
          } catch (e) {
            if (e.name === 'AbortError') return
            console.error('BG similarity failed:', e)
          }

          if (signal.aborted) return

          // 3. AI summary (depends on predictions)
          let aiSummary = null
          try {
            const props = molRef.current || {}
            const data = await api.post('/api/molecule/ai-summary', {
              smiles,
              properties: {
                formula: props.formula || '-', mw: props.mw || '-', logP: props.logP || '-',
                tpsa: props.tpsa || '-', hbd: props.hbd || '-', hba: props.hba || '-',
                rotBonds: props.rotBonds || '-', aromaticRings: props.aromaticRings || '-',
                heavyAtoms: props.heavyAtoms || '-',
              },
              predictions: preds,
            }, { signal })
            aiSummary = data
          } catch (e) {
            if (e.name === 'AbortError') return
            console.error('BG ai-summary failed:', e)
          }

          if (signal.aborted) return

          // 4. Drug-likeness rules (computed from properties — fully client-side)
          const dlRules = {}
          const mol = molRef.current || {}
          const mw = parseFloat(mol.mw) || null
          const logP = parseFloat(mol.logP) || null
          const hbd = parseInt(mol.hbd) || null
          const hba = parseInt(mol.hba) || null
          const tpsa = parseFloat(mol.tpsa) || null
          const rotBonds = parseInt(mol.rotBonds) || null

          if (mw !== null && logP !== null && hbd !== null && hba !== null) {
            const lipViolations = [mw > 500, logP > 5, hbd > 5, hba > 10].filter(Boolean).length
            dlRules['Lipinski Rule of 5'] = { passed: lipViolations <= 1, violations: lipViolations }
          }
          if (tpsa !== null && rotBonds !== null) {
            const veberOk = tpsa <= 140 && rotBonds <= 10
            dlRules['Veber Rules'] = { passed: veberOk, violations: veberOk ? 0 : 1 }
          }

          // Store results
          bgAiData.current = { predictions: preds, aiSummary, similarityHits: simHits, drugLikeness: dlRules }
          setBgAiReady(true)
          setIsAnalyzing(false)

          // Push notification
          if (aiSummary && aiSummary.summary && !aiSummary.summary.includes('not available')) {
            addNotification('AI Insights Ready', 'Background AI analysis for your molecule is complete. Generate a report to include full insights.')
          } else {
            addNotification('Analysis Complete', 'ML predictions and similarity search are ready. AI insights require LM Studio.')
          }
        } catch (e) {
          if (e.name === 'AbortError') return
          console.error('Background AI computation failed:', e)
          setIsAnalyzing(false)
        }
      }

      computeBackground()
    }, delay)

    // Cleanup on unmount or next effect run
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [canonicalSmiles, delay]) // eslint-disable-line react-hooks/exhaustive-deps

  return { bgAiData, bgAiReady, isAnalyzing }
}
