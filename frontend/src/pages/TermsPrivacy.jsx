import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function TermsPrivacy() {
  const location = useLocation()
  
  // Tab state: 'all' | 'terms' | 'privacy'
  const initialTab = location.pathname.includes('privacy') 
    ? 'privacy' 
    : location.pathname.includes('terms') 
      ? 'terms' 
      : 'all'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  const termsSections = [
    {
      id: 'acceptance',
      num: '01',
      title: 'Acceptance & Scope of License',
      content: [
        'By accessing or using the ROGVEDA Molecular Discovery & Computational Chemistry Platform ("ROGVEDA", "we", "our"), you agree to be bound by these Terms of Service.',
        'If you are utilizing the platform on behalf of an academic institution, research laboratory, or biotechnology enterprise, you represent that you have the requisite authority to bind that entity to these Terms.',
      ],
    },
    {
      id: 'scientific-disclaimer',
      num: '02',
      title: 'In Silico & Computational Chemistry Disclaimer',
      content: [
        'All molecular descriptors, ADMET pharmacokinetic profiles, binding affinity estimates, and machine learning predictions produced by ROGVEDA are generated in silico via statistical models, neural networks, and cheminformatics engines (including RDKit).',
        'These calculations serve as computational hypotheses for scientific exploration and drug candidate prioritization. They DO NOT substitute for empirical wet-lab validation, in vitro assays, in vivo preclinical pharmacology, or certified biochemical laboratory assays.',
        'ROGVEDA disclaims all liability for experimental pipelines or biological experiments conducted without independent empirical verification.',
      ],
    },
    {
      id: 'ownership',
      num: '03',
      title: 'Intellectual Property & Molecule Ownership',
      content: [
        'You retain complete, exclusive intellectual property ownership of all molecular structures, SMILES strings, Mol/SDF files, synthesized analogs, and experimental findings you design, calculate, or export through ROGVEDA.',
        'ROGVEDA claims no patent, copyright, licensing, or commercial interest in any novel scaffold or drug lead developed by users on the platform.',
      ],
    },
    {
      id: 'acceptable-use',
      num: '04',
      title: 'Ethical Research & Prohibited Conduct',
      content: [
        'ROGVEDA is created to accelerate therapeutics, materials science, and biochemistry for human health. You strictly agree not to utilize ROGVEDA tools to:',
        '• Design, optimize, or evaluate chemical or biological warfare agents, neurotoxins, or substances prohibited under the Chemical Weapons Convention (OPCW).',
        '• Automate the synthesis pathways of illicit narcotics or scheduled controlled substances without appropriate regulatory authorization.',
        '• Reverse-engineer, disrupt, or exploit the platform software or underlying model weights.',
      ],
    },
    {
      id: 'account-security',
      num: '05',
      title: 'Account Authentication & Local Security',
      content: [
        'You are responsible for safeguarding your login credentials, passwords, and security recovery answers. In local deployment modes, credentials are cryptographically hashed and stored in your private local database instance.',
        'We will never ask you for your plaintext password or private decryption keys.',
      ],
    },
    {
      id: 'limitation-liability',
      num: '06',
      title: 'Limitation of Liability',
      content: [
        'ROGVEDA is provided "as is" and "as available" without warranties of any kind, whether express or implied, including merchantability or fitness for a particular clinical or commercial application.',
        'Under no circumstances shall ROGVEDA or its contributors be liable for any direct, indirect, incidental, or consequential damages resulting from computational errors or experimental use of the platform.',
      ],
    },
  ]

  const privacySections = [
    {
      id: 'local-first',
      num: '01',
      title: 'Local-First Architecture & Zero External Leakage',
      content: [
        'ROGVEDA is architected with strict data sovereignty. In local and self-hosted environments:',
        '• Your chemical structures, SMILES formulas, molecular sketches, and calculated properties are processed on-premise by your local Python/FastAPI and RDKit runtime.',
        '• Proprietary chemical series and experimental logs are never transmitted to external third-party cloud servers, advertisers, or third-party AI models without explicit user consent.',
      ],
    },
    {
      id: 'data-collection',
      num: '02',
      title: 'Information Stored & Processed',
      content: [
        'ROGVEDA stores only the data necessary to provide a seamless research experience:',
        '• Account Credentials: Your email address, salted password cryptographic hashes, and one-way hashes for your chosen account recovery security question.',
        '• Scientific Workspace State: Saved molecules in your private collection, comparison matrices, and session preferences.',
        '• Authentication Tokens: Local session tokens solely used to verify authorized access during your active research session.',
      ],
    },
    {
      id: 'cryptographic-safeguards',
      num: '03',
      title: 'Cryptographic Security & Password Hashing',
      content: [
        'All sensitive user credentials—including passwords and security question answers—are processed through irreversible one-way cryptographic hashing before persisting to the database.',
        'Even in the event of offline database inspection or backup analysis, plaintext answers and credentials cannot be reconstructed from their stored hash digests.',
      ],
    },
    {
      id: 'data-portability',
      num: '04',
      title: 'Data Portability & Complete Erasure',
      content: [
        'You maintain complete control over your research data:',
        '• Instant Export: Export your compounds, properties, and prediction tables at any time in standard scientific formats (CSV, SDF, PNG, JSON).',
        '• Total Erasure: You have the right to purge individual experiments, clear saved molecular history, or wipe the local database profile permanently.',
      ],
    },
    {
      id: 'policy-updates',
      num: '05',
      title: 'Updates & Inquiries',
      content: [
        'As scientific methods, models, and computational features expand, these policies may be updated. Changes will be documented on this page with an updated revision date.',
        'For data governance, academic licensing, or ethical research inquiries, please reach out through the ROGVEDA documentation portal.',
      ],
    },
  ]

  const filterSections = (sections) => {
    if (!searchQuery.trim()) return sections
    const q = searchQuery.toLowerCase()
    return sections.filter((s) => {
      const matchTitle = s.title.toLowerCase().includes(q)
      const matchContent = s.content.some((c) => c.toLowerCase().includes(q))
      return matchTitle || matchContent
    })
  }

  const filteredTerms = filterSections(termsSections)
  const filteredPrivacy = filterSections(privacySections)
  const totalMatches = (activeTab === 'all' ? filteredTerms.length + filteredPrivacy.length : activeTab === 'terms' ? filteredTerms.length : filteredPrivacy.length)

  return (
    <div 
      className="min-h-screen text-[#e8f0f0] relative"
      style={{ background: '#071211', width: '100%' }}
    >
      {/* ── Background Glow ──────────────────────────────────── */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle 900px at 50% -150px, rgba(45, 212, 191, 0.14), transparent 70%), radial-gradient(circle 700px at 85% 85%, rgba(37, 99, 235, 0.09), transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* ── Top Navigation Bar (Full Width & Perfectly Centered) ── */}
      <header 
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ 
          background: 'rgba(7, 18, 17, 0.92)',
          borderBottom: '1px solid rgba(45, 212, 191, 0.12)',
          width: '100%',
        }}
      >
        <div 
          className="px-6 md:px-12 flex items-center justify-between"
          style={{ 
            maxWidth: '1240px', 
            margin: '0 auto', 
            height: '76px',
            width: '100%',
          }}
        >
          {/* Left: Brand Logo & Subtitle */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img 
                src="/rogveda_logo.png" 
                alt="ROGVEDA" 
                style={{ height: '42px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(45, 212, 191, 0.25))' }}
              />
            </Link>
            <div style={{ height: '22px', width: '1px', background: 'rgba(255, 255, 255, 0.18)' }} className="hidden sm:block" />
            <span 
              className="text-[11px] font-semibold uppercase tracking-[0.2em] hidden sm:inline-block"
              style={{ color: '#2dd4bf' }}
            >
              Legal & Privacy Center
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 text-xs font-medium text-white/70 hover:text-white transition-all cursor-pointer"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
              title="Print document or Save as PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span className="hidden md:inline">Print</span>
            </button>

            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
              style={{
                padding: '9px 20px',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
                boxShadow: '0 2px 12px rgba(45, 212, 191, 0.25)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Sign Up</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Centered Content Container ──────────────────── */}
      <main 
        className="px-6 md:px-8 relative z-10"
        style={{ 
          maxWidth: '1120px', 
          margin: '0 auto', 
          width: '100%',
          paddingTop: '56px',
          paddingBottom: '96px',
        }}
      >
        {/* ── Hero Title Section ──────────────────────────────── */}
        <div className="text-center" style={{ marginBottom: '48px' }}>
          <div 
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest"
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              color: '#2dd4bf',
              marginBottom: '20px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2dd4bf' }} className="animate-pulse" />
            Compliance & Research Governance
          </div>

          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight"
            style={{ 
              fontFamily: '"Playfair Display", Georgia, serif',
              marginBottom: '16px',
              lineHeight: 1.2,
            }}
          >
            Terms of Service & Privacy Policy
          </h1>

          <p 
            className="text-sm md:text-base leading-relaxed"
            style={{ 
              maxWidth: '720px', 
              margin: '0 auto', 
              color: 'rgba(255, 255, 255, 0.62)',
              marginBottom: '20px',
            }}
          >
            ROGVEDA provides transparent, local-first in silico molecular modeling, AI property prediction, and cheminformatics tools. Learn how we safeguard your proprietary research and chemical data.
          </p>

          <div 
            className="flex items-center justify-center flex-wrap gap-4 text-xs"
            style={{ color: 'rgba(255, 255, 255, 0.45)' }}
          >
            <span>Last Updated: September 2026</span>
            <span>•</span>
            <span style={{ color: '#2dd4bf' }}>Effective Version 1.0</span>
            <span>•</span>
            <span>Local-First Deployment</span>
          </div>
        </div>

        {/* ── 3 Summary Highlights Cards (Symmetrical 3-Col) ──── */}
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{ marginBottom: '48px' }}
        >
          {/* Card 1 */}
          <div 
            className="flex flex-col justify-between"
            style={{
              padding: '28px',
              borderRadius: '18px',
              background: 'rgba(13, 28, 26, 0.85)',
              border: '1px solid rgba(45, 212, 191, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div>
              <div 
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(45, 212, 191, 0.15)',
                  border: '1px solid rgba(45, 212, 191, 0.3)',
                  color: '#2dd4bf',
                  marginBottom: '18px',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white" style={{ marginBottom: '8px' }}>
                100% IP Ownership
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                You retain complete, exclusive intellectual property over all drawn molecules, SMILES, and novel scaffolds. ROGVEDA claims zero ownership.
              </p>
            </div>
            <div 
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#2dd4bf',
              }}
            >
              Complete Sovereignty
            </div>
          </div>

          {/* Card 2 */}
          <div 
            className="flex flex-col justify-between"
            style={{
              padding: '28px',
              borderRadius: '18px',
              background: 'rgba(13, 28, 26, 0.85)',
              border: '1px solid rgba(45, 212, 191, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div>
              <div 
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  marginBottom: '18px',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white" style={{ marginBottom: '8px' }}>
                Local-First Privacy
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                Calculations execute on your local RDKit engine. No proprietary chemical structures or prompts are transmitted to external servers.
              </p>
            </div>
            <div 
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#38bdf8',
              }}
            >
              Zero External Leakage
            </div>
          </div>

          {/* Card 3 */}
          <div 
            className="flex flex-col justify-between"
            style={{
              padding: '28px',
              borderRadius: '18px',
              background: 'rgba(13, 28, 26, 0.85)',
              border: '1px solid rgba(45, 212, 191, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div>
              <div 
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(129, 140, 248, 0.15)',
                  border: '1px solid rgba(129, 140, 248, 0.3)',
                  color: '#818cf8',
                  marginBottom: '18px',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.31" />
                  <path d="M14 9.3V1.99" />
                  <path d="M8.5 2h7" />
                  <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
                  <path d="M5.52 16h12.96" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white" style={{ marginBottom: '8px' }}>
                In Silico Disclaimer
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                Property predictions and ML models provide computational estimates for hypothesis generation. Wet-lab validation is always required.
              </p>
            </div>
            <div 
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#818cf8',
              }}
            >
              Scientific Integrity
            </div>
          </div>
        </div>

        {/* ── Control Bar: Symmetrical Tabs & Search ─────────── */}
        <div 
          className="flex flex-col md:flex-row items-center justify-between gap-4"
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            background: '#0b1817',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            marginBottom: '36px',
          }}
        >
          {/* Tabs Selector */}
          <div 
            className="flex items-center gap-1.5 w-full md:w-auto"
            style={{
              padding: '4px',
              borderRadius: '12px',
              background: '#060f0e',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {[
              { id: 'all', label: 'All Policies' },
              { id: 'terms', label: 'Terms of Service' },
              { id: 'privacy', label: 'Privacy Policy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 md:flex-none text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                style={{
                  padding: '9px 20px',
                  borderRadius: '9px',
                  background: activeTab === tab.id ? 'linear-gradient(90deg, #2dd4bf, #2563eb)' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                  boxShadow: activeTab === tab.id ? '0 2px 10px rgba(45, 212, 191, 0.25)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <div 
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clauses (e.g. molecules, IP)..."
              className="w-full text-xs text-white placeholder-white/35 outline-none transition-all"
              style={{
                background: '#060f0e',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '10px 36px 10px 38px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40 hover:text-white"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search Results Alert */}
        {searchQuery && (
          <div 
            className="flex items-center justify-between text-xs"
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              color: '#2dd4bf',
              marginBottom: '28px',
            }}
          >
            <span>Filtering by keyword: <strong>"{searchQuery}"</strong> ({totalMatches} section{totalMatches !== 1 ? 's' : ''} found)</span>
            <button onClick={() => setSearchQuery('')} className="underline hover:text-white cursor-pointer">Clear filter</button>
          </div>
        )}

        {/* ── Document Clauses ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          {/* SECTION: Terms of Service */}
          {(activeTab === 'all' || activeTab === 'terms') && (
            <section id="terms-of-service">
              <div 
                className="flex items-center gap-3"
                style={{
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2dd4bf', boxShadow: '0 0 8px #2dd4bf' }} />
                <h2 
                  className="text-2xl md:text-3xl font-bold text-white tracking-tight"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  Terms of Service
                </h2>
              </div>

              {filteredTerms.length === 0 ? (
                <div 
                  className="text-center text-sm"
                  style={{
                    padding: '36px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  No terms found matching "{searchQuery}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {filteredTerms.map((section) => (
                    <div
                      key={section.id}
                      style={{
                        padding: '28px 32px',
                        borderRadius: '16px',
                        background: 'rgba(12, 25, 24, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      <div className="flex items-baseline gap-3" style={{ marginBottom: '14px' }}>
                        <span 
                          className="text-xs font-bold"
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            background: 'rgba(45, 212, 191, 0.12)',
                            border: '1px solid rgba(45, 212, 191, 0.25)',
                            color: '#2dd4bf',
                          }}
                        >
                          {section.num}
                        </span>
                        <h3 className="text-base md:text-lg font-semibold text-white">
                          {section.title}
                        </h3>
                      </div>
                      <div 
                        className="text-sm leading-relaxed"
                        style={{ color: 'rgba(255, 255, 255, 0.72)', paddingLeft: '38px' }}
                      >
                        {section.content.map((paragraph, idx) => (
                          <p key={idx} style={{ marginBottom: idx < section.content.length - 1 ? '10px' : 0 }}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION: Privacy Policy */}
          {(activeTab === 'all' || activeTab === 'privacy') && (
            <section id="privacy-policy">
              <div 
                className="flex items-center gap-3"
                style={{
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                <h2 
                  className="text-2xl md:text-3xl font-bold text-white tracking-tight"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  Privacy Policy
                </h2>
              </div>

              {filteredPrivacy.length === 0 ? (
                <div 
                  className="text-center text-sm"
                  style={{
                    padding: '36px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  No privacy policy sections found matching "{searchQuery}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {filteredPrivacy.map((section) => (
                    <div
                      key={section.id}
                      style={{
                        padding: '28px 32px',
                        borderRadius: '16px',
                        background: 'rgba(12, 25, 24, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      <div className="flex items-baseline gap-3" style={{ marginBottom: '14px' }}>
                        <span 
                          className="text-xs font-bold"
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#38bdf8',
                          }}
                        >
                          {section.num}
                        </span>
                        <h3 className="text-base md:text-lg font-semibold text-white">
                          {section.title}
                        </h3>
                      </div>
                      <div 
                        className="text-sm leading-relaxed"
                        style={{ color: 'rgba(255, 255, 255, 0.72)', paddingLeft: '38px' }}
                      >
                        {section.content.map((paragraph, idx) => (
                          <p key={idx} style={{ marginBottom: idx < section.content.length - 1 ? '10px' : 0 }}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Acceptance Footer Card (Centered & Symmetrical) ──── */}
        <div 
          className="flex flex-col md:flex-row items-center justify-between gap-6"
          style={{
            marginTop: '64px',
            padding: '36px 42px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(12, 32, 30, 0.95) 0%, rgba(8, 20, 36, 0.95) 100%)',
            border: '1px solid rgba(45, 212, 191, 0.25)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div className="text-left">
            <h4 
              className="text-lg md:text-xl font-bold text-white"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', marginBottom: '8px' }}
            >
              Ready to begin molecular discovery?
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.62)', maxWidth: '580px' }}>
              By creating an account or signing in, you confirm your adherence to the ROGVEDA Terms of Service and Privacy Policy.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-shrink-0">
            <Link
              to="/signup"
              className="flex-1 md:flex-none text-center text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
                boxShadow: '0 4px 14px rgba(45, 212, 191, 0.25)',
              }}
            >
              Accept & Sign Up
            </Link>
            <Link
              to="/login"
              className="flex-1 md:flex-none text-center text-xs font-bold uppercase tracking-wider text-white/85 hover:text-white transition-all"
              style={{
                padding: '12px 22px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer 
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#050c0b',
          padding: '32px 24px',
          width: '100%',
        }}
      >
        <div 
          className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            color: 'rgba(255, 255, 255, 0.45)',
          }}
        >
          <div className="flex items-center gap-3">
            <img src="/rogveda_logo.png" alt="ROGVEDA" style={{ height: '24px', width: 'auto', opacity: 0.8 }} />
            <span>© 2026 ROGVEDA. In Silico Molecular Intelligence.</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => { setActiveTab('terms'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} 
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => { setActiveTab('privacy'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} 
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <Link to="/login" className="hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
