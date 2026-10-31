/**
 * ROGVEDA — Explainable Molecular Attribution Viewer (Phase 2)
 *
 * Interactive visualizer for atomic- and bond-level ML feature attributions,
 * Morgan fingerprint perturbation deltas, bit collision indicators, and
 * independent structural alert motifs (PAINS, BRENK, NIH).
 *
 * Designed to integrate seamlessly into AnalysisTab, PredictionTab, and WarRoomTab
 * without creating any new top-level tabs or standalone routes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import api from '../lib/apiClient'

const accentColor = '#2dd4d4'

const ENDPOINTS = [
  { id: 'herg', name: 'hERG Cardiotoxicity', isLiability: true },
  { id: 'tox21_mmp', name: 'Tox21 Mitochondrial Toxicity', isLiability: true },
  { id: 'antiinflammatory', name: 'Anti-inflammatory', isLiability: false },
  { id: 'antioxidant', name: 'Antioxidant', isLiability: false },
  { id: 'antimicrobial', name: 'Antimicrobial', isLiability: false },
  { id: 'anticancer', name: 'Anticancer', isLiability: false },
]

export default function AttributionViewer({
  isOpen,
  onClose,
  smiles,
  initialEndpoint = 'herg',
  title = 'Explainable Molecular Attribution',
}) {
  const [activeEndpoint, setActiveEndpoint] = useState(initialEndpoint)
  const [attributionData, setAttributionData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [hoveredAtom, setHoveredAtom] = useState(null)
  const [filterDirection, setFilterDirection] = useState('all') // 'all', 'positive', 'negative'

  // Sync initial endpoint when opened
  useEffect(() => {
    if (initialEndpoint) {
      setActiveEndpoint(initialEndpoint)
    }
  }, [initialEndpoint, isOpen])

  // Fetch attribution data whenever smiles or activeEndpoint changes
  const fetchAttribution = useCallback(async (smi, ep) => {
    if (!smi || !ep) return
    setIsAttributionDataStale(true)
    setIsLoading(true)
    setErrorMessage('')
    setAttributionData(null)

    try {
      const data = await api.post('/api/molecule/attribution', {
        smiles: smi,
        endpoint: ep,
      })
      setAttributionData(data)
    } catch (err) {
      console.error('Attribution fetch failed:', err)
      setErrorMessage(err.message || 'Failed to generate molecular attribution.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Helper to prevent stale display
  const [, setIsAttributionDataStale] = useState(false)

  useEffect(() => {
    if (isOpen && smiles) {
      fetchAttribution(smiles, activeEndpoint)
    }
  }, [isOpen, smiles, activeEndpoint, fetchAttribution])

  // Current endpoint definition
  const currentEndpointDef = useMemo(() => {
    return ENDPOINTS.find((e) => e.id === activeEndpoint) || {
      id: activeEndpoint,
      name: activeEndpoint.replace(/_/g, ' ').toUpperCase(),
      isLiability: activeEndpoint.includes('herg') || activeEndpoint.includes('tox'),
    }
  }, [activeEndpoint])

  // Filtered atom attributions
  const filteredAtoms = useMemo(() => {
    if (!attributionData?.atom_attributions) return []
    if (filterDirection === 'all') return attributionData.atom_attributions
    return attributionData.atom_attributions.filter((a) => a.direction === filterDirection)
  }, [attributionData, filterDirection])

  // Sorted atoms by absolute contribution magnitude
  const sortedAtoms = useMemo(() => {
    return [...filteredAtoms].sort((a, b) => Math.abs(b.raw_contribution) - Math.abs(a.raw_contribution))
  }, [filteredAtoms])

  if (!isOpen) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(3, 7, 9, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#0a1618',
          border: '1px solid rgba(45,212,212,0.25)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1160px',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 35px rgba(45,212,212,0.12)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#e2e8f0',
          position: 'relative',
        }}
      >
        {/* ── MODAL HEADER ── */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(45,212,212,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(13, 26, 28, 0.95)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(45,212,212,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                {title}
              </h2>
              <div style={{ fontSize: '14px', color: '#94a3b8', fontFamily: 'monospace', marginTop: 3 }}>
                Target Molecule: <span style={{ color: '#cbd5e1' }}>{smiles?.length > 70 ? smiles.slice(0, 68) + '...' : smiles}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── ENDPOINT TABS ── */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 20px',
            background: '#071214',
            borderBottom: '1px solid rgba(45,212,212,0.08)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {ENDPOINTS.map((ep) => {
            const isActive = ep.id === activeEndpoint
            return (
              <button
                key={ep.id}
                onClick={() => setActiveEndpoint(ep.id)}
                style={{
                  background: isActive ? 'rgba(45,212,212,0.15)' : 'transparent',
                  color: isActive ? accentColor : '#94a3b8',
                  border: isActive ? '1px solid rgba(45,212,212,0.3)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14.5px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: ep.isLiability ? '#f43f5e' : '#10b981',
                    flexShrink: 0,
                  }}
                />
                {ep.name}
              </button>
            )
          })}
        </div>

        {/* ── MODAL BODY (SCROLLABLE) ── */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  border: '3px solid rgba(45,212,212,0.2)',
                  borderTopColor: accentColor,
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <div style={{ fontSize: '15.5px', color: '#cbd5e1' }}>
                Computing atomic Morgan environment perturbations for <strong style={{ color: '#fff' }}>{currentEndpointDef.name}</strong>...
              </div>
            </div>
          ) : errorMessage ? (
            <div
              style={{
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.3)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '16px 20px',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>{errorMessage}</span>
              <button
                onClick={() => fetchAttribution(smiles, activeEndpoint)}
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(244,63,94,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </div>
          ) : !attributionData?.is_available ? (
            <div
              style={{
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.25)',
                color: '#fbbf24',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '19px', color: '#fef08a' }}>
                Attribution Method Unavailable
              </h3>
              <p style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', maxWidth: '520px', marginInline: 'auto', lineHeight: 1.5 }}>
                {attributionData?.unavailability_reason || 'No validated model estimator or attribution mapping is installed for this endpoint.'}
              </p>
            </div>
          ) : (
            <>
              {/* ── PREDICTION SUMMARY STRIP ── */}
              <div
                style={{
                  background: '#0d1a1c',
                  border: '1px solid rgba(45,212,212,0.12)',
                  borderRadius: '8px',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                    Model Prediction Context
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: '21px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                      {attributionData.endpoint_name}
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '4px 11px',
                        borderRadius: 5,
                        background: currentEndpointDef.isLiability
                          ? (attributionData.probability >= attributionData.threshold ? 'rgba(244,63,94,0.18)' : 'rgba(16,185,129,0.15)')
                          : (attributionData.probability >= attributionData.threshold ? 'rgba(16,185,129,0.18)' : 'rgba(100,116,139,0.15)'),
                        color: currentEndpointDef.isLiability
                          ? (attributionData.probability >= attributionData.threshold ? '#f87171' : '#4ade80')
                          : (attributionData.probability >= attributionData.threshold ? '#4ade80' : '#94a3b8'),
                      }}
                    >
                      {attributionData.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: '14.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#94a3b8' }}>Probability:</span>
                    <strong style={{ color: accentColor, fontFamily: 'monospace', fontSize: '18px', fontWeight: 700 }}>
                      {(attributionData.probability * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#94a3b8' }}>Threshold:</span>
                    <strong style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '16px', fontWeight: 600 }}>
                      {(attributionData.threshold * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#94a3b8' }}>Confidence:</span>
                    <strong style={{ color: '#fff', textTransform: 'capitalize', fontSize: '15.5px', fontWeight: 600 }}>
                      {attributionData.confidence}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ── 2-COLUMN EXPLANATION WORKSPACE ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1fr',
                  gap: '16px',
                  alignItems: 'stretch',
                }}
              >
                {/* ── LEFT COLUMN: 2D Depiction & Interactive Legend ── */}
                <div
                  style={{
                    background: '#0d1a1c',
                    border: '1px solid rgba(45,212,212,0.12)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#fff' }}>
                      Molecular Attribution Map
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>
                      Morgan Radius 2 (2048-bit)
                    </span>
                  </div>

                  {/* SVG Container */}
                  <div
                    style={{
                      background: '#071214',
                      borderRadius: '8px',
                      border: '1px solid rgba(45,212,212,0.08)',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '270px',
                      position: 'relative',
                    }}
                  >
                    {attributionData.highlighted_svg ? (
                      <div
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          filter: 'invert(0.85) hue-rotate(180deg) brightness(1.25)',
                        }}
                        dangerouslySetInnerHTML={{ __html: attributionData.highlighted_svg }}
                      />
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '14px' }}>Depiction unavailable</div>
                    )}
                  </div>

                  {/* Interactive Visual Legend */}
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: 'rgba(7, 18, 20, 0.6)',
                      borderRadius: '6px',
                      border: '1px solid rgba(45,212,212,0.08)',
                      fontSize: '13.5px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8, fontSize: '14px' }}>
                      Color Encoding Legend:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: currentEndpointDef.isLiability ? '#f43f5e' : '#10b981',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: '#cbd5e1' }}>
                          {currentEndpointDef.isLiability ? 'Increases Liability (Risk Driver)' : 'Promotes Target Activity'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: currentEndpointDef.isLiability ? '#2dd4d4' : '#f59e0b',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: '#cbd5e1' }}>
                          {currentEndpointDef.isLiability ? 'Decreases Liability (Mitigating)' : 'Reduces Target Activity'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: '#c084fc',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: '#cbd5e1' }}>Structural Alert (PAINS/Brenk)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: '#475569',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: '#cbd5e1' }}>Neutral / Low Influence</span>
                      </div>
                    </div>
                  </div>

                  {/* Methodology & Limitations Box */}
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '13px',
                      color: '#cbd5e1',
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ color: '#fff', fontSize: '13.5px' }}>Scientific Honesty Notice:</strong>{' '}
                    {attributionData.method_limitations}
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Granular Breakdown & Alerts ── */}
                <div
                  style={{
                    background: '#0d1a1c',
                    border: '1px solid rgba(45,212,212,0.12)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Filter & Table Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: '17px', fontWeight: 600, color: '#fff' }}>
                        Atom Contributions ({sortedAtoms.length})
                      </div>

                      {/* Direction Filter */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['all', 'positive', 'negative'].map((dir) => (
                          <button
                            key={dir}
                            onClick={() => setFilterDirection(dir)}
                            style={{
                              background: filterDirection === dir ? 'rgba(45,212,212,0.18)' : 'rgba(255,255,255,0.04)',
                              color: filterDirection === dir ? accentColor : '#94a3b8',
                              border: filterDirection === dir ? '1px solid rgba(45,212,212,0.35)' : '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '5px',
                              padding: '4px 12px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              transition: 'all 0.15s',
                            }}
                          >
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Atom Attribution Table */}
                    <div
                      style={{
                        maxHeight: '235px',
                        overflowY: 'auto',
                        border: '1px solid rgba(45,212,212,0.08)',
                        borderRadius: '6px',
                        background: '#071214',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', background: 'rgba(13,26,28,0.6)' }}>
                            <th style={{ padding: '9px 12px', fontWeight: 600 }}>Atom</th>
                            <th style={{ padding: '9px 12px', fontWeight: 600 }}>Delta (ΔP)</th>
                            <th style={{ padding: '9px 12px', fontWeight: 600 }}>Intensity</th>
                            <th style={{ padding: '9px 12px', fontWeight: 600 }}>Bits</th>
                            <th style={{ padding: '9px 12px', fontWeight: 600 }}>Collision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAtoms.map((a) => {
                            const isHovered = hoveredAtom === a.atom_index
                            const color = a.direction === 'positive'
                              ? (currentEndpointDef.isLiability ? '#f87171' : '#4ade80')
                              : (a.direction === 'negative' ? (currentEndpointDef.isLiability ? '#2dd4d4' : '#fbbf24') : '#94a3b8')

                            return (
                              <tr
                                key={a.atom_index}
                                onMouseEnter={() => setHoveredAtom(a.atom_index)}
                                onMouseLeave={() => setHoveredAtom(null)}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  background: isHovered ? 'rgba(45,212,212,0.08)' : 'transparent',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#fff', fontSize: '14px' }}>
                                  #{a.atom_index} {a.atom_symbol}
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color, fontWeight: 700, fontSize: '14.5px' }}>
                                  {a.raw_contribution > 0 ? '+' : ''}{a.raw_contribution.toFixed(4)}
                                </td>
                                <td style={{ padding: '8px 12px', width: '76px' }}>
                                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.round(Math.abs(a.normalized_intensity) * 100)}%`,
                                        height: '100%',
                                        background: color,
                                        borderRadius: 3,
                                      }}
                                    />
                                  </div>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#cbd5e1', fontSize: '13.5px', fontWeight: 500 }}>
                                  {a.bit_count}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {a.has_collision ? (
                                    <span
                                      style={{
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        background: 'rgba(245,158,11,0.15)',
                                        color: '#f59e0b',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        border: '1px solid rgba(245,158,11,0.25)',
                                      }}
                                      title="This atom overlaps a Morgan bit that maps to multiple disjoint atom environments (hash collision or symmetry)"
                                    >
                                      Colliding
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>Unique</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Independent Structural Alerts Section */}
                  <div
                    style={{
                      padding: '14px',
                      background: 'rgba(7, 18, 20, 0.7)',
                      borderRadius: '6px',
                      border: '1px solid rgba(192,132,252,0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 600, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 2 22 22 22" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Independent Structural Alerts ({attributionData.structural_alerts?.length || 0})
                      </div>
                      <span style={{ fontSize: '13px', color: '#cbd5e1' }}>PAINS / BRENK / NIH</span>
                    </div>

                    {!attributionData.structural_alerts?.length ? (
                      <div style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                        No PAINS or Brenk chemical alert motifs detected for this structure.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '120px', overflowY: 'auto' }}>
                        {attributionData.structural_alerts.map((alert, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: 'rgba(192,132,252,0.08)',
                              border: '1px solid rgba(192,132,252,0.2)',
                              borderRadius: '5px',
                              padding: '8px 10px',
                              fontSize: '13.5px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff', fontWeight: 600 }}>
                              <span style={{ fontSize: '14.5px' }}>{alert.alert_name}</span>
                              <span style={{ fontSize: '12.5px', fontWeight: 600, background: 'rgba(192,132,252,0.2)', padding: '3px 8px', borderRadius: 4 }}>
                                {alert.rule_set}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: 4 }}>
                              Matched atoms: {alert.matched_atoms.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
