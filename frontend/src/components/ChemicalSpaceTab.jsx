/**
 * ROGVEDA — Chemical Space Tab
 *
 * Interactive UMAP scatter plot showing where a query molecule sits
 * relative to a ~10k representative subset in 2D chemical space.
 * Uses Recharts ScatterChart.  The query dot animates into position
 * via CSS transitions.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ZAxis
} from 'recharts'
import api from '../lib/apiClient'

/* ── Icons ─────────────────────────────────────────────────── */
const MapIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
  </svg>
)

const LoadingDot = () => (
  <div style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: '#2dd4d4', animation: 'pulse-dot 1.2s ease-in-out infinite'
  }} />
)

/* ── Custom Tooltip ────────────────────────────────────────── */
function MapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: 'rgba(5,11,13,0.95)', border: '1px solid rgba(45,212,212,0.3)',
      borderRadius: 8, padding: '10px 14px', maxWidth: 280,
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12
    }}>
      <div style={{ color: '#2dd4d4', fontWeight: 600, marginBottom: 4 }}>
        {d.name || 'Query Molecule'}
      </div>
      <div style={{ color: '#94a3b8', wordBreak: 'break-all', fontSize: 11 }}>
        {d.smiles?.length > 60 ? d.smiles.slice(0, 60) + '…' : d.smiles}
      </div>
      <div style={{ color: '#64748b', marginTop: 4, fontSize: 10 }}>
        x: {d.x?.toFixed(2)}, y: {d.y?.toFixed(2)}
      </div>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────── */
export default function ChemicalSpaceTab({ canonicalSmiles, currentMolecule, isActive }) {
  const [refData, setRefData] = useState(null)       // [{name, smiles, x, y}, ...]
  const [queryPoint, setQueryPoint] = useState(null)  // {x, y, smiles}
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const lastSmiles = useRef('')

  // Nearest neighbors from the map (computed client-side for display)
  const [nearest, setNearest] = useState([])

  const locateMolecule = useCallback(async (smiles) => {
    if (!smiles || smiles === lastSmiles.current) return
    lastSmiles.current = smiles
    setIsLoading(true)
    setError('')
    try {
      const data = await api.post('/api/chemical-space/locate', { smiles })
      setRefData(data.references)
      setQueryPoint(data.query)
      setHasLoaded(true)

      // Compute nearest 5 by Euclidean distance
      const qx = data.query.x, qy = data.query.y
      const withDist = data.references.map(r => ({
        ...r,
        dist: Math.sqrt((r.x - qx) ** 2 + (r.y - qy) ** 2)
      }))
      withDist.sort((a, b) => a.dist - b.dist)
      setNearest(withDist.slice(0, 5))
    } catch (e) {
      setError(e.message || 'Failed to locate molecule in chemical space')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-locate when tab becomes active and SMILES changed
  useEffect(() => {
    if (isActive && canonicalSmiles && canonicalSmiles !== lastSmiles.current) {
      locateMolecule(canonicalSmiles)
    }
  }, [isActive, canonicalSmiles, locateMolecule])

  /* ── Render ────────────────────────────────────────────── */
  // Downsample to ~1500 points to prevent extreme layout/paint lag when switching tabs
  const maxPoints = 1500
  const step = refData && refData.length > maxPoints ? Math.ceil(refData.length / maxPoints) : 1
  const refDataForChart = refData ? refData.filter((_, i) => i % step === 0) : []
  const queryDataForChart = queryPoint ? [{ ...queryPoint, name: 'Your Molecule' }] : []

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes glow-ring {
          0%, 100% { box-shadow: 0 0 8px rgba(45,212,212,0.6); }
          50% { box-shadow: 0 0 20px rgba(45,212,212,0.9), 0 0 40px rgba(45,212,212,0.3); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#2dd4d4', display: 'flex' }}>{MapIcon}</span>
            Chemical Space Map
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            UMAP projection of a 10,000-molecule representative subset (from 235k total) with your molecule highlighted
          </p>
        </div>
        <button
          onClick={() => canonicalSmiles && locateMolecule(canonicalSmiles)}
          disabled={!canonicalSmiles || isLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 8,
            border: '1px solid rgba(45,212,212,0.3)',
            background: canonicalSmiles && !isLoading ? 'rgba(45,212,212,0.1)' : 'rgba(255,255,255,0.03)',
            color: canonicalSmiles && !isLoading ? '#2dd4d4' : '#475569',
            fontSize: 13, fontWeight: 600, cursor: canonicalSmiles && !isLoading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {isLoading ? <><LoadingDot /> Locating...</> : <>{MapIcon} Locate on Map</>}
        </button>
      </div>

      {error && (
        <div style={{
          marginBottom: 16, padding: 12, fontSize: 13, borderRadius: 8,
          background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5'
        }}>
          {error}
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', gap: 16, width: '100%' }}>
        {/* Chart */}
        <div style={{
          flex: 1, borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(45,212,212,0.1)', background: '#0a1214',
          padding: '16px 8px 8px 8px', minHeight: 500
        }}>
          {!hasLoaded && !isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 480 }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: '#2dd4d4', opacity: 0.3, marginBottom: 16 }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
                  </svg>
                </div>
                <h3 style={{ color: '#d1d5db', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  Chemical Space Explorer
                </h3>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Draw a molecule on the canvas, then click <span style={{ color: '#2dd4d4' }}>Locate on Map</span> to see where it lives in drug space.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', minHeight: 600 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <XAxis
                  type="number" dataKey="x" name="Similarity X"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickFormatter={(val) => val.toFixed(1)}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  label={{ value: 'Similarity X', position: 'bottom', fill: '#64748b', fontSize: 11, offset: 0 }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <YAxis
                  type="number" dataKey="y" name="Similarity Y"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickFormatter={(val) => val.toFixed(1)}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  label={{ value: 'Similarity Y', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <ZAxis range={[12, 12]} />
                <Tooltip content={<MapTooltip />} cursor={{ stroke: 'rgba(45,212,212,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />

                {/* Reference compounds (rendered as a soft cloud/nebula) */}
                <Scatter name="Reference Space" data={refDataForChart} fill="#334155" fillOpacity={0.25}>
                  {refDataForChart.map((_, i) => (
                    <Cell key={i} fill="#475569" fillOpacity={0.25} r={5} />
                  ))}
                </Scatter>

                {/* Query molecule — larger, glowing */}
                <Scatter name="Your Molecule" data={queryDataForChart} fill="#2dd4d4">
                  {queryDataForChart.map((_, i) => (
                    <Cell key={`q-${i}`} fill="#2dd4d4" r={8} stroke="#2dd4d4" strokeWidth={2} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right sidebar — query info + nearest neighbors */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Query position card */}
          {queryPoint && (
            <div style={{
              borderRadius: 10, padding: 16,
              border: '1px solid rgba(45,212,212,0.2)', background: 'rgba(45,212,212,0.05)'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#2dd4d4', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Molecule
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all', marginBottom: 8 }}>
                {queryPoint.smiles?.length > 50 ? queryPoint.smiles.slice(0, 50) + '…' : queryPoint.smiles}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Map Region (X, Y)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {queryPoint.x?.toFixed(1)}, {queryPoint.y?.toFixed(1)}
                  </div>
                </div>
              </div>
              {currentMolecule?.formula && currentMolecule.formula !== '-' && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                  {currentMolecule.formula} · MW {currentMolecule.mw}
                </div>
              )}
            </div>
          )}

          {/* Plain English Explanation */}
          <div style={{
            borderRadius: 10, padding: 16,
            border: '1px solid rgba(45,212,212,0.1)', background: 'rgba(255,255,255,0.02)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', marginBottom: 8 }}>
              💡 How to read this map
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 8px 0' }}>
              Think of this as a map of the "chemical universe". Every faint dot is a known, existing drug or compound.
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              The layout is based purely on structural similarity. If your molecule is <strong>clustered with others</strong>, it shares structural features with known drugs. If it sits in an <strong>empty area</strong>, your molecule is highly novel and unique.
            </p>
          </div>

          {/* Nearest neighbors */}
          {nearest.length > 0 && (
            <div style={{
              borderRadius: 10, padding: 16,
              border: '1px solid rgba(45,212,212,0.1)', background: '#0a1214'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nearest on Map
              </div>
              {nearest.map((n, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: i === 0 ? 'rgba(45,212,212,0.15)' : 'rgba(255,255,255,0.05)',
                    color: i === 0 ? '#2dd4d4' : '#64748b',
                    border: `1px solid ${i === 0 ? 'rgba(45,212,212,0.3)' : 'rgba(255,255,255,0.08)'}`
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569' }}>
                      Map Distance: {n.dist.toFixed(3)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{
            borderRadius: 10, padding: 14,
            border: '1px solid rgba(45,212,212,0.1)', background: '#0a1214'
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legend
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569', opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Representative subset (~10k)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: '#2dd4d4',
                boxShadow: '0 0 8px rgba(45,212,212,0.6)',
                animation: 'glow-ring 2s ease-in-out infinite'
              }} />
              <span style={{ fontSize: 11, color: '#2dd4d4' }}>Your molecule</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
