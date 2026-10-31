import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import api from '../lib/apiClient'

function SvgMolecule({ rdkit, smiles, width = 140, height = 110 }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    if (!smiles) {
      setSvg('')
      return
    }
    if (rdkit) {
      let mol = null
      try {
        mol = rdkit.get_mol(smiles)
        if (mol && mol.is_valid()) {
          const rawSvg = mol.get_svg(width, height)
          // Theme adjustments
          const themed = rawSvg
            .replace(/opacity="0"/g, 'opacity="1"')
            .replace(/fill="none"/g, 'fill="#050b0d"')
            .replace(/fill='#FFFFFF'/g, "fill='transparent'")
            .replace(/fill="#FFFFFF"/g, 'fill="transparent"')
            .replace(/stroke="#000000"/g, 'stroke="#e2e8f0"')
            .replace(/stroke='#000000'/g, "stroke='#e2e8f0'")
          setSvg(themed)
          return
        }
      } catch (e) {
        console.warn('SVG render failed:', e)
      } finally {
        if (mol) mol.delete()
      }
    }
    setSvg('')
  }, [rdkit, smiles, width, height])

  if (!svg) {
    return (
      <div style={{
        width, height, background: '#050b0d', borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(45,212,212,0.1)', color: '#64748b', fontSize: '13px',
      }}>
        2D Structure
      </div>
    )
  }

  return (
    <div
      style={{
        width, height, background: '#050b0d', borderRadius: '6px',
        overflow: 'hidden', border: '1px solid rgba(45,212,212,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default function BenchmarkSelectorModal({
  isOpen,
  onClose,
  onSelectBenchmark,
  onSelectCaseStudy,
  onSendToWarRoom,
  rdkit,
}) {
  const [benchmarks, setBenchmarks] = useState([])
  const [caseStudies, setCaseStudies] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'case_studies' | 'cardiotox' | 'nsaid'
  const [selectedCompoundDetail, setSelectedCompoundDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fetch catalog on modal open
  useEffect(() => {
    if (!isOpen) return

    const fetchCatalog = async () => {
      setIsLoading(true)
      try {
        const data = await api.get('/api/benchmarks')
        setBenchmarks(data.benchmarks || [])
        setCaseStudies(data.case_studies || [])
      } catch (err) {
        console.error('Failed to load benchmarks catalog:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCatalog()
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedCompoundDetail) {
          setSelectedCompoundDetail(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedCompoundDetail, onClose])

  const handleOpenDetail = async (benchmarkId) => {
    setDetailLoading(true)
    try {
      const detail = await api.get(`/api/benchmarks/${benchmarkId}`)
      setSelectedCompoundDetail(detail)
    } catch (err) {
      console.error('Failed to fetch benchmark details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  if (!isOpen) return null

  const filteredBenchmarks = benchmarks.filter((b) => {
    if (activeFilter === 'cardiotox') return b.category.includes('Cardiotoxicity')
    if (activeFilter === 'nsaid') return b.category.includes('Anti-inflammatory')
    return true
  })

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(3, 7, 9, 0.85)',
          backdropFilter: 'blur(10px)',
        }}
      />

      {/* Modal Dialog */}
      <div style={{
        position: 'relative', width: '980px', maxWidth: '95vw', maxHeight: 'calc(100vh - 48px)',
        background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.25)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 35px rgba(45,212,212,0.12)',
        overflow: 'hidden', zIndex: 10,
        fontFamily: 'Inter, system-ui, sans-serif', color: '#fff',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(45,212,212,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(45,212,212,0.06) 0%, rgba(13,26,28,0) 100%)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'rgba(45,212,212,0.15)', color: '#2dd4d4',
                padding: '4px 9px', borderRadius: '4px', fontSize: '13px',
                fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                Curated Reference Catalog
              </span>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff' }}>
                Benchmark Drug Gallery
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '15px', color: '#94a3b8' }}>
              Select documented clinical and regulatory benchmarks. Load them directly into the existing workspace to analyze live model outputs alongside documented scientific evidence.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              fontSize: '24px', cursor: 'pointer', padding: '4px 8px',
              borderRadius: '6px', transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#fff')}
            onMouseLeave={(e) => (e.target.style.color = '#94a3b8')}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Filter Pills Bar */}
        <div style={{
          display: 'flex', gap: '8px', padding: '12px 24px',
          background: '#091315', borderBottom: '1px solid rgba(45,212,212,0.08)',
        }}>
          {[
            { id: 'all', label: `All Benchmarks (${benchmarks.length})` },
            { id: 'case_studies', label: `Comparative Case Studies (${caseStudies.length})` },
            { id: 'cardiotox', label: 'Cardiotoxicity & hERG (2)' },
            { id: 'nsaid', label: 'Anti-inflammatory NSAIDs (3)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveFilter(tab.id)
                setSelectedCompoundDetail(null)
              }}
              style={{
                padding: '7px 16px', fontSize: '14px', fontWeight: 600,
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
                ...(activeFilter === tab.id
                  ? { background: 'rgba(45,212,212,0.2)', color: '#2dd4d4', border: '1px solid rgba(45,212,212,0.4)' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid transparent' }),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#2dd4d4', fontSize: '15px' }}>
              Loading benchmark references...
            </div>
          ) : selectedCompoundDetail ? (
            /* ── DETAIL VIEW (Historical facts & provenance) ── */
            <div>
              <button
                onClick={() => setSelectedCompoundDetail(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', color: '#2dd4d4',
                  fontSize: '14.5px', fontWeight: 600, cursor: 'pointer',
                  marginBottom: '16px', padding: 0,
                }}
              >
                ← Back to Benchmarks List
              </button>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <SvgMolecule rdkit={rdkit} smiles={selectedCompoundDetail.canonical_smiles} width={180} height={140} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '25px', fontWeight: 700, color: '#fff' }}>
                      {selectedCompoundDetail.name}
                    </h3>
                    <span style={{
                      padding: '4px 9px', borderRadius: '4px', fontSize: '13px', fontWeight: 700,
                      background: 'rgba(45,212,212,0.12)', color: '#2dd4d4', border: '1px solid rgba(45,212,212,0.25)',
                    }}>
                      {selectedCompoundDetail.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                    Formula: <strong style={{ color: '#fff' }}>{selectedCompoundDetail.formula}</strong> | MW: <strong style={{ color: '#fff' }}>{selectedCompoundDetail.molecular_weight} g/mol</strong>
                  </div>
                  <div style={{ fontSize: '15px', color: '#cbd5e1', marginTop: '10px', lineHeight: 1.55 }}>
                    {selectedCompoundDetail.description}
                  </div>
                  
                  {/* Action row in detail */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                      onClick={() => {
                        onSelectBenchmark(selectedCompoundDetail.canonical_smiles, selectedCompoundDetail)
                        onClose()
                      }}
                      style={{
                        padding: '9px 18px', fontSize: '15px', fontWeight: 700,
                        background: '#2dd4d4', color: '#000', border: 'none',
                        borderRadius: '6px', cursor: 'pointer', transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => (e.target.style.opacity = '0.85')}
                      onMouseLeave={(e) => (e.target.style.opacity = '1')}
                    >
                      Load into Workspace & Analyze
                    </button>
                    {onSendToWarRoom && (
                      <button
                        onClick={() => {
                          onSendToWarRoom(selectedCompoundDetail.canonical_smiles)
                          onClose()
                        }}
                        style={{
                          padding: '9px 16px', fontSize: '15px', fontWeight: 600,
                          background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                          border: '1px solid rgba(251,191,36,0.3)', borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Lead Optimization in War Room →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Historical Facts Section */}
              <div style={{
                background: '#071012', border: '1px solid rgba(45,212,212,0.15)',
                borderRadius: '8px', padding: '16px', marginBottom: '16px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2dd4d4', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Documented Historical & Clinical Evidence (Fact)
                </div>
                <div style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '12px' }}>
                  {selectedCompoundDetail.historical_context}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div style={{ background: '#0d1a1c', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Regulatory Status:</span>
                    <strong style={{ color: '#fff' }}>{selectedCompoundDetail.regulatory_status}</strong>
                  </div>
                  <div style={{ background: '#0d1a1c', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Documented Reference Outcome:</span>
                    <strong style={{ color: '#fbbf24' }}>{selectedCompoundDetail.expected_reference_outcome}</strong>
                  </div>
                </div>
              </div>

              {/* Scientific Domain Applicability & Model Alignment */}
              <div style={{
                background: '#071012', border: '1px solid rgba(45,212,212,0.15)',
                borderRadius: '8px', padding: '16px', marginBottom: '16px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Scientific Domain Applicability & Model Alignment
                </div>
                <div style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.55, marginBottom: '10px' }}>
                  {selectedCompoundDetail.domain_applicability_note}
                </div>
                {selectedCompoundDetail.alignment_guide?.scientific_rationale && (
                  <div style={{
                    padding: '12px 14px', borderRadius: '6px', fontSize: '13.5px',
                    background: selectedCompoundDetail.alignment_guide.is_concordant ? 'rgba(74,222,128,0.08)' : 'rgba(251,191,36,0.08)',
                    border: `1px solid ${selectedCompoundDetail.alignment_guide.is_concordant ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.2)'}`,
                    color: selectedCompoundDetail.alignment_guide.is_concordant ? '#86efac' : '#fde047',
                  }}>
                    <strong>{selectedCompoundDetail.alignment_guide.is_concordant ? 'Concordant Alignment Note:' : 'Known Disagreement / Boundary Note:'}</strong>{' '}
                    {selectedCompoundDetail.alignment_guide.scientific_rationale}
                  </div>
                )}
              </div>

              {/* Provenance & Citations */}
              <div style={{
                background: '#071012', border: '1px solid rgba(45,212,212,0.1)',
                borderRadius: '8px', padding: '14px 16px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Traceable Sources & Provenance
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCompoundDetail.provenance_sources?.map((src, idx) => (
                    <div key={idx} style={{ fontSize: '13.5px', display: 'flex', gap: '8px', color: '#cbd5e1' }}>
                      <span style={{ color: '#2dd4d4', fontWeight: 600, minWidth: '120px' }}>[{src.source_type}]</span>
                      <span>{src.citation_title} (ID: {src.identifier})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeFilter === 'case_studies' ? (
            /* ── COMPARATIVE CASE STUDIES VIEW ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {caseStudies.map((cs) => (
                <div
                  key={cs.id}
                  style={{
                    background: '#071012', border: '1px solid rgba(45,212,212,0.15)',
                    borderRadius: '8px', padding: '16px', transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{
                        padding: '3px 9px', borderRadius: '4px', fontSize: '13px', fontWeight: 700,
                        background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                      }}>
                        {cs.category}
                      </span>
                      <h4 style={{ margin: '6px 0 2px', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                        {cs.title}
                      </h4>
                      <div style={{ fontSize: '14px', color: '#94a3b8' }}>{cs.subtitle}</div>
                    </div>
                    {onSelectCaseStudy && (
                      <button
                        onClick={() => {
                          onSelectCaseStudy(cs)
                          onClose()
                        }}
                        style={{
                          padding: '9px 16px', fontSize: '14px', fontWeight: 700,
                          background: 'rgba(45,212,212,0.15)', color: '#2dd4d4',
                          border: '1px solid rgba(45,212,212,0.35)', borderRadius: '6px',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#2dd4d4'
                          e.target.style.color = '#000'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(45,212,212,0.15)'
                          e.target.style.color = '#2dd4d4'
                        }}
                      >
                        Compare in Compare Tab →
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '15px', color: '#cbd5e1', margin: '8px 0 14px', lineHeight: 1.55 }}>
                    {cs.description}
                  </p>

                  {/* Paired Compounds Preview Row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
                    background: '#0d1a1c', padding: '14px', borderRadius: '6px', border: '1px solid rgba(45,212,212,0.08)',
                  }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <SvgMolecule rdkit={rdkit} smiles={cs.compound_a.canonical_smiles} width={95} height={75} />
                      <div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Molecule A (Reference)</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{cs.compound_a.name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>{cs.compound_a.formula} ({cs.compound_a.molecular_weight} Da)</div>
                        <button
                          onClick={() => {
                            onSelectBenchmark(cs.compound_a.canonical_smiles, cs.compound_a)
                            onClose()
                          }}
                          style={{
                            marginTop: '4px', background: 'none', border: 'none', color: '#2dd4d4',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0,
                          }}
                        >
                          Load as Workspace Molecule
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', borderLeft: '1px solid rgba(45,212,212,0.1)', paddingLeft: '14px' }}>
                      <SvgMolecule rdkit={rdkit} smiles={cs.compound_b.canonical_smiles} width={95} height={75} />
                      <div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Molecule B (Optimization / Analog)</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{cs.compound_b.name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>{cs.compound_b.formula} ({cs.compound_b.molecular_weight} Da)</div>
                        <button
                          onClick={() => {
                            onSelectBenchmark(cs.compound_b.canonical_smiles, cs.compound_b)
                            onClose()
                          }}
                          style={{
                            marginTop: '4px', background: 'none', border: 'none', color: '#2dd4d4',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0,
                          }}
                        >
                          Load as Workspace Molecule
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── ALL BENCHMARKS LIST VIEW ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredBenchmarks.map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: '#071012', border: '1px solid rgba(45,212,212,0.15)',
                    borderRadius: '8px', padding: '16px 18px', display: 'flex',
                    alignItems: 'center', gap: '18px', transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(45,212,212,0.4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(45,212,212,0.15)')}
                >
                  <SvgMolecule rdkit={rdkit} smiles={b.canonical_smiles} width={110} height={85} />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#fff' }}>
                        {b.name}
                      </h4>
                      <span style={{
                        padding: '3px 9px', borderRadius: '4px', fontSize: '13px', fontWeight: 700,
                        background: 'rgba(45,212,212,0.12)', color: '#2dd4d4', border: '1px solid rgba(45,212,212,0.25)',
                      }}>
                        {b.historical_status_badge}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '14px', color: '#94a3b8', margin: '4px 0 6px' }}>
                      <span>Formula: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{b.formula}</strong></span>
                      <span style={{ color: 'rgba(45,212,212,0.3)' }}>|</span>
                      <span>MW: <strong style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{b.molecular_weight} g/mol</strong></span>
                      <span style={{ color: 'rgba(45,212,212,0.3)' }}>|</span>
                      <span>Focus: <strong style={{ color: '#fff' }}>{b.primary_endpoint_name}</strong></span>
                    </div>

                    <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.45 }}>
                      Case Study: <strong style={{ color: '#e2e8f0' }}>{b.case_study_title}</strong>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '175px' }}>
                    <button
                      onClick={() => {
                        onSelectBenchmark(b.canonical_smiles, b)
                        onClose()
                      }}
                      style={{
                        padding: '9px 14px', fontSize: '14px', fontWeight: 700,
                        background: '#2dd4d4', color: '#000', border: 'none',
                        borderRadius: '6px', cursor: 'pointer', transition: 'opacity 0.2s',
                        textAlign: 'center',
                      }}
                      onMouseEnter={(e) => (e.target.style.opacity = '0.85')}
                      onMouseLeave={(e) => (e.target.style.opacity = '1')}
                    >
                      Load into Workspace
                    </button>
                    <button
                      onClick={() => handleOpenDetail(b.id)}
                      disabled={detailLoading}
                      style={{
                        padding: '7px 14px', fontSize: '13px', fontWeight: 600,
                        background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                        border: '1px solid rgba(45,212,212,0.12)', borderRadius: '6px',
                        cursor: 'pointer', textAlign: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(45,212,212,0.08)'
                        e.target.style.color = '#2dd4d4'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.04)'
                        e.target.style.color = '#94a3b8'
                      }}
                    >
                      View Provenance & Evidence →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info notice */}
        <div style={{
          padding: '12px 24px', background: '#091315', borderTop: '1px solid rgba(45,212,212,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#64748b',
        }}>
          <span>
            Offline ground-truth reference database. Grounded in FDA NDAs, DrugBank, ChEMBL, and primary literature.
          </span>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>
            Esc to close
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}

