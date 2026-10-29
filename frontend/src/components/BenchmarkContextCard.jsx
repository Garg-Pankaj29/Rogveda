import { useState } from 'react'

export default function BenchmarkContextCard({
  benchmark,
  predictions = [],
  onSendToCompare,
  onSendToWarRoom,
  onSwitchBenchmark,
}) {
  const [showAllSources, setShowAllSources] = useState(false)

  if (!benchmark) return null

  // Find the actual model prediction corresponding to the benchmark's primary endpoint
  const primaryEpId = benchmark.applicable_endpoints?.[0] || 'herg'
  const matchingPred = predictions.find(
    (p) => p.endpoint_id === primaryEpId || p.endpoint_name?.toLowerCase().includes(primaryEpId)
  )

  const isConcordant = benchmark.alignment_guide?.is_concordant ?? true
  const alignmentType = benchmark.alignment_guide?.disagreement_type || (isConcordant ? 'Concordant Alignment' : 'Scientific Disagreement')

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #09171a 0%, #060e10 100%)',
        border: '1px solid rgba(45,212,212,0.3)',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative top accent glow */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: isConcordant
            ? 'linear-gradient(90deg, #2dd4d4, #4ade80)'
            : 'linear-gradient(90deg, #2dd4d4, #fbbf24)',
        }}
      />

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(45,212,212,0.15)',
                color: '#2dd4d4',
                padding: '4px 9px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border: '1px solid rgba(45,212,212,0.3)',
              }}
            >
              Benchmark Drug Reference Case Study
            </span>
            <span
              style={{
                background: isConcordant ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                color: isConcordant ? '#4ade80' : '#fbbf24',
                padding: '4px 9px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 700,
                border: `1px solid ${isConcordant ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
              }}
            >
              {alignmentType}
            </span>
          </div>

          <h3 style={{ margin: '8px 0 2px', fontSize: '22px', fontWeight: 700, color: '#fff' }}>
            {benchmark.name} — {benchmark.case_study?.study_title || benchmark.category}
          </h3>
          <div style={{ fontSize: '15px', color: '#94a3b8' }}>
            Formula: <strong style={{ color: '#fff' }}>{benchmark.formula}</strong> | MW: <strong style={{ color: '#cbd5e1' }}>{benchmark.molecular_weight} g/mol</strong> | Regulatory: <strong style={{ color: '#e2e8f0' }}>{benchmark.regulatory_status}</strong>
          </div>
        </div>

        {/* Quick handoff actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {benchmark.case_study?.pair_benchmark_id && onSendToCompare && (
            <button
              onClick={() => onSendToCompare(benchmark)}
              style={{
                padding: '7px 14px', fontSize: '14px', fontWeight: 600,
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
              Compare with {benchmark.case_study.pair_compound_name} →
            </button>
          )}
          {onSendToWarRoom && (
            <button
              onClick={() => onSendToWarRoom(benchmark.canonical_smiles)}
              style={{
                padding: '7px 14px', fontSize: '14px', fontWeight: 600,
                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.35)', borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Initiate Lead Optimization War Room using this benchmark as parent lead"
            >
              Optimize Lead in War Room →
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side: Documented Historical Fact vs Rogveda Genuine Model Output */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '16px',
          background: '#040b0d',
          border: '1px solid rgba(45,212,212,0.15)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '14px',
        }}
      >
        {/* Left Column: Documented Historical Fact */}
        <div style={{ borderRight: '1px solid rgba(45,212,212,0.1)', paddingRight: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Documented Historical & Clinical Fact
            </span>
          </div>
          <p style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.55, margin: '0 0 10px' }}>
            {benchmark.historical_context}
          </p>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            <strong>Mechanism:</strong> {benchmark.mechanism_of_action}
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
            <strong>Reference Outcome:</strong> <span style={{ color: '#fbbf24', fontWeight: 600 }}>{benchmark.expected_reference_outcome}</span>
          </div>
        </div>

        {/* Right Column: Rogveda Actual Model Output */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2dd4d4' }} />
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#2dd4d4', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rogveda Genuine Computational Model Output
            </span>
          </div>

          {matchingPred ? (
            <div style={{ background: '#0a1618', padding: '12px', borderRadius: '6px', border: '1px solid rgba(45,212,212,0.15)', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#cbd5e1' }}>
                  {matchingPred.endpoint_name}
                </span>
                <span
                  style={{
                    fontSize: '13px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                    background: matchingPred.status_label.includes('High Risk') || matchingPred.status_label === 'Inactive'
                      ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
                    color: matchingPred.status_label.includes('High Risk') || matchingPred.status_label === 'Inactive'
                      ? '#f87171' : '#4ade80',
                  }}
                >
                  {matchingPred.status_label}
                </span>
              </div>

              {/* Confidence / Probability bar */}
              <div style={{ height: '7px', background: '#050c0e', borderRadius: '3.5px', overflow: 'hidden', marginBottom: '6px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round((matchingPred.confidence || 0) * 100)}%`,
                    background: '#2dd4d4',
                    borderRadius: '3.5px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8' }}>
                <span>Model Output Probability: <strong style={{ color: '#fff' }}>{Math.round((matchingPred.confidence || 0) * 100)}%</strong></span>
                <span>Decision Threshold: <strong style={{ color: '#cbd5e1' }}>0.20</strong></span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '13.5px', color: '#64748b', fontStyle: 'italic', padding: '12px 0' }}>
              Evaluating model endpoints...
            </div>
          )}

          {/* Model honesty badge */}
          <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
            * Evaluated dynamically by Rogveda local scikit-learn models (Calibrated RandomForest, 2048-bit Morgan FP radius-2). Output is not hard-coded.
          </div>
        </div>
      </div>

      {/* Alignment / Domain Applicability Banner */}
      <div
        style={{
          background: isConcordant ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.06)',
          border: `1px solid ${isConcordant ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.25)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
          lineHeight: 1.55,
          color: '#e2e8f0',
        }}
      >
        <span style={{ fontWeight: 700, color: isConcordant ? '#4ade80' : '#fbbf24', marginRight: '6px' }}>
          {isConcordant ? '✓ Concordance Analysis:' : '⚠ Scientific Disagreement / Domain Limitation:'}
        </span>
        {benchmark.alignment_guide?.scientific_rationale || benchmark.domain_applicability_note}
      </div>

      {/* Provenance citations toggle */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setShowAllSources(!showAllSources)}
          style={{
            background: 'none', border: 'none', color: '#94a3b8',
            fontSize: '13px', cursor: 'pointer', padding: 0, textDecoration: 'underline',
          }}
        >
          {showAllSources ? 'Hide Source Provenance' : `View Traceable Source Citations (${benchmark.provenance_sources?.length || 0})`}
        </button>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {benchmark.attribution_license}
        </span>
      </div>

      {showAllSources && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(45,212,212,0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {benchmark.provenance_sources?.map((src, idx) => (
            <div key={idx} style={{ fontSize: '13px', color: '#94a3b8' }}>
              <span style={{ color: '#2dd4d4', fontWeight: 600 }}>[{src.source_type}]</span> {src.citation_title} (Ref: {src.identifier}, Verified: {src.retrieval_date})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

