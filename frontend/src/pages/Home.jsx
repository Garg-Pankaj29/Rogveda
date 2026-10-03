/**
 * ROGVEDA — HomePage Dashboard
 *
 * Main hub after login. Molecule-hub diagram with five feature nodes
 * arranged in a pentagon around a central "Draw Molecule" node.
 * Real data from /api/auth/me and /api/auth/stats.
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post, clearToken, isAuthenticated } from '../lib/apiClient.js'
import TopNav from '../components/TopNav.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* ════════════════════════════════════════════════════════════
   SVG ICON COMPONENTS
   ════════════════════════════════════════════════════════════ */

function MoleculeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5">
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="17" r="2.5" />
      <circle cx="19" cy="17" r="2.5" />
      <line x1="12" y1="7.5" x2="5" y2="14.5" />
      <line x1="12" y1="7.5" x2="19" y2="14.5" />
      <line x1="7.5" y1="17" x2="16.5" y2="17" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aafaf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function BarChartIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="12" width="4" height="9" rx="0.5" />
      <rect x="10" y="6" width="4" height="15" rx="0.5" />
      <rect x="17" y="3" width="4" height="18" rx="0.5" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <img 
      src="/brain_icon.png" 
      alt="Prediction & AI" 
      style={{ 
        width: '38px', 
        height: '38px', 
        objectFit: 'contain',
        filter: 'brightness(0) saturate(100%) invert(76%) sepia(26%) saturate(2318%) hue-rotate(132deg) brightness(94%) contrast(88%) drop-shadow(0 0 4px rgba(45,212,212,0.4))'
      }} 
    />
  )
}

function LayersIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
      <polyline points="3 7 12 3 21 7" />
      <path d="M3 7l2.5 8.5C5.8 16.5 4.5 18 3 18s-2.8-1.5-2.5-2.5L3 7z" />
      <path d="M21 7l2.5 8.5C23.8 16.5 22.5 18 21 18s-2.8-1.5-2.5-2.5L21 7z" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <line x1="15" y1="5" x2="19" y2="9" />
    </svg>
  )
}

function MagnifyingGlassIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="7" />
      <line x1="15.5" y1="15.5" x2="22" y2="22" />
    </svg>
  )
}


function RobotIcon({ width = 28, height = 28 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <circle cx="9" cy="14" r="1.5" fill="#2dd4d4" />
      <circle cx="15" cy="14" r="1.5" fill="#2dd4d4" />
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <circle cx="12" cy="3" r="1" fill="#2dd4d4" />
    </svg>
  )
}

/* Central "Draw Molecule" canvas preview SVG */
function CanvasPreview() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" fill="none">
      {/* Grid dots */}
      {[20,40,60,80].map(x =>
        [20,40,60].map(y =>
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#1a3a3a" />
        )
      )}
      {/* Molecule structure */}
      <line x1="30" y1="25" x2="50" y2="40" stroke="#2dd4d4" strokeWidth="1.5" />
      <line x1="50" y1="40" x2="70" y2="25" stroke="#2dd4d4" strokeWidth="1.5" />
      <line x1="50" y1="40" x2="50" y2="60" stroke="#2dd4d4" strokeWidth="1.5" />
      <line x1="50" y1="60" x2="35" y2="65" stroke="#2dd4d4" strokeWidth="1.5" />
      <line x1="50" y1="60" x2="65" y2="65" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="30" cy="25" r="4" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="70" cy="25" r="4" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="50" cy="40" r="5" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="50" cy="60" r="4" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="35" cy="65" r="3" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      <circle cx="65" cy="65" r="3" fill="#0a1c1c" stroke="#2dd4d4" strokeWidth="1.5" />
      {/* Pencil icon top-right */}
      <g transform="translate(78, 8)">
        <path d="M0 12L9 3l3 3-9 9H0v-3z" stroke="#2dd4d4" strokeWidth="1" fill="none" />
      </g>
      {/* 3 dots top center */}
      <circle cx="44" cy="8" r="1.5" fill="#2dd4d4" />
      <circle cx="50" cy="8" r="1.5" fill="#2dd4d4" />
      <circle cx="56" cy="8" r="1.5" fill="#2dd4d4" />
    </svg>
  )
}


/* ════════════════════════════════════════════════════════════
   NODE CONFIGURATION
   ════════════════════════════════════════════════════════════ */

const HUB_NODES = [
  { id: 'analysis',     label: 'MOLECULAR\nANALYSIS',      desc: 'Calculate properties\nand descriptors',              icon: BarChartIcon,        route: '/analysis',      angle: -90 },
  { id: 'prediction',   label: 'PREDICTION & AI',          desc: 'Predict biological\nactivities with\nmachine learning', icon: BrainIcon,        route: '/prediction',    angle: -30 },
  { id: 'batch',        label: 'BATCH\nSCREENING',         desc: 'Process up to 500\nmolecules at once',               icon: LayersIcon,          route: '/batch',         angle: 30 },
  { id: 'compare',      label: 'COMPARE\nMOLECULES',      desc: 'Analyze and compare\nmolecular structures',          icon: ScaleIcon,           route: '/compare',       angle: 90  },
  { id: 'modification', label: 'MOLECULAR\nMODIFICATION',  desc: 'Edit and generate\nnew structures',                  icon: PencilIcon,          route: '/modification',  angle: 150 },
  { id: 'similarity',   label: 'SIMILARITY\nSEARCH',       desc: 'Find structurally\nsimilar molecules',               icon: MagnifyingGlassIcon, route: '/similarity',    angle: 210 },
]


/* ════════════════════════════════════════════════════════════
   BACKGROUND COMPONENT
   ════════════════════════════════════════════════════════════ */

function ProceduralBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Top-left molecule cluster blob */}
      <div
        className="absolute"
        style={{
          top: '-5%', left: '-5%',
          width: '450px', height: '450px',
          background: 'radial-gradient(circle, rgba(45,212,212,0.08) 0%, rgba(45,212,212,0.03) 30%, transparent 65%)',
          filter: 'blur(40px)',
          animation: 'bg-shimmer 8s ease-in-out infinite',
        }}
      />
      {/* Top-right cluster */}
      <div
        className="absolute"
        style={{
          top: '-8%', right: '-3%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(45,212,212,0.06) 0%, rgba(30,180,180,0.02) 35%, transparent 60%)',
          filter: 'blur(50px)',
          animation: 'bg-shimmer 10s ease-in-out infinite 2s',
        }}
      />
      {/* Bottom-left cluster */}
      <div
        className="absolute"
        style={{
          bottom: '5%', left: '-3%',
          width: '380px', height: '380px',
          background: 'radial-gradient(circle, rgba(45,212,212,0.07) 0%, rgba(45,212,212,0.02) 30%, transparent 55%)',
          filter: 'blur(45px)',
          animation: 'bg-shimmer 9s ease-in-out infinite 1s',
        }}
      />
      {/* Bottom-right DNA helix / particle stream */}
      <div
        className="absolute"
        style={{
          bottom: '-10%', right: '-5%',
          width: '600px', height: '350px',
          background: `
            linear-gradient(135deg, transparent 20%, rgba(45,212,212,0.04) 40%, transparent 60%),
            radial-gradient(ellipse at 60% 50%, rgba(45,212,212,0.06) 0%, transparent 50%)
          `,
          filter: 'blur(30px)',
          transform: 'rotate(-15deg)',
          animation: 'bg-shimmer 12s ease-in-out infinite 3s',
        }}
      />
      {/* Scattered small dots to simulate distant particles */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.04 }}>
        <circle cx="15%" cy="20%" r="2" fill="#2dd4d4" />
        <circle cx="85%" cy="15%" r="1.5" fill="#2dd4d4" />
        <circle cx="10%" cy="75%" r="1.5" fill="#2dd4d4" />
        <circle cx="90%" cy="80%" r="2" fill="#2dd4d4" />
        <circle cx="25%" cy="50%" r="1" fill="#2dd4d4" />
        <circle cx="75%" cy="45%" r="1" fill="#2dd4d4" />
        <circle cx="50%" cy="85%" r="1.5" fill="#2dd4d4" />
        <circle cx="40%" cy="10%" r="1" fill="#2dd4d4" />
        <circle cx="65%" cy="92%" r="1" fill="#2dd4d4" />
        {/* Thin connecting lines */}
        <line x1="15%" y1="20%" x2="25%" y2="50%" stroke="#2dd4d4" strokeWidth="0.3" />
        <line x1="85%" y1="15%" x2="75%" y2="45%" stroke="#2dd4d4" strokeWidth="0.3" />
        <line x1="10%" y1="75%" x2="25%" y2="50%" stroke="#2dd4d4" strokeWidth="0.3" />
        <line x1="90%" y1="80%" x2="75%" y2="45%" stroke="#2dd4d4" strokeWidth="0.3" />
      </svg>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   CONNECTOR LINE (ball-and-stick bond between center & node)
   ════════════════════════════════════════════════════════════ */

function ConnectorLine({ angle, centerRadius, nodeRadius, orbitRadius }) {
  const rad = (angle * Math.PI) / 180
  const startX = Math.cos(rad) * (centerRadius + 4)
  const startY = Math.sin(rad) * (centerRadius + 4)
  const endX = Math.cos(rad) * (orbitRadius - nodeRadius - 4)
  const endY = Math.sin(rad) * (orbitRadius - nodeRadius - 4)
  return (
    <line
      x1={startX} y1={startY}
      x2={endX} y2={endY}
      stroke="#2dd4d4"
      strokeWidth="12"
      strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 0 4px rgba(45,212,212,0.3))' }}
    />
  )
}


/* ════════════════════════════════════════════════════════════
   OUTER NODE COMPONENT
   ════════════════════════════════════════════════════════════ */

function OuterNode({ node, orbitRadius, idx }) {
  const rad = (node.angle * Math.PI) / 180
  const x = Math.cos(rad) * orbitRadius
  const y = Math.sin(rad) * orbitRadius
  const nodeSize = 140
  const Icon = node.icon

  return (
    <g
      style={{ animation: `fade-in-up 0.6s ease-out ${0.3 + idx * 0.1}s both` }}
    >
      {/* Node circle */}
      <circle
        cx={x} cy={y} r={nodeSize / 2}
        fill="rgba(8, 24, 24, 0.85)"
        stroke="#2dd4d4"
        strokeWidth="2"
        style={{ filter: 'drop-shadow(0 0 8px rgba(45,212,212,0.2))' }}
      />
      {/* Icon */}
      <foreignObject x={x - 30} y={y - 30} width={60} height={60}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', transform: 'scale(1.3)' }}>
          <Icon />
        </div>
      </foreignObject>
    </g>
  )
}

function OuterNodeText({ node, orbitRadius, idx }) {
  const rad = (node.angle * Math.PI) / 180
  const x = Math.cos(rad) * orbitRadius
  const y = Math.sin(rad) * orbitRadius

  let textX = x
  let textY = y
  let textAnchor = 'middle'

  if (node.id === 'analysis')     { textX = x + 120; textY = y - 20;  textAnchor = 'start'; }
  if (node.id === 'prediction')   { textX = x + 110; textY = y - 20;  textAnchor = 'start'; }
  if (node.id === 'batch')        { textX = x + 110; textY = y - 20;  textAnchor = 'start'; }
  if (node.id === 'compare')      { textX = x + 120; textY = y - 20;  textAnchor = 'start'; }
  if (node.id === 'modification') { textX = x - 110; textY = y - 20;  textAnchor = 'end'; }
  if (node.id === 'similarity')   { textX = x - 110; textY = y - 20;  textAnchor = 'end'; }

  return (
    <g
      style={{ animation: `fade-in-up 0.6s ease-out ${0.3 + idx * 0.1}s both`, pointerEvents: 'none' }}
    >
      {/* Label text */}
      <text
        x={textX} y={textY}
        textAnchor={textAnchor}
        fill="#ffffff"
        fontWeight="800"
        fontSize="20"
        letterSpacing="0.08em"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {node.label.split('\n').map((line, i) => (
          <tspan key={i} x={textX} dy={i === 0 ? 0 : 26}>{line}</tspan>
        ))}
      </text>
      {/* Description text */}
      <text
        x={textX} y={textY + node.label.split('\n').length * 26 + 8}
        textAnchor={textAnchor}
        fill="#8aafaf"
        fontSize="16"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {node.desc.split('\n').map((line, i) => (
          <tspan key={i} x={textX} dy={i === 0 ? 0 : 22}>{line}</tspan>
        ))}
      </text>
    </g>
  )
}


/* ════════════════════════════════════════════════════════════
   MOLECULE HUB DIAGRAM
   ════════════════════════════════════════════════════════════ */

function MoleculeHub() {
  const navigate = useNavigate()
  const centerRadius = 158
  const nodeRadius = 70
  const orbitRadius = 300

  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('rogveda_onboarding_seen') !== 'true') {
      setShowOnboarding(true)
    }

    const handleShowOnboarding = () => {
      setShowOnboarding(true)
      localStorage.removeItem('rogveda_onboarding_seen')
    }
    window.addEventListener('rogveda_show_onboarding', handleShowOnboarding)
    return () => window.removeEventListener('rogveda_show_onboarding', handleShowOnboarding)
  }, [])

  const dismissOnboarding = (e) => {
    e.stopPropagation()
    localStorage.setItem('rogveda_onboarding_seen', 'true')
    setShowOnboarding(false)
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: '740px', height: '660px', marginTop: '-60px', animation: 'float-drift 6s ease-in-out infinite' }}>
      <svg
        viewBox="-480 -340 960 680"
        width="740"
        height="660"
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        {/* Connector lines (bonds) */}
        {HUB_NODES.map(node => (
          <ConnectorLine
            key={node.id}
            angle={node.angle}
            centerRadius={centerRadius}
            nodeRadius={nodeRadius}
            orbitRadius={orbitRadius}
          />
        ))}
        {/* Small ball joints at the ends of each connector */}
        {HUB_NODES.map(node => {
          const rad = (node.angle * Math.PI) / 180
          const bx = Math.cos(rad) * (orbitRadius - nodeRadius - 4)
          const by = Math.sin(rad) * (orbitRadius - nodeRadius - 4)
          return <circle key={`ball-${node.id}`} cx={bx} cy={by} r="8" fill="#2dd4d4" style={{ filter: 'drop-shadow(0 0 6px rgba(45,212,212,0.6))' }} />
        })}
        {/* Central node glow ring — visually dominant filled style */}
        <defs>
          <radialGradient id="center-fill" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(45,212,212,0.12)" />
            <stop offset="60%" stopColor="rgba(12,36,36,0.95)" />
            <stop offset="100%" stopColor="rgba(8,24,24,0.98)" />
          </radialGradient>
        </defs>
        <circle
          cx={0} cy={0} r={centerRadius}
          fill="url(#center-fill)"
          stroke="#2dd4d4"
          strokeWidth="3.5"
          style={{ filter: 'drop-shadow(0 0 28px rgba(45,212,212,0.45)) drop-shadow(0 0 60px rgba(45,212,212,0.15))' }}
        />
        {/* Outer accent ring */}
        <circle
          cx={0} cy={0} r={centerRadius + 6}
          fill="none"
          stroke="rgba(45,212,212,0.12)"
          strokeWidth="1"
        />
        {/* Inner dashed ring */}
        <circle
          cx={0} cy={0} r={centerRadius - 14}
          fill="none"
          stroke="rgba(45,212,212,0.18)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {/* Outer Nodes */}
        {HUB_NODES.map((node, idx) => (
          <OuterNode key={node.id} node={node} orbitRadius={orbitRadius} idx={idx} />
        ))}
        {/* Texts on top of outer nodes */}
        {HUB_NODES.map((node, idx) => (
          <OuterNodeText key={'text-'+node.id} node={node} orbitRadius={orbitRadius} idx={idx} />
        ))}
      </svg>

      {/* Central content (HTML overlay) — keyboard-accessible */}
      <div className="relative">
        <div
          onClick={() => navigate('/draw?new=true')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/draw?new=true') } }}
          role="button"
          tabIndex={0}
          aria-label="Draw Molecule — Start your research here"
          className="flex flex-col items-center justify-center cursor-pointer home-center-node relative"
          style={{
            width: `${centerRadius * 2}px`,
            height: `${centerRadius * 2}px`,
            borderRadius: '50%',
            animation: 'glow-pulse-strong 3s ease-in-out infinite',
            outline: 'none',
            zIndex: 20
          }}
        >
          <div
            className="flex items-center justify-center rounded-lg mb-3 mt-4"
            style={{
              width: '175px',
              height: '120px',
              background: 'rgba(10, 28, 28, 0.8)',
              border: '1px solid rgba(45,212,212,0.25)',
            }}
          >
            <CanvasPreview />
          </div>
          <span className="text-white font-extrabold text-center leading-tight" style={{ fontSize: '16px', letterSpacing: '0.12em' }}>DRAW MOLECULE</span>
          <span className="text-center mt-1" style={{ color: '#8aafaf', fontSize: '12px' }}>Start your research here</span>
        </div>

        {/* Onboarding Tooltip */}
        {showOnboarding && (
          <div 
            className="absolute z-50 flex flex-col pointer-events-auto"
            style={{ 
              top: '-30px', 
              right: '-240px', 
              width: '240px', 
              background: 'rgba(5, 13, 15, 0.95)',
              border: '1px solid #2dd4d4',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 15px rgba(45,212,212,0.2)',
              backdropFilter: 'blur(8px)',
              animation: 'fade-in-up 0.5s ease-out'
            }}
          >
            {/* Arrow pointing left */}
            <div className="absolute" style={{ top: '60px', left: '-7px', width: '12px', height: '12px', background: 'rgba(5, 13, 15, 0.95)', borderLeft: '1px solid #2dd4d4', borderBottom: '1px solid #2dd4d4', transform: 'rotate(45deg)' }} />
            
            <h4 className="text-white m-0 mb-2 font-bold flex items-center gap-2" style={{ fontSize: '14px' }}>
              <span style={{ color: '#2dd4d4' }}>✨</span> New here?
            </h4>
            <p className="m-0 mb-4 text-[#a0c4c4]" style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Start by drawing a molecule or pasting a SMILES string to begin your research.
            </p>
            <button 
              onClick={dismissOnboarding}
              className="bg-[#2dd4d4] text-[#050d0f] font-bold py-2 px-4 rounded transition-colors hover:bg-white border-none cursor-pointer"
              style={{ fontSize: '13px', alignSelf: 'flex-start' }}
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   ANIMATED COUNT-UP NUMBER
   ════════════════════════════════════════════════════════════ */

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0)
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const target = typeof value === 'number' ? value : 0
    if (prefersReducedMotion.current || target === 0) {
      setDisplay(target)
      return
    }
    let start = 0
    const startTime = performance.now()
    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * target)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])

  return <>{display > 999 ? `${Math.floor(display / 100) * 100}+` : display}</>
}


/* ════════════════════════════════════════════════════════════
   OFFLINE BADGE
   ════════════════════════════════════════════════════════════ */

function OfflineBadge() {
  return (
    <div
      className="flex items-center gap-2 rounded-full"
      style={{
        padding: '8px 20px',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        border: '1.5px solid #2dd4d4',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, letterSpacing: '0.04em' }}>Offline-First</span>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   HERO IMPACT STRIP (replaces old StatsBar — distinct layout)
   ════════════════════════════════════════════════════════════ */

function HeroImpactStrip({ stats }) {
  const items = [
    { value: stats?.total_experiments ?? 0, label: 'Experiments' },
    { value: stats?.saved_documents ?? 0, label: 'Documents' },
    { value: stats?.reference_molecules ?? 0, label: 'References' },
  ]

  return (
    <div
      className="flex items-stretch rounded-xl mx-auto"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(45,212,212,0.35)',
        width: 'fit-content',
        animation: 'fade-in-up 0.6s ease-out 0.4s both',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center"
          style={{
            padding: '14px 36px',
            borderLeft: i > 0 ? '1px solid rgba(45,212,212,0.25)' : 'none',
          }}
        >
          <span
            style={{
              color: '#2dd4d4',
              fontSize: '32px',
              fontWeight: 800,
              lineHeight: 1.1,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <AnimatedNumber value={item.value} />
          </span>
          <span
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   RECENT ACTIVITY BAR (bottom — replaces duplicate StatsBar)
   Shows last 3 experiments from the same data source.
   Option (b): repurposed to show different info.
   ════════════════════════════════════════════════════════════ */

function RecentActivityBar({ experiments }) {
  if (!experiments || experiments.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl mx-auto"
        style={{
          background: 'rgba(10, 24, 26, 0.85)',
          border: '1px solid rgba(45,212,212,0.1)',
          backdropFilter: 'blur(10px)',
          padding: '14px 32px',
          animation: 'fade-in-up 0.7s ease-out 0.8s both',
        }}
      >
        <span style={{ color: '#6a9a9a', fontSize: '13px', fontStyle: 'italic' }}>No experiments yet — draw a molecule to begin.</span>
      </div>
    )
  }

  const recent = experiments.slice(0, 3)

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div
      className="flex items-center justify-center rounded-xl mx-auto gap-0"
      style={{
        background: 'rgba(10, 24, 26, 0.85)',
        border: '1px solid rgba(45,212,212,0.1)',
        backdropFilter: 'blur(10px)',
        width: 'fit-content',
        animation: 'fade-in-up 0.7s ease-out 0.8s both',
      }}
    >
      <div style={{ padding: '12px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4d4" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ color: '#8aafaf', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Recent</span>
      </div>
      {recent.map((exp, i) => (
        <div
          key={exp.id || i}
          className="flex items-center gap-2"
          style={{
            padding: '12px 20px',
            borderLeft: '1px solid rgba(45,212,212,0.12)',
          }}
        >
          <span style={{ color: '#d8efef', fontSize: '13px', fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {exp.name || exp.smiles || 'Untitled'}
          </span>
          <span style={{ color: '#5a8080', fontSize: '11px', flexShrink: 0 }}>
            {timeAgo(exp.date || exp.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   CHATBOT FAB
   ════════════════════════════════════════════════════════════ */

function ChatbotFab() {
  const [isExpanded, setIsExpanded] = useState(true)
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion.current) {
       setIsExpanded(false)
       return
    }
    const timer = setTimeout(() => {
      setIsExpanded(false)
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <button
      className="fixed rounded-full flex items-center cursor-pointer group"
      aria-label="Ask ROGVEDA"
      style={{
        bottom: '32px', right: '32px',
        height: '56px',
        maxWidth: isExpanded ? '200px' : '56px',
        background: 'rgba(10, 24, 26, 0.9)',
        border: '2px solid rgba(45,212,212,0.5)',
        boxShadow: '0 0 20px rgba(45,212,212,0.15), 0 4px 20px rgba(0,0,0,0.4)',
        zIndex: 50,
        animation: 'glow-pulse 3s ease-in-out infinite',
        transition: 'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        padding: 0
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocus={() => setIsExpanded(true)}
      onBlur={() => setIsExpanded(false)}
    >
      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '52px', height: '52px' }}>
         <RobotIcon />
      </div>
      <span 
        className="font-bold text-[#2dd4d4] tracking-wider uppercase"
        style={{
           fontSize: '13px',
           opacity: isExpanded ? 1 : 0,
           transform: isExpanded ? 'translateX(0)' : 'translateX(10px)',
           transition: 'all 0.3s ease-out',
           transitionDelay: isExpanded ? '0.1s' : '0s',
           paddingRight: '20px'
        }}
      >
        Ask Rogveda
      </span>
    </button>
  )
}


/* ════════════════════════════════════════════════════════════
   CHAT INTERFACE
   ════════════════════════════════════════════════════════════ */

function ChatInterface({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Rogveda AI. How can I help you with your molecular research today?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

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

  return (
    <div
      className="fixed flex flex-col rounded-xl overflow-hidden"
      style={{
        bottom: '104px', right: '40px',
        width: '380px', height: '500px',
        background: 'rgba(5, 13, 15, 0.95)',
        border: '1px solid rgba(45,212,212,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 51,
        animation: 'fade-in-up 0.3s ease-out both'
      }}
    >
      <div 
        className="flex items-center justify-between" 
        style={{ 
          padding: '16px 24px', 
          background: 'rgba(10, 24, 26, 0.9)', 
          borderBottom: '1px solid rgba(45,212,212,0.15)' 
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <RobotIcon width={22} height={22} />
          </div>
          <span className="text-white font-bold tracking-wide text-sm">Rogveda AI</span>
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer flex items-center justify-center transition-colors"
          style={{ width: '24px', height: '24px', fontSize: '18px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-4" style={{ padding: '24px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="rounded-xl max-w-[85%]"
              style={{
                padding: '12px 20px',
                background: msg.role === 'user' ? 'rgba(45,212,212,0.15)' : 'rgba(255,255,255,0.05)',
                color: '#d8efef', fontSize: '13.5px', lineHeight: '1.5',
                border: msg.role === 'user' ? '1px solid rgba(45,212,212,0.3)' : '1px solid rgba(255,255,255,0.1)',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
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
            <div className="rounded-xl" style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', color: '#8aafaf', fontSize: '13.5px' }}>
              Thinking...
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '20px', borderTop: '1px solid rgba(45,212,212,0.15)', background: 'rgba(10, 24, 26, 0.9)' }}>
        <div className="flex items-center rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(45,212,212,0.3)' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask something..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm"
            style={{ padding: '14px 24px' }}
          />
          <button 
            onClick={handleSend} 
            className="bg-transparent border-none cursor-pointer text-[#2dd4d4] hover:text-white font-bold"
            style={{ padding: '14px 24px' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN HOME PAGE EXPORT
   ════════════════════════════════════════════════════════════ */

import { experimentService } from '../lib/experimentService'

export default function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [error, setError] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }

    async function fetchData() {
      try {
        const [userData, statsData] = await Promise.all([
          get('/api/auth/me'),
          get('/api/auth/stats'),
        ])
        setUser(userData)
        
        let exps = []
        try {
          exps = await experimentService.syncExperiments()
        } catch(e) {}

        setExperiments(exps)
        setStats({
          ...statsData,
          total_experiments: exps.length,
        })
      } catch (err) {
        console.error('Failed to fetch dashboard data', err)
        setError('Session expired. Please log in again.')
        clearToken()
        navigate('/login')
      }
    }

    fetchData()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050d0f' }}>
        <p className="text-center" style={{ color: '#f87171' }}>{error}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050d0f' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full" style={{ width: '40px', height: '40px', border: '2px solid #2dd4d4', borderTopColor: 'transparent', animation: 'spin-slow 1s linear infinite' }} />
          <span style={{ color: '#5a8080', fontSize: '14px' }}>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#050d0f url(/homepage_bg.jpg) center/cover no-repeat' }}>
      {/* Background Blur Overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(5, 13, 15, 0.45)', backdropFilter: 'blur(8px)', zIndex: 0 }} />

      {/* Procedural background */}
      <ProceduralBackground />

      {/* Top Nav */}
      <TopNav user={user} />

      {/* Main content */}
      <div className="relative flex flex-col items-center min-h-screen" style={{ paddingTop: '80px', paddingBottom: '32px', zIndex: 1 }}>

        {/* Offline badge — top area */}
        <div className="flex flex-col items-center gap-3" style={{ marginTop: '8px', zIndex: 10 }}>
          <OfflineBadge />
        </div>

        {/* Right sidebar text */}
        <div
          className="fixed flex items-start gap-3"
          style={{ 
            right: '24px', top: '88px', 
            padding: '12px 16px',
            background: 'rgba(5, 13, 15, 0.5)',
            backdropFilter: 'blur(6px)',
            borderRadius: '12px',
            border: '1px solid rgba(45, 212, 212, 0.1)',
            animation: 'fade-in-up 0.7s ease-out 0.5s both', 
            zIndex: 10 
          }}
        >
          <div className="rounded-full" style={{ width: '2px', height: '64px', background: '#2dd4d4', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 8px rgba(45,212,212,0.4)' }} />
          <div className="flex flex-col">
            <span style={{ color: '#d8efef', fontSize: '15px', fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>Analyze Molecules.</span>
            <span style={{ color: '#d8efef', fontSize: '15px', fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>Generate Insights.</span>
            <span style={{ color: '#d8efef', fontSize: '15px', fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>Drive Discovery.</span>
          </div>
        </div>

        {/* Molecule Hub — centered */}
        <div className="flex items-center justify-center" style={{ flex: 1, marginTop: '0px' }}>
          <MoleculeHub />
        </div>

        {/* Bottom-left text */}
        <div
          className="fixed flex flex-col"
          style={{ 
            bottom: '88px', left: '24px', gap: '6px', 
            padding: '12px 16px',
            background: 'rgba(5, 13, 15, 0.5)',
            backdropFilter: 'blur(6px)',
            borderRadius: '12px',
            border: '1px solid rgba(45, 212, 212, 0.1)',
            animation: 'fade-in-up 0.7s ease-out 0.6s both', 
            zIndex: 10 
          }}
        >
          <div className="rounded-full" style={{ width: '40px', height: '2px', background: '#2dd4d4', marginBottom: '4px', boxShadow: '0 0 8px rgba(45,212,212,0.4)' }} />
          <span style={{ color: '#d8efef', fontSize: '15px', fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>Discover Molecules.</span>
          <span style={{ color: '#d8efef', fontSize: '15px', fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>Decode Possibilities.</span>
        </div>

        {/* Hero Impact Strip — bottom */}
        <div className="w-full flex justify-center" style={{ marginTop: 'auto', marginBottom: '16px', paddingLeft: '32px', paddingRight: '32px', zIndex: 10 }}>
          <HeroImpactStrip stats={stats} />
        </div>
      </div>

      {/* Chatbot FAB */}
      <div onClick={() => setIsChatOpen(!isChatOpen)}>
        <ChatbotFab />
      </div>

      <ChatInterface isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
