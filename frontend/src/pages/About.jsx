import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, isAuthenticated } from '../lib/apiClient.js'
import TopNav from '../components/TopNav.jsx'

export default function About() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    get('/api/auth/me').then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  if (!user) return <div className="min-h-screen" style={{ background: '#050d0f' }} />

  return (
    <div className="relative min-h-screen" style={{ background: '#050d0f' }}>
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
        className="relative z-10 px-6 md:px-12 flex flex-col items-center"
        style={{ 
          paddingTop: '120px', 
          paddingBottom: '80px',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        <div className="w-full flex justify-start mb-8">
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
        <div className="text-center mb-16">
          <div 
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mb-6"
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              color: '#2dd4bf',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2dd4bf' }} className="animate-pulse" />
            Project Origin
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
            About <span style={{ color: '#2dd4d4' }}>ROGVEDA</span>
          </h1>
          <p className="text-[#a0c4c4] text-lg font-medium tracking-wide uppercase">
            Proudly Developed by <span className="text-white font-bold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>TEAM ZENITH</span>
          </p>
        </div>

        <div className="flex flex-col gap-8 w-full">
          {/* Main Description */}
          <section 
            className="p-8 md:p-10 rounded-3xl"
            style={{
              background: 'rgba(10, 24, 26, 0.75)',
              border: '1px solid rgba(45,212,212,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
          >
            <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              The Vision Behind the Platform
            </h2>
            <div className="text-[#c0dede] leading-loose space-y-6 text-sm md:text-base">
              <p>
                <strong>ROGVEDA</strong> is an advanced, offline-first molecular discovery and computational chemistry platform designed to accelerate therapeutic research. Born out of the necessity for data sovereignty in the pharmaceutical and academic research sectors, ROGVEDA ensures that your proprietary chemical structures, experimental logs, and intellectual property never leave your secure local environment.
              </p>
              <p>
                Developed entirely by <strong>TEAM ZENITH</strong>, the platform bridges the gap between complex cheminformatics tools and modern, intuitive software design. We recognized that traditional computational chemistry workflows were often bogged down by fragmented software, steep learning curves, and reliance on cloud APIs that compromise data privacy.
              </p>
              <p>
                With ROGVEDA, TEAM ZENITH has integrated powerful engines like <strong>RDKit</strong> for precise molecular descriptor calculations, structural parsing (SMILES/MolBlock), and generative modification, all running natively. We paired this robust chemical backbone with state-of-the-art <strong>Machine Learning</strong> models—such as Random Forest classifiers trained on rigorous Tox21 datasets—to provide researchers with calibrated predictions of biological activity, toxicity, and target binding affinities.
              </p>
              <p>
                More than just a tool, ROGVEDA is a comprehensive laboratory environment. From a built-in Ketcher structural editor and interactive 3D visualizations, to dynamic similarity searching and an integrated AI assistant, every component was meticulously engineered by TEAM ZENITH to act as a seamless co-pilot in the drug discovery process. Our mission is to democratize cutting-edge molecular intelligence, giving researchers the capabilities of a top-tier biotech firm on their local machines.
              </p>
            </div>
          </section>

          {/* Team Zenith Badge */}
          <div 
            className="p-8 rounded-2xl flex flex-col items-center text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(12, 32, 30, 0.9) 0%, rgba(8, 20, 36, 0.9) 100%)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div 
              className="w-32 h-32 rounded-3xl flex items-center justify-center mb-6 overflow-hidden bg-white"
              style={{
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
              }}
            >
              <img src="/zenith_logo.png" alt="Team Zenith" className="w-full h-full object-contain p-2" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">Team Zenith</h3>
            <p className="text-[#8aafaf] text-sm max-w-md mx-auto">
              Innovating at the intersection of artificial intelligence, software engineering, and computational chemistry.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
