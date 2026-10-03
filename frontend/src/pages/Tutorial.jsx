import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post, isAuthenticated } from '../lib/apiClient.js'
import TopNav from '../components/TopNav.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* ════════════════════════════════════════════════════════════
   SVG ICON COMPONENTS — Matching the screenshot design
   ════════════════════════════════════════════════════════════ */

function RobotIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <circle cx="9" cy="14" r="1.5" fill="#2dd4d4" />
      <circle cx="15" cy="14" r="1.5" fill="#2dd4d4" />
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <circle cx="12" cy="3" r="1" fill="#2dd4d4" />
    </svg>
  )
}

/* Feature card icons — all teal stroke matching screenshot */
function DrawIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <line x1="9.3" y1="7" x2="14.7" y2="7" />
      <line x1="7" y1="9.3" x2="7" y2="14.7" />
      <line x1="17" y1="9.3" x2="17" y2="14.7" />
      <line x1="9.3" y1="17" x2="14.7" y2="17" />
    </svg>
  )
}

function AnalysisIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round">
      <rect x="4" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="8" width="4" height="12" rx="1" />
      <rect x="16" y="2" width="4" height="18" rx="1" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PredictionIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="18.5" cy="8" r="1.5" />
      <circle cx="18.5" cy="16" r="1.5" />
      <circle cx="12" cy="20" r="1.5" />
      <circle cx="5.5" cy="16" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <line x1="12" y1="5.5" x2="12" y2="9" />
      <line x1="17.2" y1="8.8" x2="14.6" y2="10.3" />
      <line x1="17.2" y1="15.2" x2="14.6" y2="13.7" />
      <line x1="12" y1="18.5" x2="12" y2="15" />
      <line x1="6.8" y1="15.2" x2="9.4" y2="13.7" />
      <line x1="6.8" y1="8.8" x2="9.4" y2="10.3" />
    </svg>
  )
}

function ModificationIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function CompareIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 8l-5-6-5 6" />
      <path d="M17 16l-5 6-5-6" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  )
}

function BatchIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14l6 4 6-4" />
      <path d="M6 10l6 4 6-4" />
      <path d="M6 6l6 4 6-4" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════
   FEATURE DATA
   ════════════════════════════════════════════════════════════ */

const features = [
  {
    icon: <DrawIcon />,
    title: 'Draw / Input Molecule',
    desc: 'Create a molecule using the 2D/3D editor or enter a SMILES string. Use the drawing tools to add atoms, bonds and templates, and visualize your structure in 2D or 3D.',
  },
  {
    icon: <AnalysisIcon />,
    title: 'Molecular Analysis',
    desc: 'After drawing or inputting a molecule, run analysis to calculate key properties and descriptors. View the results on the right panel for a quick overview.',
  },
  {
    icon: <SearchIcon />,
    title: 'Similarity Search',
    desc: 'Find similar molecules by drawing, inputting or selecting a reference molecule. View the most similar structures from local datasets and explore their similarity scores.',
  },
  {
    icon: <PredictionIcon />,
    title: 'Prediction & AI',
    desc: 'Choose the prediction type (e.g., activity, toxicity, or binding) and run the model on your molecule. View the predicted results along with an AI-generated interpretation.',
  },
  {
    icon: <ModificationIcon />,
    title: 'Molecular Modifications',
    desc: 'Use the modification tools to generate modified versions of your molecule. Visualize the changes in 2D or 3D and compare the modified structures.',
  },
  {
    icon: <CompareIcon />,
    title: 'Compare Molecules',
    desc: 'Select two molecules (draw, input or choose from your workspace) to compare their properties, structural differences and similarity metrics side by side.',
  },
  {
    icon: <BatchIcon />,
    title: 'Batch Screening',
    desc: 'Upload or input multiple molecules (up to 500) and choose the required analysis or prediction option. Run the batch to get results for all molecules at once.',
  },
]

/* ════════════════════════════════════════════════════════════
   TUTORIAL PAGE COMPONENT
   ════════════════════════════════════════════════════════════ */

export default function Tutorial() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  // Chat state
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Rogveda AI. I can help you understand how to use the platform, interpret molecular properties, or answer general questions. How can I assist you today?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    get('/api/auth/me').then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const data = await post('/api/chat/', { messages: [...messages, userMsg] })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'Connection error.' }])
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return <div className="min-h-screen" style={{ background: '#050d0f' }} />

  return (
    <div className="relative min-h-screen" style={{ background: '#050d0f' }}>
      <TopNav user={user} />

      <main
        className="px-6 md:px-12 flex flex-col items-center"
        style={{
          paddingTop: '120px',
          paddingBottom: '80px',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Back button */}
        <div className="w-full flex justify-start mb-6">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-[#8aafaf] hover:text-[#2dd4d4] transition-colors duration-200 uppercase font-bold tracking-wider text-xs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            BACK TO HOME
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            <span style={{ color: '#ffffff' }}>How can we </span>
            <span style={{ color: '#2dd4d4' }}>start?</span>
          </h1>
          <p className="text-[#a0c4c4] max-w-3xl mx-auto leading-relaxed">
            Explore the key features of ROGVEDA and learn how to use each one in your research workflow.
          </p>
        </div>

        {/* ── Main content: Features list + Chatbot ── */}
        <div className="w-full flex flex-col lg:flex-row gap-8">

          {/* Left Column: Feature Cards */}
          <div className="flex-1 flex flex-col gap-4" style={{ minWidth: 0 }}>
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-5 rounded-2xl transition-all duration-300"
                style={{
                  padding: '24px 28px',
                  background: 'rgba(10, 24, 26, 0.7)',
                  border: '1px solid rgba(45,212,212,0.1)',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(10, 24, 26, 0.95)'
                  e.currentTarget.style.borderColor = 'rgba(45,212,212,0.3)'
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(45,212,212,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(10, 24, 26, 0.7)'
                  e.currentTarget.style.borderColor = 'rgba(45,212,212,0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'rgba(45,212,212,0.08)',
                    border: '1px solid rgba(45,212,212,0.15)',
                  }}
                >
                  {f.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="text-white font-bold text-lg mb-1" style={{ margin: 0 }}>{f.title}</h3>
                  <p className="text-[#a0c4c4] text-sm leading-relaxed" style={{ margin: 0 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Chatbot */}
          <div
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              width: '360px',
              flexShrink: 0,
              height: 'fit-content',
              position: 'sticky',
              top: '100px',
              background: 'rgba(5, 13, 15, 0.95)',
              border: '1px solid rgba(45,212,212,0.25)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              maxHeight: 'calc(100vh - 120px)',
            }}
          >
            {/* Chat Header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '18px 20px',
                background: 'rgba(10, 24, 26, 0.9)',
                borderBottom: '1px solid rgba(45,212,212,0.15)'
              }}
            >
              <div className="flex items-center gap-3">
                <RobotIcon size={22} />
                <span className="text-white font-bold tracking-wide text-sm">Ask Rogveda AI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#2dd4d4] animate-pulse" />
                <span className="text-[#2dd4d4] text-xs uppercase font-bold tracking-wider">Online</span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-5" style={{ minHeight: '350px', maxHeight: '500px' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="rounded-xl max-w-[90%]"
                    style={{
                      padding: '12px 18px',
                      background: msg.role === 'user' ? 'rgba(45,212,212,0.12)' : 'rgba(255,255,255,0.03)',
                      color: '#d8efef',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      border: msg.role === 'user' ? '1px solid rgba(45,212,212,0.25)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', color: '#8aafaf', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4d4] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4d4] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2dd4d4] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div style={{ padding: '16px', borderTop: '1px solid rgba(45,212,212,0.15)', background: 'rgba(10, 24, 26, 0.95)' }}>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(45,212,212,0.2)' }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type your question here..."
                  className="flex-1 bg-transparent border-none outline-none text-white text-sm"
                  style={{ padding: '14px 16px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="bg-transparent border-none cursor-pointer text-[#2dd4d4] hover:text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{ padding: '14px 20px', fontSize: '14px' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
