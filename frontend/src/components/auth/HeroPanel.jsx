/**
 * HeroPanel — Left 55 % of the auth pages.
 *
 * Dark teal radial-gradient background with noise overlay,
 * corner text labels, inline-SVG molecule illustrations,
 * and floating / parallax animations via Framer Motion.
 */

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import MoleculeSVG from './MoleculeSVG.jsx'

/* ── Particle / bokeh dot ────────────────────────────────── */
function Particle({ x, y, size, delay, minOpacity = 0.15, maxOpacity = 0.55 }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: 'radial-gradient(circle, #2dd4bf 0%, transparent 70%)',
      }}
      animate={{ opacity: [minOpacity, maxOpacity, minOpacity] }}
      transition={{
        duration: 3.5 + Math.random() * 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  )
}

/* ── Generate static particle positions (SSR-safe) ────── */
const PARTICLES = Array.from({ length: 25 }, (_, i) => ({
  x: Math.round(1 + Math.random() * 98),
  y: Math.round(1 + Math.random() * 98),
  size: 2 + Math.random() * 4,
  delay: i * 0.35,
  minOpacity: 0.15,
  maxOpacity: 0.15 + Math.random() * 0.2,  // 15%–35% range
}))

/* ── Floating animation configs per molecule element ─────── */
const floatVariants = (i) => ({
  animate: {
    y: [0, -20, 0, 20, 0],
    x: [0, 12, 0, -12, 0],
    rotate: [0, 8, 0, -8, 0],
  },
  transition: {
    duration: 5 + i,
    repeat: Infinity,
    ease: 'easeInOut',
    delay: i * 1.2,
  },
})

export default function HeroPanel() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    setMouse({
      x: (e.clientX - window.innerWidth / 2) * 0.04,
      y: (e.clientY - window.innerHeight / 2) * 0.04,
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Parallax offsets (foreground moves more, background less)
  const fgX = mouse.x
  const fgY = mouse.y
  const bgX = mouse.x * 0.3
  const bgY = mouse.y * 0.3

  return (
    <div
      className="relative h-full overflow-hidden hidden lg:flex flex-col justify-between"
      style={{
        background:
          'radial-gradient(ellipse at 40% 50%, #0d2320 0%, #081614 50%, #050a09 100%)',
      }}
    >
      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.05,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Top-left corner label ──────────────────────────── */}
      <div className="relative z-20" style={{ paddingTop: '48px', paddingLeft: '48px' }}>
        <p
          className="uppercase text-white"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.6,
            letterSpacing: '0.2em'
          }}
        >
          MOLECULAR<br />
          INSIGHTS<br />
          A HEALTHIER<br />
          TOMORROW
        </p>
        <div style={{ width: '32px', height: '2px', backgroundColor: '#2dd4bf', marginTop: '16px' }} />
      </div>

      <div className="absolute inset-0 z-[5] flex items-center justify-center">
        {/* (a) Large cluster — top-right quadrant, blur:1px, opacity:0.9 */}
        <motion.div
          className="absolute"
          style={{
            top: '5%', right: '10%', width: 180, opacity: 0.9,
            filter: 'blur(1px)',
            x: bgX * 1.2, y: bgY * 1.2,
          }}
          {...floatVariants(0)}
        >
          <MoleculeSVG layout="main" />
        </motion.div>

        {/* (b) Medium cluster — mid-right area, blur:0.5px, opacity:1 */}
        <motion.div
          className="absolute"
          style={{
            top: '40%', right: '0%', width: 130, opacity: 1,
            filter: 'blur(0.5px)',
            x: bgX * 0.9, y: bgY * 0.9,
          }}
          {...floatVariants(1)}
        >
          <MoleculeSVG layout="clusterB" />
        </motion.div>

        {/* (c) Medium cluster — bottom-right quadrant, blur:2px, opacity:0.7 */}
        <motion.div
          className="absolute"
          style={{
            bottom: '15%', right: '15%', width: 120, opacity: 0.7,
            filter: 'blur(2px)',
            x: bgX * 0.7, y: bgY * 0.7,
          }}
          {...floatVariants(2)}
        >
          <MoleculeSVG layout="clusterB" />
        </motion.div>

        {/* (d) Small cluster — far top-left corner, blur:3px, opacity:0.5 */}
        <motion.div
          className="absolute"
          style={{
            top: '8%', left: '5%', width: 90, opacity: 0.5,
            filter: 'blur(3px)',
            x: bgX * 0.4, y: bgY * 0.4,
          }}
          {...floatVariants(3)}
        >
          <MoleculeSVG layout="clusterA" />
        </motion.div>

        {/* (e) Small cluster — bottom-left, blur:2px, opacity:0.6 */}
        <motion.div
          className="absolute"
          style={{
            bottom: '25%', left: '8%', width: 85, opacity: 0.6,
            filter: 'blur(2px)',
            x: bgX * 0.6, y: bgY * 0.6,
          }}
          {...floatVariants(4)}
        >
          <MoleculeSVG layout="clusterA" />
        </motion.div>

        {/* (g) Medium cluster — top-center/mid-left empty space, blur:1px, opacity:0.85 */}
        <motion.div
          className="absolute"
          style={{
            top: '5%', left: '35%', width: 150, opacity: 0.85,
            filter: 'blur(1px)',
            x: bgX * 1.1, y: bgY * 1.1,
          }}
          {...floatVariants(6)}
        >
          <MoleculeSVG layout="clusterB" />
        </motion.div>

        {/* (h) Medium cluster — mid-left empty space, blur:1.5px, opacity:0.75 */}
        <motion.div
          className="absolute"
          style={{
            top: '25%', left: '15%', width: 110, opacity: 0.75,
            filter: 'blur(1.5px)',
            x: bgX * 0.8, y: bgY * 0.8,
          }}
          {...floatVariants(7)}
        >
          <MoleculeSVG layout="clusterA" />
        </motion.div>

        {/* (i) Small cluster — lower mid-right empty space, blur:2.5px, opacity:0.65 */}
        <motion.div
          className="absolute"
          style={{
            top: '70%', right: '25%', width: 95, opacity: 0.65,
            filter: 'blur(2.5px)',
            x: bgX * 0.6, y: bgY * 0.6,
          }}
          {...floatVariants(8)}
        >
          <MoleculeSVG layout="clusterA" />
        </motion.div>

        {/* (j) Medium-Large cluster — mid-center empty space, clearly visible */}
        <motion.div
          className="absolute"
          style={{
            top: '35%', left: '55%', width: 155, opacity: 0.95,
            filter: 'blur(0.5px)',
            x: bgX * 1.2, y: bgY * 1.2,
          }}
          {...floatVariants(9)}
        >
          <MoleculeSVG layout="clusterC" />
        </motion.div>

        {/* (f) Large central "hero" molecule — lower-left-center, in focus */}
        <motion.div
          className="absolute"
          style={{
            bottom: '15%',
            left: '18%',
            width: '55%',
            maxWidth: 340,
            x: fgX, y: fgY,
          }}
          {...floatVariants(5)}
        >
          <MoleculeSVG layout="main" />
        </motion.div>
      </div>

      {/* Particles / dust */}
      <div className="absolute inset-0 z-[4] pointer-events-none">
        {PARTICLES.map((p, i) => (
          <Particle key={i} {...p} />
        ))}
      </div>

      {/* ── Bottom-left corner label ───────────────────────── */}
      <div className="relative z-20" style={{ paddingBottom: '48px', paddingLeft: '48px' }}>
        <div style={{ width: '32px', height: '2px', backgroundColor: '#2dd4bf', marginBottom: '12px' }} />
        <p
          className="uppercase"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#2dd4bf',
            marginBottom: '4px'
          }}
        >
          POWERED BY
        </p>
        <p
          className="uppercase"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            color: '#ffffff',
          }}
        >
          AI – DRIVEN BY CHEMISTRY
        </p>
      </div>
    </div>
  )
}
