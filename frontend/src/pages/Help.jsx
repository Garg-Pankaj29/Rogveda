import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, isAuthenticated } from '../lib/apiClient.js'
import TopNav from '../components/TopNav.jsx'

/* ════════════════════════════════════════════════════════════
   SVG ICON COMPONENTS
   ════════════════════════════════════════════════════════════ */

function MailIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function PhoneIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

function ClockIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function LocationIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CopyIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════
   CONTACT PAGE
   ════════════════════════════════════════════════════════════ */

export default function Help() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [copiedField, setCopiedField] = useState(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    get('/api/auth/me').then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  if (!user) return <div className="min-h-screen" style={{ background: '#050d0f' }} />

  const cardStyle = {
    background: 'rgba(10, 24, 26, 0.85)',
    border: '1px solid rgba(45,212,212,0.15)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    borderRadius: '16px',
    padding: '32px',
  }

  const copyableFieldStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(45,212,212,0.12)',
    borderRadius: '10px',
    padding: '14px 18px',
  }

  return (
    <div className="relative min-h-screen" style={{ background: '#050d0f' }}>
      <TopNav user={user} />

      <main
        className="px-6 md:px-12 flex flex-col items-center"
        style={{
          paddingTop: '120px',
          paddingBottom: '80px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Back button */}
        <div className="w-full flex justify-start mb-8">
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
            <span style={{ color: '#ffffff' }}>Contact & </span>
            <span style={{ color: '#2dd4d4' }}>Support</span>
          </h1>
          <p className="text-[#a0c4c4] max-w-2xl mx-auto leading-relaxed">
            Have questions, suggestions, or academic discussions?
            <br />
            We'd love to hear from you. Reach out to the ROGVEDA team through the details below.
          </p>
        </div>

        {/* ── Row 1: Email Us + Call Us ── */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Email Us Card */}
          <div style={cardStyle}>
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(45,212,212,0.1)' }}>
                <MailIcon size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Email Us</h2>
                <p className="text-[#a0c4c4] text-sm leading-relaxed" style={{ margin: 0 }}>
                  For general inquiries, academic discussions, suggestions, or collaboration proposals, feel free to reach out to us.
                </p>
              </div>
            </div>
            <div style={copyableFieldStyle}>
              <span className="text-[#d8efef] text-sm font-medium">rogveda@gmail.com</span>
              <button
                onClick={() => handleCopy('rogveda@gmail.com', 'email')}
                className="bg-transparent border-none cursor-pointer text-[#5a8080] hover:text-[#2dd4d4] transition-colors p-1"
                title={copiedField === 'email' ? 'Copied!' : 'Copy to clipboard'}
              >
                {copiedField === 'email' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <CopyIcon />
                )}
              </button>
            </div>
          </div>

          {/* Call Us Card */}
          <div style={cardStyle}>
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(45,212,212,0.1)' }}>
                <PhoneIcon size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Call Us</h2>
                <p className="text-[#a0c4c4] text-sm leading-relaxed" style={{ margin: 0 }}>
                  For direct inquiries or discussions with the ROGVEDA team.
                </p>
              </div>
            </div>
            <div style={copyableFieldStyle}>
              <span className="text-[#d8efef] text-sm font-medium">+91 00000 00000</span>
              <button
                onClick={() => handleCopy('+91 00000 00000', 'phone')}
                className="bg-transparent border-none cursor-pointer text-[#5a8080] hover:text-[#2dd4d4] transition-colors p-1"
                title={copiedField === 'phone' ? 'Copied!' : 'Copy to clipboard'}
              >
                {copiedField === 'phone' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <CopyIcon />
                )}
              </button>
            </div>

            {/* Working Hours inline */}
            <div className="flex items-center gap-3 mt-5" style={{ paddingTop: '16px', borderTop: '1px solid rgba(45,212,212,0.08)' }}>
              <ClockIcon size={18} />
              <div>
                <span className="text-white text-sm font-bold">Working Hours</span>
                <br />
                <span className="text-[#a0c4c4] text-xs">Monday – Friday, 9:00 AM – 6:00 PM (IST)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Our Location (full width) ── */}
        <div className="w-full" style={{ ...cardStyle }}>
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(45,212,212,0.1)' }}>
              <LocationIcon size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Our Location</h2>
              <p className="text-[#a0c4c4] text-sm" style={{ margin: 0 }}>
                Find the ROGVEDA research team at the following address.
              </p>
            </div>
          </div>
          <div
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(45,212,212,0.12)',
              borderRadius: '10px',
              padding: '20px 24px',
            }}
          >
            <p className="text-white text-sm font-bold mb-1" style={{ margin: 0 }}>ROG VEDA Research Team</p>
            <p className="text-[#a0c4c4] text-sm leading-relaxed" style={{ margin: 0 }}>
              Chandigarh University<br />
              Kharar, Mohali, Punjab – 140413<br />
              India
            </p>
          </div>
        </div>

      </main>
    </div>
  )
}
