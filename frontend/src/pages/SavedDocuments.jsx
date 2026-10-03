import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/apiClient'
import TopNav from '../components/TopNav'

/* ═══════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════ */
const Icons = {
  doc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  view: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  empty: <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  molecule: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><line x1="8.7" y1="7.5" x2="15.3" y2="10.5"/><line x1="8.7" y1="16.5" x2="15.3" y2="13.5"/></svg>,
}

const accentColor = '#2dd4d4'

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function SavedDocuments() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  // Load user + documents
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await api.get('/api/auth/me')
        setUser(userData)
      } catch {
        navigate('/login')
        return
      }

      try {
        const docs = await api.get('/api/reports/documents')
        setDocuments(docs)
      } catch (e) {
        console.error('Failed to load documents:', e)
        // Fallback to localStorage
        try {
          const localDocs = JSON.parse(localStorage.getItem('rogveda_documents') || '[]')
          setDocuments(localDocs.map((d, i) => ({
            id: d.id || i,
            name: d.name,
            format: d.format,
            smiles: null,
            created_at: d.date,
            html_content: d.content,
          })))
        } catch { }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [navigate])

  // View a document
  const handleView = async (doc) => {
    try {
      let html = doc.html_content
      if (!html) {
        // Fetch full content from API
        const full = await api.get(`/api/reports/documents/${doc.id}`)
        html = full.html_content
      }
      if (html) {
        const win = window.open('', '', 'width=900,height=700')
        if (win) {
          // Remove the auto-print script so they can just view
          const viewHtml = html.replace(/<script>[\s\S]*?<\/script>/gi, '')
          win.document.write(viewHtml)
          win.document.close()
        }
      }
    } catch (e) {
      console.error('Failed to view document:', e)
    }
  }

  // Download (print) a document
  const handleDownload = async (doc) => {
    try {
      let html = doc.html_content
      if (!html) {
        const full = await api.get(`/api/reports/documents/${doc.id}`)
        html = full.html_content
      }
      if (html) {
        const win = window.open('', '', 'width=900,height=700')
        if (win) {
          win.document.write(html)
          win.document.close()
        }
      }
    } catch (e) {
      console.error('Failed to download document:', e)
    }
  }

  // Delete a document
  const handleDelete = async (doc) => {
    setDeletingId(doc.id)
    try {
      await api.delete(`/api/reports/documents/${doc.id}`)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
    } catch (e) {
      console.error('Failed to delete document:', e)
      // Fallback for localStorage docs
      try {
        const localDocs = JSON.parse(localStorage.getItem('rogveda_documents') || '[]')
        const filtered = localDocs.filter(d => d.id !== doc.id)
        localStorage.setItem('rogveda_documents', JSON.stringify(filtered))
        setDocuments(prev => prev.filter(d => d.id !== doc.id))
      } catch { }
    } finally {
      setDeletingId(null)
    }
  }

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d0f' }}>
      <TopNav user={user} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.15)',
              color: accentColor, cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,212,0.08)' }}
          >
            {Icons.back} Back to Dashboard
          </button>

          <div style={{ flex: 1 }}>
            <h1 style={{
              color: '#fff', fontSize: '24px', fontWeight: 700,
              fontFamily: 'Inter, system-ui, sans-serif', margin: 0,
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ color: accentColor, display: 'flex' }}>{Icons.doc}</span>
              Saved Documents
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} saved
            </p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: '14px' }}>
            Loading documents...
          </div>
        )}

        {/* Empty state */}
        {!loading && documents.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            background: '#0a1416', borderRadius: '12px',
            border: '1px solid rgba(45,212,212,0.08)',
          }}>
            <div style={{ color: '#2dd4d4', marginBottom: '16px' }}>{Icons.empty}</div>
            <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              No Documents Yet
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              Generated reports are automatically saved here when you click "Generate Report" in your workspace.
            </p>
            <button
              onClick={() => navigate('/draw')}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: accentColor, color: '#000', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              Go to Workspace
            </button>
          </div>
        )}

        {/* Document list */}
        {!loading && documents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '18px 20px', borderRadius: '10px',
                  background: '#0a1416', border: '1px solid rgba(45,212,212,0.1)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45,212,212,0.25)'; e.currentTarget.style.background = '#0c181a' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(45,212,212,0.1)'; e.currentTarget.style.background = '#0a1416' }}
              >
                {/* Document icon */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'rgba(45,212,212,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: accentColor, flexShrink: 0,
                }}>
                  {Icons.doc}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {formatDate(doc.created_at)}
                    </span>
                    {doc.format && (
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                        background: 'rgba(45,212,212,0.1)', color: accentColor, fontWeight: 500,
                      }}>
                        {doc.format}
                      </span>
                    )}
                    {doc.smiles && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', color: '#475569', fontFamily: 'monospace',
                        maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {Icons.molecule} {doc.smiles}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleView(doc)}
                    title="View"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '36px', height: '36px', borderRadius: '8px',
                      background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.12)',
                      color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = accentColor; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.12)' }}
                  >
                    {Icons.view}
                  </button>

                  <button
                    onClick={() => handleDownload(doc)}
                    title="Download / Print"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '36px', height: '36px', borderRadius: '8px',
                      background: 'rgba(45,212,212,0.08)', border: '1px solid rgba(45,212,212,0.12)',
                      color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = accentColor; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(45,212,212,0.12)' }}
                  >
                    {Icons.download}
                  </button>

                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    title="Delete"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '36px', height: '36px', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)',
                      color: '#64748b', cursor: deletingId === doc.id ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s', opacity: deletingId === doc.id ? 0.4 : 1,
                    }}
                    onMouseEnter={e => { if (deletingId !== doc.id) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.1)' }}
                  >
                    {Icons.trash}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
