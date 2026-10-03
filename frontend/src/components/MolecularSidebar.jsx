import { useState } from 'react'

/* Pulsing dot animation for background analysis indicator */
const pulseKeyframes = `
@keyframes rogveda-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
`

export default function MolecularSidebar({ 
  currentMolecule = null,
  recentActivity = [],
  onGenerateReport = null,
  onSaveExperiment = null,
  isAnalyzing = false,
}) {
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [reportFormat, setReportFormat] = useState('Comprehensive Report (PDF)')
  return (
    <>
      {/* Inject keyframe animation */}
      <style>{pulseKeyframes}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px', flexShrink: 0, height: '100%' }}>
      
      {/* Current Molecule Card */}
      <div style={{ background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.12)', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: '0 0 12px', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Current Molecule
          {isAnalyzing && (
            <span
              title="Analyzing molecule..."
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#2dd4d4',
                boxShadow: '0 0 8px rgba(45,212,212,0.6)',
                animation: 'rogveda-pulse 1.2s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
          )}
        </h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Thumbnail */}
          <div style={{ 
            width: '100px', height: '80px', 
            background: '#081214', borderRadius: '6px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            border: '1px solid rgba(45,212,212,0.08)', flexShrink: 0, overflow: 'hidden',
            position: 'relative'
          }}>
            {currentMolecule?.thumbnailSvg ? (
              <div 
                dangerouslySetInnerHTML={{ __html: currentMolecule.thumbnailSvg }} 
                style={{ 
                  width: '100%', height: '100%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px',
                }}
              />
            ) : (
              <span style={{ color: '#475569', fontSize: '10px', fontStyle: 'italic' }}>No molecule</span>
            )}
          </div>
          {/* Info */}
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

      {/* Recent Activity Card */}
      <div style={{ background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.12)', borderRadius: '8px', padding: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Recent Activity
          </h3>
          <button onClick={() => setShowAllActivity(true)} style={{ color: '#2dd4d4', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
            View All →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '4px' }}>
          {recentActivity.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>No recent activity.</p>
          ) : (
            recentActivity.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: '#2dd4d4', boxShadow: '0 0 6px #2dd4d4' }} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.3 }}>{log.action}</span>
                  <span style={{ color: '#64748b', fontSize: '11px', lineHeight: 1.3, marginTop: '2px' }}>{log.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report Generation Card */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0d1a1c 0%, #0a1e20 100%)', 
        border: '1px solid rgba(45,212,212,0.15)', 
        borderRadius: '10px', 
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle glow accent */}
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <h3 style={{ color: '#2dd4d4', fontWeight: 700, fontSize: '16px', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
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
          width: '100%', 
          background: '#081214', 
          border: '1px solid rgba(45,212,212,0.15)', 
          color: '#e2e8f0', 
          fontSize: '13px', 
          borderRadius: '8px', 
          padding: '10px 12px', 
          marginBottom: '14px', 
          outline: 'none', 
          appearance: 'none', 
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}>
          <option>Comprehensive Report (PDF)</option>
          <option>Summary Report (PDF)</option>
          <option>Data Export (CSV)</option>
        </select>
        
        <button 
          onClick={() => onGenerateReport?.(reportFormat)}
          style={{ 
            width: '100%', 
            padding: '12px 0', 
            fontWeight: 700, 
            fontSize: '14px', 
            borderRadius: '8px', 
            border: 'none',
            cursor: 'pointer',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            background: 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
            color: '#000',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 4px 15px rgba(45,212,212,0.25)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.02em',
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
        onClick={onSaveExperiment ? onSaveExperiment : () => window.location.href = '/'}
        style={{ 
          width: '100%', padding: '14px 0', borderRadius: '8px', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          fontSize: '14px', fontWeight: 600, 
          background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.12)', 
          color: '#2dd4d4', cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#0d1a1c' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save and Exit Workspace
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>

    </div>
    </>
  )
}
