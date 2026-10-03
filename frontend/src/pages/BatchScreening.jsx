/**
 * ROGVEDA — Batch Screening Page (Phase 17)
 *
 * CSV upload → batch molecular screening → sortable results table
 * with error display and CSV/PDF export.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/apiClient'
import TopNav from '../components/TopNav'

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */
const Icons = {
  upload: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  file: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  sort: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>,
  sortUp: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 14l5-5 5 5"/></svg>,
  sortDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10l5 5 5-5"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  beaker: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>,
  plug: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>,
  battery: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>,
  monitor: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  leaf: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  zap: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
}

/* ═══════════════════════════════════════════
   STYLE CONSTANTS
   ═══════════════════════════════════════════ */
const accentColor = '#2dd4d4'
const cardStyle = {
  background: '#0d1a1c',
  border: '1px solid rgba(45,212,212,0.12)',
  borderRadius: '12px',
  padding: '24px',
}

/* ═══════════════════════════════════════════
   COLUMN DEFINITIONS
   ═══════════════════════════════════════════ */
const COLUMNS = [
  { key: 'row_index', label: '#', width: '40px' },
  { key: 'name', label: 'Name', width: '120px' },
  { key: 'canonical_smiles', label: 'SMILES', width: '180px' },
  { key: 'molecular_weight', label: 'MW', width: '70px' },
  { key: 'logp', label: 'LogP', width: '60px' },
  { key: 'tpsa', label: 'TPSA', width: '60px' },
  { key: 'pred_herg_confidence', label: 'hERG', width: '65px', isPred: true, statusKey: 'pred_herg_status' },
  { key: 'pred_antiinflammatory_confidence', label: 'Anti-infl.', width: '80px', isPred: true, statusKey: 'pred_antiinflammatory_status' },
  { key: 'pred_antioxidant_confidence', label: 'Antioxid.', width: '80px', isPred: true, statusKey: 'pred_antioxidant_status' },
  { key: 'pred_antimicrobial_confidence', label: 'Antimicr.', width: '80px', isPred: true, statusKey: 'pred_antimicrobial_status' },
  { key: 'pred_anticancer_confidence', label: 'Anticanc.', width: '80px', isPred: true, statusKey: 'pred_anticancer_status' },
  { key: 'pred_tox21_mmp_confidence', label: 'Tox21', width: '65px', isPred: true, statusKey: 'pred_tox21_mmp_status' },
  { key: 'sa_score', label: 'SA Score', width: '80px' },
  { key: 'sa_difficulty', label: 'SA Diff.', width: '70px' },
  { key: 'contradiction_flags', label: 'Flags', width: '50px' },
]

function getBadgeColor(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('low risk') || s === 'active') return '#4ade80'
  if (s.includes('high risk') || s === 'inactive') return '#f87171'
  return '#94a3b8'
}

function getSaDiffColor(diff) {
  if (diff === 'easy') return '#4ade80'
  if (diff === 'moderate') return '#fbbf24'
  if (diff === 'difficult') return '#f87171'
  return '#94a3b8'
}


/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function BatchScreening({ isEmbedded = false }) {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  // State
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [errors, setErrors] = useState([])
  const [summary, setSummary] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [powerStatus, setPowerStatus] = useState(null)
  const [showPowerDropdown, setShowPowerDropdown] = useState(false)

  // Prevent browser from opening dragged files globally
  useEffect(() => {
    const preventDefault = (e) => e.preventDefault()
    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)
    return () => {
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
    }
  }, [])

  // Fetch power status on mount
  useEffect(() => {
    api.get('/api/power/status').then(setPowerStatus).catch(() => {})
  }, [])

  const handlePowerSettingChange = async (mode) => {
    try {
      await api.post('/api/power/setting', { mode })
      const updated = await api.get('/api/power/status')
      setPowerStatus(updated)
    } catch (e) {
      console.error('Failed to change power setting:', e)
    }
    setShowPowerDropdown(false)
  }

  // File handling
  const handleFile = useCallback((f) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file (.csv)')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5 MB.')
      return
    }
    setFile(f)
    setError('')
    setResults(null)
    setErrors([])
    setSummary(null)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const f = e.dataTransfer?.files?.[0]
    handleFile(f)
  }, [handleFile])

  // Upload & process
  const handleSubmit = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await api.upload('/api/batch/screen', formData)
      setResults(data.results || [])
      setErrors(data.errors || [])
      setSummary(data.summary || {})
    } catch (e) {
      setError(e.message || 'Batch screening failed')
    } finally {
      setIsProcessing(false)
    }
  }, [file])

  // Sorting
  const handleSort = useCallback((colKey) => {
    if (sortCol === colKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(colKey)
      setSortDir('asc')
    }
  }, [sortCol])

  const sortedResults = results ? [...results].sort((a, b) => {
    if (!sortCol) return 0
    let va = a[sortCol], vb = b[sortCol]
    if (va == null) va = ''
    if (vb == null) vb = ''
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va))
  }) : []

  // Export CSV
  const exportCsv = useCallback(() => {
    if (!results || results.length === 0) return
    const csvCols = COLUMNS.map(c => c.label)
    const csvRows = sortedResults.map(r =>
      COLUMNS.map(c => {
        const val = r[c.key]
        if (val == null) return ''
        if (typeof val === 'string' && (val.includes(',') || val.includes('"')))
          return `"${val.replace(/"/g, '""')}"`
        return String(val)
      })
    )
    const csvContent = [csvCols.join(','), ...csvRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rogveda_batch_results_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [results, sortedResults])

  // Export PDF
  const exportPdf = useCallback(async () => {
    if (!results || results.length === 0) return
    try {
      const data = await api.post('/api/batch/report', {
        results, errors, summary,
      })
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(data.html)
        win.document.close()
      }
    } catch (e) {
      setError('Failed to generate PDF report: ' + (e.message || ''))
    }
  }, [results, errors, summary])

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div style={{ minHeight: isEmbedded ? 'calc(100vh - 120px)' : '100vh', background: isEmbedded ? 'transparent' : '#050d0f', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {!isEmbedded && <TopNav />}
      <div style={{ paddingTop: isEmbedded ? '20px' : '80px', maxWidth: '1440px', margin: '0 auto', padding: isEmbedded ? '20px 32px 40px' : '80px 32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/home')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.15)',
                color: accentColor, cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,212,0.08)'}
            >
              {Icons.back}
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: accentColor }}>{Icons.beaker}</span>
                Batch Screening
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                Upload a CSV file with SMILES to screen up to 500 molecules at once
              </p>
            </div>
          </div>

          {results && results.length > 0 && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={exportCsv}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  background: 'rgba(45,212,212,0.1)', border: '1px solid rgba(45,212,212,0.25)',
                  color: accentColor, cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,212,0.1)'}
              >
                {Icons.download} Export CSV
              </button>
              <button
                onClick={exportPdf}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  background: 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
                  border: 'none', color: '#000', cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  boxShadow: '0 4px 15px rgba(45,212,212,0.25)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(45,212,212,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(45,212,212,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {Icons.download} Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '14px 18px', marginBottom: '16px', borderRadius: '10px',
            background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
            color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            {Icons.alert}
            {error}
          </div>
        )}

        {/* Upload Zone (shown when no results yet) */}
        {!results && !isProcessing && (
          <div style={cardStyle}>

            {/* Power Status Banner */}
            {powerStatus && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', marginBottom: '16px', borderRadius: '10px',
                background: powerStatus.is_throttled ? 'rgba(251,191,36,0.08)' : 'rgba(74,222,128,0.06)',
                border: `1px solid ${powerStatus.is_throttled ? 'rgba(251,191,36,0.25)' : 'rgba(74,222,128,0.15)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: powerStatus.is_throttled ? '#fbbf24' : '#4ade80' }}>
                    {powerStatus.power_source === 'plugged_in' ? Icons.plug : powerStatus.power_source === 'on_battery' ? Icons.battery : Icons.monitor}
                  </span>
                  <span style={{ color: powerStatus.is_throttled ? '#fbbf24' : '#4ade80', fontWeight: 500 }}>
                    {powerStatus.is_throttled
                      ? `Power Saver active${powerStatus.battery_percent != null ? ` — ${powerStatus.battery_percent}% battery` : ''}`
                      : powerStatus.power_source === 'plugged_in'
                        ? 'Plugged in — full speed'
                        : powerStatus.power_source === 'on_battery'
                          ? `On battery (${powerStatus.battery_percent ?? '?'}%) — full speed (override)`
                          : 'Desktop — full speed'
                    }
                  </span>
                  {powerStatus.is_throttled && (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                      Processing speed reduced to conserve battery
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPowerDropdown(p => !p) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {powerStatus.power_saver_setting === 'auto' ? <>{Icons.settings} Auto</>
                      : powerStatus.power_saver_setting === 'always_on' ? <>{Icons.leaf} Always On</>
                      : <>{Icons.zap} Always Off</>}
                  </button>
                  {showPowerDropdown && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: '6px',
                      background: '#0d1a1c', border: '1px solid rgba(45,212,212,0.2)',
                      borderRadius: '8px', overflow: 'hidden', zIndex: 100,
                      minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}>
                      {[
                        { mode: 'auto', label: 'Auto', desc: 'Sensor-based', icon: Icons.settings },
                        { mode: 'always_on', label: 'Always On', desc: 'Always throttle', icon: Icons.leaf },
                        { mode: 'always_off', label: 'Always Off', desc: 'Full speed always', icon: Icons.zap },
                      ].map(opt => (
                        <button
                          key={opt.mode}
                          onClick={(e) => { e.stopPropagation(); handlePowerSettingChange(opt.mode) }}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', padding: '10px 14px',
                            textAlign: 'left', border: 'none', cursor: 'pointer',
                            background: powerStatus.power_saver_setting === opt.mode ? 'rgba(45,212,212,0.1)' : 'transparent',
                            color: '#e2e8f0', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = powerStatus.power_saver_setting === opt.mode ? 'rgba(45,212,212,0.1)' : 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', color: powerStatus.power_saver_setting === opt.mode ? accentColor : '#94a3b8', marginTop: '2px' }}>
                            {opt.icon}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{opt.label}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? accentColor : 'rgba(45,212,212,0.2)'}`,
                borderRadius: '12px',
                padding: '60px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragging ? 'rgba(45,212,212,0.05)' : 'transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])}
              />
              <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: accentColor, opacity: 0.6, marginBottom: '16px' }}>
                  {Icons.upload}
                </div>
                <h3 style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>
                  {file ? file.name : 'Drop your CSV file here or click to browse'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  CSV must contain a <code style={{ color: accentColor }}>smiles</code> column.
                  Optional: <code style={{ color: '#94a3b8' }}>name</code> column.
                  Max 500 rows, 5 MB.
                </p>
              </div>

              {file && (
                <div style={{
                  marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.2)',
                }}>
                  <span style={{ color: accentColor }}>{Icons.file}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
                    {file.name}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>

            {file && (
              <button
                onClick={handleSubmit}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  width: '100%', marginTop: '20px', padding: '14px 0',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #2dd4d4 0%, #22b8b8 100%)',
                  color: '#000', fontFamily: 'Inter, system-ui, sans-serif',
                  boxShadow: '0 4px 20px rgba(45,212,212,0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(45,212,212,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(45,212,212,0.3)' }}
              >
                {Icons.beaker}
                Start Batch Screening
              </button>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div style={{
            ...cardStyle,
            textAlign: 'center', padding: '80px 40px',
          }}>
            <div style={{
              width: '48px', height: '48px', margin: '0 auto 20px',
              border: '3px solid rgba(45,212,212,0.2)',
              borderTopColor: accentColor, borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h3 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>
              Processing molecules...
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              ⚠️ Do not close this tab. This may take a minute for large files.
            </p>
          </div>
        )}

        {/* Summary bar */}
        {summary && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
            marginBottom: '20px',
          }}>
            {[
              { value: summary.total, label: 'Total', color: '#e2e8f0' },
              { value: summary.succeeded, label: 'Succeeded', color: '#4ade80' },
              { value: summary.failed, label: 'Failed', color: summary.failed > 0 ? '#f87171' : '#4ade80' },
              { value: `${summary.elapsed_seconds}s`, label: 'Time', color: accentColor },
            ].map((s, i) => (
              <div key={i} style={{
                ...cardStyle, textAlign: 'center', padding: '16px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Results table */}
        {results && results.length > 0 && (
          <div style={{ ...cardStyle, padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(45,212,212,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {Icons.check}
                Results ({results.length} molecules)
              </h3>
              <span style={{ color: '#475569', fontSize: '12px' }}>Click column headers to sort</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: '12px',
                minWidth: '1200px',
              }}>
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{
                          padding: '10px 8px', textAlign: 'left', whiteSpace: 'nowrap',
                          background: '#081214', color: '#94a3b8', fontWeight: 600,
                          borderBottom: '1px solid rgba(45,212,212,0.1)',
                          cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s',
                          width: col.width, fontSize: '11px', letterSpacing: '0.02em',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {col.label}
                          <span style={{ color: sortCol === col.key ? accentColor : '#334155' }}>
                            {sortCol === col.key ? (sortDir === 'asc' ? Icons.sortUp : Icons.sortDown) : Icons.sort}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {COLUMNS.map(col => {
                        const val = row[col.key]

                        // Prediction columns
                        if (col.isPred) {
                          const status = row[col.statusKey] || ''
                          const color = getBadgeColor(status)
                          return (
                            <td key={col.key} style={{ padding: '8px', color }}>
                              {val != null ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '11px' }}>{Math.round(val * 100)}%</div>
                                  <div style={{ fontSize: '10px', opacity: 0.7 }}>{status}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#475569', fontStyle: 'italic' }}>N/A</span>
                              )}
                            </td>
                          )
                        }

                        // SA difficulty
                        if (col.key === 'sa_difficulty') {
                          return (
                            <td key={col.key} style={{ padding: '8px', color: getSaDiffColor(val), fontWeight: 600, fontSize: '11px' }}>
                              {val || '-'}
                            </td>
                          )
                        }

                        // SMILES (truncated)
                        if (col.key === 'canonical_smiles') {
                          const display = val && val.length > 25 ? val.slice(0, 22) + '...' : val
                          return (
                            <td key={col.key} style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }} title={val}>
                              {display || '-'}
                            </td>
                          )
                        }

                        // Contradiction flags
                        if (col.key === 'contradiction_flags') {
                          return (
                            <td key={col.key} style={{ padding: '8px', textAlign: 'center', color: val > 0 ? '#fbbf24' : '#334155', fontWeight: val > 0 ? 700 : 400 }}>
                              {val || 0}
                            </td>
                          )
                        }

                        // Default
                        return (
                          <td key={col.key} style={{ padding: '8px', color: '#c8d0d8' }}>
                            {val != null ? val : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Errors section */}
        {errors.length > 0 && (
          <div style={{ ...cardStyle, padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {Icons.alert}
              <h3 style={{ color: '#f87171', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Failed Rows ({errors.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Row', 'Name', 'SMILES', 'Reason'].map(h => (
                      <th key={h} style={{
                        padding: '10px 12px', textAlign: 'left', background: 'rgba(220,38,38,0.06)',
                        color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(220,38,38,0.1)',
                        fontSize: '11px',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{err.row_index}</td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{err.name || '-'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{err.smiles}</td>
                      <td style={{ padding: '10px 12px', color: '#f87171' }}>{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New batch button */}
        {results && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              onClick={() => { setResults(null); setErrors([]); setSummary(null); setFile(null); setError('') }}
              style={{
                padding: '12px 32px', borderRadius: '10px',
                background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.2)',
                color: accentColor, fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,212,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,212,0.08)'}
            >
              Screen Another Batch
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
