import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, del, isAuthenticated } from '../lib/apiClient.js'
import { experimentService } from '../lib/experimentService'
import { addHistory, addNotification } from '../lib/events'
import TopNav from '../components/TopNav.jsx'

export default function Experiments() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  
  const [activeTab, setActiveTab] = useState('experiments') // 'experiments' or 'documents'
  
  const [experiments, setExperiments] = useState([])
  const [documents, setDocuments] = useState([])
  
  const [selectedExps, setSelectedExps] = useState(new Set())
  const [selectedDocs, setSelectedDocs] = useState(new Set())

  const [expSortOrder, setExpSortOrder] = useState('desc')
  const [docSortOrder, setDocSortOrder] = useState('desc')
  
  const [editingExpId, setEditingExpId] = useState(null)
  const [editingExpName, setEditingExpName] = useState('')

  const [expSearchQuery, setExpSearchQuery] = useState('')
  const [docSearchQuery, setDocSearchQuery] = useState('')

  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const [storyLoading, setStoryLoading] = useState(false)
  const [storyData, setStoryData] = useState(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    get('/api/auth/me').then(setUser).catch(() => {
      navigate('/login')
    })
    
    experimentService.syncExperiments().then(exps => {
      setExperiments(exps)
    })

    get('/api/reports/documents').then(docs => {
      setDocuments(docs)
    }).catch(e => console.error('Failed to fetch documents', e))
  }, [navigate])

  const filteredExps = experiments.filter(e => {
    const query = expSearchQuery.toLowerCase()
    const nameMatch = (e.name || 'Untitled Experiment').toLowerCase().includes(query)
    const dateMatch = e.date ? new Date(e.date).toLocaleString().toLowerCase().includes(query) : false
    return nameMatch || dateMatch
  })
  const sortedExperiments = [...filteredExps].sort((a,b) => {
    return expSortOrder === 'desc' 
      ? new Date(b.date) - new Date(a.date) 
      : new Date(a.date) - new Date(b.date)
  })

  const filteredDocs = documents.filter(d => {
    const query = docSearchQuery.toLowerCase()
    const nameMatch = (d.name || 'Untitled Document').toLowerCase().includes(query)
    const dateMatch = d.created_at ? new Date(d.created_at).toLocaleString().toLowerCase().includes(query) : false
    return nameMatch || dateMatch
  })
  const sortedDocuments = [...filteredDocs].sort((a,b) => {
    return docSortOrder === 'desc' 
      ? new Date(b.created_at) - new Date(a.created_at) 
      : new Date(a.created_at) - new Date(b.created_at)
  })

  // --- Handlers for Experiments ---
  const toggleExpSort = () => setExpSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  
  const startRenameExp = (exp) => {
    setEditingExpId(exp.id)
    setEditingExpName(exp.name || 'Untitled Experiment')
  }

  const saveRenameExp = async (id) => {
    const updated = await experimentService.renameExperiment(id, editingExpName)
    setExperiments(updated)
    setEditingExpId(null)
    addHistory(`Renamed experiment to ${editingExpName}`)
    addNotification('Experiment Renamed', `Experiment is now "${editingExpName}"`)
  }
  const handleSelectExp = (id) => {
    const next = new Set(selectedExps)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedExps(next)
  }
  const handleSelectAllExps = () => {
    if (selectedExps.size === filteredExps.length && filteredExps.length > 0) {
      setSelectedExps(new Set())
    } else {
      setSelectedExps(new Set(filteredExps.map(e => e.id)))
    }
  }
  const handleDeleteExps = async () => {
    let currentExps = experiments
    for (const id of selectedExps) {
      currentExps = await experimentService.deleteExperiment(id)
    }
    setExperiments(currentExps)
    setSelectedExps(new Set())
    addHistory(`Deleted ${selectedExps.size} experiment(s)`)
    addNotification('Experiments Deleted', `${selectedExps.size} experiment(s) removed.`)
  }
  const handleOpenExp = (exp) => {
    localStorage.setItem('rogveda_autosave', exp.molfile)
    localStorage.setItem('rogveda_autosave_expId', exp.id)
    if (exp.db_id) {
      localStorage.setItem('rogveda_autosave_dbId', exp.db_id)
    } else {
      localStorage.removeItem('rogveda_autosave_dbId')
    }
    navigate('/draw')
  }

  const handleTellStory = async (exp) => {
    setStoryModalOpen(true)
    setStoryLoading(true)
    setStoryData(null)
    try {
      const data = await get(`/api/experiments/${exp.db_id}/story`)
      setStoryData(data)
    } catch (err) {
      console.error('Failed to get story', err)
      setStoryData({ error: err.message || 'Failed to load story.' })
    } finally {
      setStoryLoading(false)
    }
  }

  // --- Handlers for Documents ---
  const toggleDocSort = () => setDocSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  
  const handleSelectDoc = (id) => {
    const next = new Set(selectedDocs)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedDocs(next)
  }
  const handleSelectAllDocs = () => {
    if (selectedDocs.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(filteredDocs.map(d => d.id)))
    }
  }
  const handleDeleteDocs = async () => {
    for (const id of selectedDocs) {
      try {
        await del(`/api/reports/documents/${id}`)
      } catch (e) {
        console.error('Failed to delete document', id, e)
      }
    }
    const remaining = documents.filter(d => !selectedDocs.has(d.id))
    setDocuments(remaining)
    setSelectedDocs(new Set())
    addHistory(`Deleted ${selectedDocs.size} document(s)`)
    addNotification('Documents Deleted', `${selectedDocs.size} document(s) removed.`)
  }
  const handleDownloadDoc = async (doc) => {
    const printWindow = window.open('', '', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.write('<h2>Loading Document...</h2>')
    }
    try {
      const fullDoc = await get(`/api/reports/documents/${doc.id}`)
      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(fullDoc.html_content)
        printWindow.document.close()
      }
    } catch (e) {
      console.error('Failed to open document', e)
      addNotification('Error', 'Failed to load document content.', 'error')
      if (printWindow) printWindow.close()
    }
  }

  if (!user) return <div className="min-h-screen" style={{ background: '#050d0f' }} />

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: '#050d0f' }}>
      <TopNav user={user} />
      
      {/* Background Glows */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle 900px at 50% -100px, rgba(45, 212, 191, 0.08), transparent 70%), radial-gradient(circle 600px at 85% 85%, rgba(37, 99, 235, 0.06), transparent 70%)',
          zIndex: 0,
        }}
      />

      <main 
        className="relative z-10 flex flex-col flex-1"
        style={{ 
          paddingTop: '100px', 
          paddingBottom: '40px',
          paddingLeft: '32px',
          paddingRight: '32px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        <div className="w-full flex justify-start mb-6">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-[#8aafaf] hover:text-[#2dd4d4] transition-colors duration-200 uppercase font-bold tracking-wider text-xs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            BACK TO HOME
          </button>
        </div>
        <h1 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          Workspace Management
        </h1>
        
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#1c3333]">
          <button 
            className={`pb-3 px-2 text-sm uppercase tracking-wider font-bold transition-all ${activeTab === 'experiments' ? 'text-[#2dd4d4] border-b-2 border-[#2dd4d4]' : 'text-[#8aafaf] hover:text-[#c0dede]'}`}
            onClick={() => setActiveTab('experiments')}
          >
            Saved Experiments
          </button>
          <button 
            className={`pb-3 px-2 text-sm uppercase tracking-wider font-bold transition-all ${activeTab === 'documents' ? 'text-[#2dd4d4] border-b-2 border-[#2dd4d4]' : 'text-[#8aafaf] hover:text-[#c0dede]'}`}
            onClick={() => setActiveTab('documents')}
          >
            Saved Documents
          </button>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 flex flex-col rounded-xl overflow-hidden"
          style={{ background: 'rgba(10, 24, 26, 0.6)', border: '1px solid rgba(45,212,212,0.1)' }}
        >
          {activeTab === 'experiments' && (
            <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="selectAllExps"
                      className="w-5 h-5 accent-[#2dd4d4] cursor-pointer"
                      checked={filteredExps.length > 0 && selectedExps.size === filteredExps.length}
                      onChange={handleSelectAllExps}
                    />
                    <label htmlFor="selectAllExps" className="text-[#a0c4c4] text-sm cursor-pointer select-none">Select All</label>
                  </div>
                  <button 
                    onClick={toggleExpSort}
                    className="text-[#8aafaf] hover:text-[#2dd4d4] text-sm flex items-center gap-1 transition-colors"
                  >
                    Sort Date: {expSortOrder === 'desc' ? 'Newest First ▼' : 'Oldest First ▲'}
                  </button>
                  <input
                    type="text"
                    placeholder="Search experiments..."
                    value={expSearchQuery}
                    onChange={e => setExpSearchQuery(e.target.value)}
                    className="bg-[rgba(20,40,40,0.7)] border border-[rgba(45,212,212,0.15)] rounded-full px-4 py-1 text-sm text-white placeholder-[#5a8080] outline-none focus:border-[#2dd4d4] transition-colors"
                  />
                </div>
                <button 
                  onClick={handleDeleteExps}
                  disabled={selectedExps.size === 0}
                  className="px-4 py-2 text-sm rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  style={{
                    background: selectedExps.size > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: selectedExps.size > 0 ? '#ef4444' : '#64748b',
                    border: `1px solid ${selectedExps.size > 0 ? 'rgba(239, 68, 68, 0.4)' : 'transparent'}`
                  }}
                >
                  Delete Selected ({selectedExps.size})
                </button>
              </div>

              {experiments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[#8aafaf] text-sm">
                  No saved experiments found.
                </div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                  {sortedExperiments.map(exp => (
                    <div 
                      key={exp.id} 
                      className="flex items-center justify-between p-4 rounded-lg transition-all"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(45,212,212,0.05)' }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-[#2dd4d4] cursor-pointer"
                          checked={selectedExps.has(exp.id)}
                          onChange={() => handleSelectExp(exp.id)}
                        />
                        <div className="flex flex-col flex-1 pr-4">
                          {editingExpId === exp.id ? (
                            <input
                              type="text"
                              value={editingExpName}
                              onChange={e => setEditingExpName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveRenameExp(exp.id)}
                              autoFocus
                              className="bg-transparent border-b border-[#2dd4d4] text-white font-medium text-lg outline-none w-full"
                            />
                          ) : (
                            <span className="text-white font-medium text-lg">{exp.name || 'Untitled Experiment'}</span>
                          )}
                          <span className="text-[#8aafaf] text-xs mt-1">{new Date(exp.date).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {editingExpId === exp.id ? (
                          <button 
                            onClick={() => saveRenameExp(exp.id)}
                            className="px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all text-[#2dd4d4]"
                            style={{ background: 'rgba(45,212,212,0.05)' }}
                          >
                            Save
                          </button>
                        ) : (
                          <button 
                            onClick={() => startRenameExp(exp)}
                            className="px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all text-[#a0c4c4] hover:text-white"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            Rename
                          </button>
                        )}
                        {exp.parent_experiment_id && (
                          <button 
                            onClick={() => handleTellStory(exp)}
                            className="px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all hover:bg-[rgba(168,85,247,0.2)] hover:text-purple-400"
                            style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                          >
                            Tell Story
                          </button>
                        )}
                        <button 
                          onClick={() => handleOpenExp(exp)}
                          className="px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all hover:bg-[#2dd4d4] hover:text-black"
                          style={{ background: 'rgba(45,212,212,0.1)', color: '#2dd4d4', border: '1px solid rgba(45,212,212,0.3)' }}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="selectAllDocs"
                      className="w-5 h-5 accent-[#2dd4d4] cursor-pointer"
                      checked={filteredDocs.length > 0 && selectedDocs.size === filteredDocs.length}
                      onChange={handleSelectAllDocs}
                    />
                    <label htmlFor="selectAllDocs" className="text-[#a0c4c4] text-sm cursor-pointer select-none">Select All</label>
                  </div>
                  <button 
                    onClick={toggleDocSort}
                    className="text-[#8aafaf] hover:text-[#2dd4d4] text-sm flex items-center gap-1 transition-colors"
                  >
                    Sort Date: {docSortOrder === 'desc' ? 'Newest First ▼' : 'Oldest First ▲'}
                  </button>
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={docSearchQuery}
                    onChange={e => setDocSearchQuery(e.target.value)}
                    className="bg-[rgba(20,40,40,0.7)] border border-[rgba(45,212,212,0.15)] rounded-full px-4 py-1 text-sm text-white placeholder-[#5a8080] outline-none focus:border-[#2dd4d4] transition-colors"
                  />
                </div>
                <button 
                  onClick={handleDeleteDocs}
                  disabled={selectedDocs.size === 0}
                  className="px-4 py-2 text-sm rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  style={{
                    background: selectedDocs.size > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: selectedDocs.size > 0 ? '#ef4444' : '#64748b',
                    border: `1px solid ${selectedDocs.size > 0 ? 'rgba(239, 68, 68, 0.4)' : 'transparent'}`
                  }}
                >
                  Delete Selected ({selectedDocs.size})
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[#8aafaf] text-sm">
                  No saved documents found. Go to the Workspace and generate a report to save it.
                </div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                  {sortedDocuments.map(doc => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between p-4 rounded-lg transition-all"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(45,212,212,0.05)' }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-[#2dd4d4] cursor-pointer"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => handleSelectDoc(doc.id)}
                        />
                        <div className="flex flex-col">
                          <span className="text-white font-medium text-lg">{doc.name}</span>
                          <span className="text-[#8aafaf] text-xs mt-1">{new Date(doc.created_at).toLocaleString()} • {doc.format}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDownloadDoc(doc)}
                        className="px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all hover:bg-[#2dd4d4] hover:text-black shrink-0"
                        style={{ background: 'rgba(45,212,212,0.1)', color: '#2dd4d4', border: '1px solid rgba(45,212,212,0.3)' }}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Story Modal */}
      {storyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-[#0a181a] border border-[#2dd4d4] border-opacity-30 rounded-xl p-8 max-w-2xl w-full shadow-2xl relative flex flex-col">
            <button 
              onClick={() => setStoryModalOpen(false)}
              className="absolute top-4 right-4 text-[#8aafaf] hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h2 className="text-2xl font-bold text-white mb-6 font-serif">Modification Story</h2>
            
            {storyLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#2dd4d4] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[#a0c4c4]">Narrating optimization journey...</p>
              </div>
            ) : storyData?.error ? (
              <div className="text-red-400 bg-red-900 bg-opacity-20 border border-red-500 rounded p-4">
                {storyData.error}
              </div>
            ) : storyData ? (
              <div className="flex flex-col gap-6">
                <div className="text-[#e2e8f0] leading-relaxed whitespace-pre-wrap bg-[#13282b] p-6 rounded-lg border border-[#1c3333]">
                  {storyData.narration}
                </div>
                <div className="text-xs text-[#8aafaf] text-right font-mono">
                  Chain length: {storyData.chain_length} steps
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
