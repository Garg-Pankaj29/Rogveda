import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, isAuthenticated } from '../lib/apiClient.js'
import TopNav from '../components/TopNav.jsx'

function FeatureCard({ title, description, uniqueness, icon }) {
  return (
    <div 
      className="flex flex-col p-8 rounded-2xl transition-all hover:-translate-y-1"
      style={{
        background: 'rgba(10, 24, 26, 0.85)',
        border: '1px solid rgba(45,212,212,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 rounded-xl" style={{ background: 'rgba(45,212,212,0.1)', color: '#2dd4d4' }}>
          {icon}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h3>
      </div>
      <p className="text-[#a0c4c4] leading-relaxed mb-6 flex-grow">{description}</p>
      <div 
        className="mt-auto p-4 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(45,212,212,0.05)' }}
      >
        <span className="text-[#8aafaf] text-xs uppercase tracking-wider font-bold block mb-2">Platform Uniqueness</span>
        <p className="text-[#d8efef] text-sm">{uniqueness}</p>
      </div>
    </div>
  )
}

export default function Features() {
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

  const features = [
    {
      title: 'Molecular Analysis',
      description: 'Instantly calculate key chemical properties, ADMET descriptors, and Lipinski\'s Rule of Five metrics directly from your molecular structures.',
      uniqueness: '100% offline calculation using embedded RDKit. Your proprietary molecular structures never leave your machine.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="12" width="4" height="9" rx="0.5" />
          <rect x="10" y="6" width="4" height="15" rx="0.5" />
          <rect x="17" y="3" width="4" height="18" rx="0.5" />
        </svg>
      )
    },
    {
      title: 'Prediction & AI',
      description: 'Leverage state-of-the-art machine learning models (e.g., Random Forest trained on Tox21) to predict biological activities, toxicity, and receptor binding.',
      uniqueness: 'Provides statistically calibrated confidence scores (ROC-AUC backed) alongside predictions, allowing for genuine scientific risk assessment rather than black-box outputs.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    },
    {
      title: 'Compare Molecules',
      description: 'Perform side-by-side analysis of multiple molecular structures. Evaluate physical properties, structural differences, and generate comparative matrices.',
      uniqueness: 'Visual property scaling with dynamic difference highlighting, making it trivial to spot how minor structural modifications impact overall chemical behavior.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="9" y1="21" x2="15" y2="21" />
          <polyline points="3 7 12 3 21 7" />
          <path d="M3 7l2.5 8.5C5.8 16.5 4.5 18 3 18s-2.8-1.5-2.5-2.5L3 7z" />
          <path d="M21 7l2.5 8.5C23.8 16.5 22.5 18 21 18s-2.8-1.5-2.5-2.5L21 7z" />
        </svg>
      )
    },
    {
      title: 'Molecular Modification',
      description: 'Intuitively edit and generate new molecular structures using the integrated Ketcher editor with smart valency checking and layout sanitization.',
      uniqueness: 'Real-time structural validation and 3D preview synchronization natively integrated within the local ecosystem.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          <line x1="15" y1="5" x2="19" y2="9" />
        </svg>
      )
    },
    {
      title: 'Similarity Search',
      description: 'Find structurally similar molecules by computing Tanimoto similarity metrics based on Morgan/ECFP fingerprints.',
      uniqueness: 'Lightning-fast localized searching using in-memory fingerprinting without relying on external cloud APIs or databases, preserving complete data sovereignty.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="7" />
          <line x1="15.5" y1="15.5" x2="22" y2="22" />
        </svg>
      )
    },
    {
      title: 'Integrated AI Chatbot',
      description: 'A context-aware AI assistant designed to interpret molecular properties, explain machine learning confidence scores, and guide platform usage.',
      uniqueness: 'Tailored specifically for computational chemistry and natively embedded into the interface, acting as a tireless research co-pilot.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="8" width="16" height="12" rx="3" />
          <circle cx="9" cy="14" r="1.5" />
          <circle cx="15" cy="14" r="1.5" />
          <line x1="9" y1="18" x2="15" y2="18" />
          <line x1="12" y1="4" x2="12" y2="8" />
          <circle cx="12" cy="3" r="1" />
        </svg>
      )
    },
    {
      title: 'Batch Screening',
      description: 'Upload a CSV of SMILES strings to evaluate hundreds of molecules in parallel. Perform property calculation, AI predictions, and get sortable results instantly.',
      uniqueness: 'Power-aware processing scales batch ingestion to match your hardware capabilities, seamlessly shifting between full-speed operation and battery-saving throttled execution.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )
    },
    {
      title: 'Chemical Space Analysis',
      description: 'Visualize your dataset in a 2D interactive chemical space map. We use PCA (Principal Component Analysis) on molecular descriptors to plot structural diversity and clustering.',
      uniqueness: 'Fully offline dimensionality reduction powered by our Python backend ensures no data leaves your machine, while still providing robust exploratory data analysis tools.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    }
  ]

  return (
    <div className="relative min-h-screen" style={{ background: '#050d0f' }}>
      <TopNav user={user} />
      
      {/* Background Glow */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle 800px at 50% -100px, rgba(45, 212, 191, 0.1), transparent 70%)',
          zIndex: 0,
        }}
      />

      <main 
        className="relative z-10 px-6 md:px-12 flex flex-col items-center"
        style={{ 
          paddingTop: '120px', 
          paddingBottom: '80px',
          maxWidth: '1200px',
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
            Capabilities & Tools
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6" style={{ fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
            Discover the Power of <span style={{ color: '#2dd4d4' }}>ROGVEDA</span>
          </h1>
          <p className="text-[#a0c4c4] text-lg max-w-3xl mx-auto leading-relaxed">
            Unlike traditional cloud-based informatics platforms, ROGVEDA is built around a <strong className="text-white">Local-First Architecture</strong>. 
            We combine high-performance cheminformatics with advanced Machine Learning—all executing securely on your hardware.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {features.map((feature, idx) => (
            <FeatureCard 
              key={idx}
              title={feature.title}
              description={feature.description}
              uniqueness={feature.uniqueness}
              icon={feature.icon}
            />
          ))}
        </div>

        {/* Bottom Call to Action */}
        <div 
          className="mt-20 p-10 rounded-3xl w-full text-center flex flex-col items-center"
          style={{
            background: 'linear-gradient(135deg, rgba(12, 32, 30, 0.95) 0%, rgba(8, 20, 36, 0.95) 100%)',
            border: '1px solid rgba(45, 212, 191, 0.25)',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
          }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Ready to accelerate your research?
          </h2>
          <p className="text-[#a0c4c4] max-w-2xl mb-8">
            Start drawing, analyzing, and predicting molecular behaviors with absolute data privacy and state-of-the-art accuracy.
          </p>
          <button
            onClick={() => navigate('/draw')}
            className="text-sm font-bold uppercase tracking-wider text-white transition-all hover:scale-105 cursor-pointer"
            style={{
              padding: '16px 32px',
              borderRadius: '9999px',
              background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
              boxShadow: '0 4px 20px rgba(45, 212, 191, 0.3)',
              border: 'none'
            }}
          >
            Launch Workspace
          </button>
        </div>
      </main>
    </div>
  )
}
