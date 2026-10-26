/**
 * ROGVEDA — Advanced Interactive Molecular Research Homepage
 *
 * Implements the new 3D molecular hub architecture with real-time WebGL,
 * dual interactive Three.js scenes, animated energy spokes, live endpoints
 * (/api/auth/me, /api/auth/stats, /api/chat/, experimentService), activity
 * history, notifications, onboarding tour, and responsive layout.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as THREE from 'three'
import { get, post, clearToken, isAuthenticated } from '../lib/apiClient.js'
import { experimentService } from '../lib/experimentService.js'
import { getHistory, getNotifications, markNotificationsRead, addHistory } from '../lib/events.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './Home.css'

/* ════════════════════════════════════════════════════════════
   OUTER NODE DEFINITIONS & SPOKE TOPOLOGY
   ════════════════════════════════════════════════════════════ */

const TOOLS = [
  {
    id: 'analysis',
    title: 'Molecular analysis',
    desc: 'Calculate properties and descriptors',
    iconPath: 'M5 20v-8h4v8M10 20V5h4v15M15 20V9h4v11',
    angle: -90,
    align: 'r',
    width: 170,
    route: '/draw?tab=Analysis',
  },
  {
    id: 'prediction',
    title: 'Prediction & AI',
    desc: 'Predict biological activities with machine learning',
    iconPath: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 5 2V6a2 2 0 0 0-2-2zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5 2V6a2 2 0 0 1 2-2zM8 12h2.5M13.5 12h2.5',
    angle: -30,
    align: 'r',
    width: 220,
    route: '/draw?tab=Prediction',
  },
  {
    id: 'batch',
    title: 'Batch screening',
    desc: 'Process up to 500 molecules at once',
    iconPath: 'M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
    angle: 30,
    align: 'r',
    width: 160,
    route: '/batch',
  },
  {
    id: 'compare',
    title: 'Compare molecules',
    desc: 'Analyze and compare molecular structures',
    iconPath: 'M12 4v16M7 20h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z',
    angle: 90,
    align: 'r',
    width: 160,
    route: '/draw?tab=Compare',
  },
  {
    id: 'modification',
    title: 'Molecular modification',
    desc: 'Edit and generate new structures',
    iconPath: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
    angle: 150,
    align: 'l',
    width: 160,
    route: '/draw?tab=Modify',
  },
  {
    id: 'similarity',
    title: 'Similarity search',
    desc: 'Find structurally similar molecules',
    iconPath: 'M10.500 4a6.500 6.500 0 1 0 0 13 6.500 6.500 0 0 0 0-13zM15.500 15.500L21 21',
    angle: 210,
    align: 'l',
    width: 160,
    route: '/draw?tab=Search',
  },
]

const CX = 480
const CY = 350
const D = 231

/* ════════════════════════════════════════════════════════════
   ANIMATED NUMBER COMPONENT
   ════════════════════════════════════════════════════════════ */

function AnimatedNumber({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = typeof value === 'number' ? value : 0
    if (isReduced || target === 0) {
      setDisplay(target)
      return
    }

    const startTime = performance.now()
    let frameId
    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * target))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  return <>{display > 999 ? `${Math.floor(display / 100) * 100}+` : display}</>
}

/* ════════════════════════════════════════════════════════════
   MAIN HOMEPAGE COMPONENT
   ════════════════════════════════════════════════════════════ */

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()

  // Real data state
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [history, setHistory] = useState([])
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState(null)

  // Interactive UI state
  const [hoverIndex, setHoverIndex] = useState(null)
  const [hoverHub, setHoverHub] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isBotExpanded, setIsBotExpanded] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isReduced) {
      setIsBotExpanded(false)
      return
    }
    const timer = setTimeout(() => {
      setIsBotExpanded(false)
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Chat conversation state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am **Rogveda AI**. How can I assist with your molecular structures, QSAR predictions, or chemical experiments today?',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Canvas Refs
  const bgCanvasRef = useRef(null)
  const hvCanvasRef = useRef(null)
  const toastTimerRef = useRef(null)

  // Interaction refs for Three.js animation loop without stale closures
  const hoverIndexRef = useRef(null)
  const hoverHubRef = useRef(false)

  useEffect(() => {
    hoverIndexRef.current = hoverIndex
  }, [hoverIndex])

  useEffect(() => {
    hoverHubRef.current = hoverHub
  }, [hoverHub])

  // Helper toast notification
  const showToast = useCallback((msg) => {
    setToastMessage(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 2400)
  }, [])

  // ── Authentication & Data Fetching ───────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }

    async function loadData() {
      try {
        const [userData, statsData] = await Promise.all([
          get('/api/auth/me'),
          get('/api/auth/stats'),
        ])
        setUser(userData)

        let exps = []
        try {
          exps = await experimentService.syncExperiments()
        } catch (e) {
          console.warn('Could not sync experiments:', e)
        }
        setExperiments(exps)
        setStats({
          ...statsData,
          total_experiments: exps.length,
        })
      } catch (err) {
        console.error('Failed to load dashboard data', err)
        setError('Session expired. Please log in again.')
        clearToken()
        navigate('/login')
      }
    }

    loadData()

    // Load initial events & notifications
    setHistory(getHistory())
    const existingNotifs = getNotifications()
    if (existingNotifs.length === 0) {
      const welcome = {
        id: 'welcome-init',
        title: 'Welcome to Rogveda!',
        message: 'Your molecular research workspace is ready. Draw molecules, predict properties, and screen compounds.',
        time: new Date().toISOString(),
        read: false,
      }
      localStorage.setItem('rogveda_notifications', JSON.stringify([welcome]))
      setNotifications([welcome])
    } else {
      setNotifications(existingNotifs)
    }

    // Onboarding status
    if (localStorage.getItem('rogveda_onboarding_seen') !== 'true') {
      setShowOnboarding(true)
    }

    const handleOnboarding = () => {
      setShowOnboarding(true)
      localStorage.removeItem('rogveda_onboarding_seen')
    }
    window.addEventListener('rogveda_show_onboarding', handleOnboarding)

    const handleHistoryUpdate = () => setHistory(getHistory())
    const handleNotifUpdate = () => setNotifications(getNotifications())
    window.addEventListener('rogveda_history_updated', handleHistoryUpdate)
    window.addEventListener('rogveda_notifications_updated', handleNotifUpdate)

    addHistory('Opened Research Dashboard')

    return () => {
      window.removeEventListener('rogveda_show_onboarding', handleOnboarding)
      window.removeEventListener('rogveda_history_updated', handleHistoryUpdate)
      window.removeEventListener('rogveda_notifications_updated', handleNotifUpdate)
    }
  }, [navigate])

  // ── Three.js 3D Visuals & Interactive Animation ─────────────
  useEffect(() => {
    if (!bgCanvasRef.current || !hvCanvasRef.current) return

    const T = THREE
    const isReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isSmall = () => window.innerWidth < 820

    function rng(s) {
      return () => {
        s |= 0
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    function grow(n, seed, ring) {
      const r = rng(seed)
      const P = []
      const B = []
      if (ring) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          P.push(new T.Vector3(Math.cos(a), Math.sin(a), 0))
        }
        for (let i = 0; i < 6; i++) B.push([i, (i + 1) % 6])
      } else {
        P.push(new T.Vector3())
      }
      let k = 0
      while (P.length < n && k++ < 600) {
        const p = Math.floor(r() * P.length)
        const d = new T.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize()
        const q = P[p].clone().add(d)
        if (P.every((v) => v.distanceTo(q) > 0.85)) {
          P.push(q)
          B.push([p, P.length - 1])
        }
      }
      const c = new T.Vector3()
      P.forEach((v) => c.add(v))
      c.divideScalar(P.length)
      P.forEach((v) => v.sub(c))
      return { P, B }
    }

    const UP = new T.Vector3(0, 1, 0)
    const cyl = new T.CylinderGeometry(0.05, 0.05, 1, 6)
    const sLo = new T.SphereGeometry(1, 12, 9)
    const sHi = new T.SphereGeometry(1, 24, 18)
    const PR = () => Math.min(window.devicePixelRatio || 1, isSmall() ? 1 : 1.5)

    function bond(a, b, mat, w) {
      const m = new T.Mesh(cyl, mat)
      const d = b.clone().sub(a)
      m.position.copy(a).addScaledVector(d, 0.5)
      m.scale.set(w, d.length(), w)
      m.quaternion.setFromUnitVectors(UP, d.normalize())
      return m
    }

    const PL = []
    const pm = new T.MeshBasicMaterial({
      color: 0xe9ffff,
      transparent: true,
      opacity: 0.9,
      blending: T.AdditiveBlending,
      depthWrite: false,
    })

    function pulses(g, B, P, n, sz) {
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(sLo, pm)
        m.scale.setScalar(sz)
        g.add(m)
        PL.push({
          m,
          B,
          P,
          b: B[Math.floor(Math.random() * B.length)],
          t: Math.random(),
          s: 0.25 + Math.random() * 0.3,
        })
      }
    }

    let bgR, hvR
    try {
      bgR = new T.WebGLRenderer({ canvas: bgCanvasRef.current, antialias: !isSmall(), alpha: true })
      hvR = new T.WebGLRenderer({ canvas: hvCanvasRef.current, antialias: true, alpha: true })
    } catch (e) {
      console.warn('WebGL init failed:', e)
      document.body.classList.add('nogl')
      return
    }

    /* ── Background Scene ── */
    const bgS = new T.Scene()
    bgS.fog = new T.FogExp2(0x020d10, 0.04)
    const bgC = new T.PerspectiveCamera(50, 1, 0.1, 80)
    bgC.position.set(0, 0, 14)
    bgS.add(new T.AmbientLight(0x1f5a5e, 0.9))

    ;[
      [-9, 5, 4, 0x00f5e9, 1.4],
      [10, -4, 2, 0x00cfc8, 1.2],
      [0, 0, -8, 0x008f91, 1.4],
    ].forEach((a) => {
      const l = new T.PointLight(a[3], a[4], 40)
      l.position.set(a[0], a[1], a[2])
      bgS.add(l)
    })

    const mk = (c, e, o) =>
      new T.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: e,
        transparent: true,
        opacity: o,
        roughness: 0.4,
      })

    const am = [mk(0x00cfc8, 0.55, 0.85), mk(0x00cfc8, 0.35, 0.65), mk(0x008f91, 0.25, 0.5)]
    const bb = new T.MeshBasicMaterial({ color: 0x00cfc8, transparent: true, opacity: 0.35 })

    const MOL = []
    const r = rng(5)
    const N = isSmall() ? 8 : 14
    const xs = isSmall() ? 0.55 : 1

    for (let i = 0; i < N; i++) {
      const big = i < 4
      const side = i % 2 ? 1 : -1
      const n = big ? 14 : 6 + Math.floor(r() * 6)
      const s = big ? 1.5 : 0.6 + r() * 0.5
      const base = new T.Vector3(
        side * (big ? 11 + r() * 3 : 7 + r() * 9) * xs,
        (r() - 0.5) * (big ? 12 : 15),
        big ? -2 - r() * 3 : -5 - r() * 14
      )
      const { P, B } = grow(n, 100 + i, i % 3 === 0)
      const g = new T.Group()
      const mat = big ? am[0] : base.z < -12 ? am[2] : am[1]
      P.forEach((p) => {
        const m = new T.Mesh(sLo, mat)
        m.position.copy(p)
        m.scale.setScalar(0.22 + r() * 0.14)
        g.add(m)
      })
      B.forEach(([a, b]) => g.add(bond(P[a], P[b], bb, 1)))
      g.scale.setScalar(s)
      g.position.copy(base)
      bgS.add(g)
      if (!isReduce) pulses(g, B, P, 2, 0.07)
      MOL.push({
        g,
        base,
        ph: r() * 6.28,
        f: 0.1 + r() * 0.12,
        rx: (r() - 0.5) * 0.12,
        ry: (r() - 0.5) * 0.16 + 0.03,
      })
    }

    const wm = new T.MeshBasicMaterial({ color: 0x008f91, wireframe: true, transparent: true, opacity: 0.14 })
    const WF = []
    ;[
      [-12, -5, -6],
      [13, 6, -10],
      [-14, 6, -14],
    ].forEach((p) => {
      const m = new T.Mesh(new T.IcosahedronGeometry(2, 1), wm)
      m.position.set(p[0] * xs, p[1], p[2])
      bgS.add(m)
      WF.push(m)
    })

    const pc = isSmall() ? 80 : 220
    const pa = new Float32Array(pc * 3)
    for (let i = 0; i < pc * 3; i += 3) {
      pa[i] = (Math.random() - 0.5) * 34
      pa[i + 1] = (Math.random() - 0.5) * 20
      pa[i + 2] = -18 + Math.random() * 26
    }
    const pg = new T.BufferGeometry()
    pg.setAttribute('position', new T.BufferAttribute(pa, 3))
    const pts = new T.Points(
      pg,
      new T.PointsMaterial({
        color: 0x00cfc8,
        size: 0.06,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: T.AdditiveBlending,
      })
    )
    bgS.add(pts)

    /* ── Hub Spinning Molecule Scene ── */
    const H = grow(14, 7, true)
    const hr = rng(11)
    H.E = H.P.map((_, i) => (i === 3 ? 'N' : i < 6 ? 'C' : hr() < 0.25 ? 'N' : hr() < 0.45 ? 'O' : 'C'))
    const sets = TOOLS.map((_, i) => {
      const c = (i * 2 + 1) % H.P.length
      const s = new Set([c])
      H.B.forEach(([a, b]) => {
        if (a === c) s.add(b)
        if (b === c) s.add(a)
      })
      return s
    })

    const hs = new T.Scene()
    const hc = new T.PerspectiveCamera(40, 1.5, 0.1, 50)
    hc.position.z = 7.4
    hs.add(new T.AmbientLight(0x1f5a5e, 0.9))

    const dl = new T.DirectionalLight(0xe9ffff, 0.9)
    dl.position.set(3, 4, 6)
    hs.add(dl)

    const p1 = new T.PointLight(0x00f5e9, 1.4, 30)
    p1.position.set(-4, -2, 4)
    hs.add(p1)

    const pivot = new T.Group()
    const mol = new T.Group()
    pivot.add(mol)
    hs.add(pivot)

    const col = { C: 0x1fb8b4, N: 0x00f5e9, O: 0xe9ffff }
    const rad = { C: 0.34, N: 0.38, O: 0.33 }
    const atoms = H.P.map((p, i) => {
      const e = H.E[i]
      const m = new T.Mesh(
        sHi,
        new T.MeshStandardMaterial({
          color: col[e],
          emissive: col[e],
          emissiveIntensity: 0.25,
          roughness: 0.28,
          metalness: 0.25,
        })
      )
      m.position.copy(p)
      m.scale.setScalar(rad[e])
      m.userData = { i, h: 0, s: rad[e] }
      mol.add(m)
      return m
    })

    const hb = new T.MeshStandardMaterial({
      color: 0x7fd6d4,
      emissive: 0x008f91,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.2,
    })
    H.B.forEach(([a, b]) => mol.add(bond(H.P[a], H.P[b], hb, 2)))
    if (!isReduce) pulses(mol, H.B, H.P, 3, 0.09)

    let yaw = 0.6
    let mx = 0
    let my = 0
    let isVisible = true

    const handlePointerMove = (e) => {
      mx = e.clientX / window.innerWidth - 0.5
      my = e.clientY / window.innerHeight - 0.5
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]) isVisible = entries[0].isIntersecting
    })
    if (hvCanvasRef.current) observer.observe(hvCanvasRef.current)

    // Resize and scale handling
    function updateDimensions() {
      const w = window.innerWidth
      const h = window.innerHeight
      bgR.setPixelRatio(PR())
      bgR.setSize(w, h, false)
      bgC.aspect = w / h
      bgC.updateProjectionMatrix()

      const cw = hvCanvasRef.current?.clientWidth || 150
      const ch = hvCanvasRef.current?.clientHeight || 100
      const scaleVal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1
      hvR.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * Math.max(1, scaleVal)))
      hvR.setSize(cw, ch, false)
      hc.aspect = cw / ch
      hc.updateProjectionMatrix()

      // Calculate responsive --s
      const isMobile = w < 820
      const newScale = isMobile ? 1 : Math.max(0.5, Math.min(1.1, (h - 80 - 150) / 660, (w - 32) / 960))
      document.documentElement.style.setProperty('--s', newScale.toFixed(3))
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    let lastTime = performance.now()
    let elapsedSec = 0
    let animId

    function renderLoop(now) {
      animId = requestAnimationFrame(renderLoop)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const md = isReduce ? 0 : dt
      elapsedSec += md

      bgC.position.x += (mx * 2 - bgC.position.x) * 0.04
      bgC.position.y += (-my * 1.4 - bgC.position.y) * 0.04
      bgC.lookAt(0, 0, 0)

      MOL.forEach((m) => {
        m.g.rotation.x += md * m.rx
        m.g.rotation.y += md * m.ry
        m.g.position.set(
          m.base.x + Math.sin(elapsedSec * m.f + m.ph) * 1.2,
          m.base.y + Math.cos(elapsedSec * m.f * 0.8 + m.ph) * 0.9,
          m.base.z + Math.sin(elapsedSec * m.f * 0.6 + m.ph) * 0.8
        )
      })

      WF.forEach((w, i) => {
        w.rotation.x += md * 0.05 * (i + 1)
        w.rotation.y += md * 0.07
      })
      pts.rotation.y += md * 0.01

      PL.forEach((p) => {
        p.t += md * p.s
        if (p.t > 1) {
          p.t = 0
          p.b = p.B[Math.floor(Math.random() * p.B.length)]
        }
        p.m.position.lerpVectors(p.P[p.b[0]], p.P[p.b[1]], p.t)
        p.m.visible = p.t > 0.02 && p.t < 0.98
      })

      bgR.render(bgS, bgC)

      if (!isVisible) return

      yaw += md * (hoverHubRef.current ? 0.7 : 0.25)
      pivot.rotation.set(0.3 + my * 0.5, yaw + mx * 0.6, 0)

      const activeSet = hoverIndexRef.current !== null ? sets[hoverIndexRef.current] : null
      atoms.forEach((a) => {
        const u = a.userData
        const want = activeSet ? (activeSet.has(u.i) ? 1 : -0.4) : 0
        u.h += (want - u.h) * 0.12
        a.material.emissiveIntensity = Math.max(0.05, 0.25 + u.h * 0.9)
        a.scale.setScalar(u.s * (1 + Math.max(0, u.h) * 0.3))
      })

      hvR.render(hs, hc)
    }

    animId = requestAnimationFrame(renderLoop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('resize', updateDimensions)
      observer.disconnect()
      bgR?.dispose()
      hvR?.dispose()
    }
  }, [])

  // ── Handlers ────────────────────────────────────────────────
  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const handleSendChat = async (promptText) => {
    const textToSend = promptText || chatInput
    if (!textToSend.trim()) return

    const userMsg = { role: 'user', content: textToSend.trim() }
    const updatedMessages = [...chatMessages, userMsg]
    setChatMessages(updatedMessages)
    setChatInput('')
    setIsChatLoading(true)

    try {
      const data = await post('/api/chat/', { messages: updatedMessages })
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      addHistory(`Rogveda AI: ${userMsg.content.slice(0, 24)}...`)
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error communicating with AI: ${err.message || 'Check backend status.'}` },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  const initials = user
    ? user.display_name
        ?.split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'PG'
    : 'PG'

  if (error) {
    return (
      <div className="home-root flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-[rgba(3,25,29,0.9)] border border-red-500/30 rounded-2xl max-w-md">
          <p className="text-red-400 font-semibold mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-[#00F5E9] text-[#020D10] font-bold rounded-lg cursor-pointer hover:bg-white transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-root">
      {/* 3D Background Canvas */}
      <canvas ref={bgCanvasRef} id="bg" aria-hidden="true" />
      <div className="mask" aria-hidden="true" />

      <div className="page">
        {/* ── Header ── */}
        <header className="top">
          <div className="brand" onClick={() => navigate('/home')}>
            <img src="/rogveda_logo.png" alt="Rogveda Logo" className="brand-logo-img" />
          </div>

          <nav className="nav" aria-label="Primary navigation">
            <a
              href="/about"
              className={location.pathname === '/about' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                navigate('/about')
              }}
            >
              About
            </a>
            <a
              href="/features"
              className={location.pathname === '/features' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                navigate('/features')
              }}
            >
              Features
            </a>
            <a
              href="/experiments"
              className={location.pathname === '/experiments' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                navigate('/experiments')
              }}
            >
              Experiments
            </a>
            <a
              href="/contact"
              className={location.pathname === '/contact' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                navigate('/contact')
              }}
            >
              Contact
            </a>
            <a
              href="/tutorial"
              className={location.pathname === '/tutorial' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                setShowOnboarding(true)
              }}
            >
              Tutorial{' '}
              <span className="q" aria-hidden="true">
                ?
              </span>
            </a>
          </nav>

          <div className="right">
            {/* History Button & Popover */}
            <div className="relative">
              <button
                className={`ib ${historyOpen ? 'active' : ''}`}
                type="button"
                aria-label="Activity History"
                title="Activity History"
                onClick={() => {
                  setHistoryOpen(!historyOpen)
                  setNotificationsOpen(false)
                  setAccountOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </button>

              {historyOpen && (
                <div className="dropdown-popover history">
                  <div className="px-4 py-3 border-b border-[#00F5E9]/20 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00F5E9]">Activity History</span>
                    <span className="text-[10px] text-[#8BA8AA]">{history.length} logged</span>
                  </div>
                  <div className="overflow-y-auto max-h-[280px] p-2 flex flex-col gap-1">
                    {history.length === 0 ? (
                      <div className="text-center py-6 text-sm text-[#8BA8AA]">No recorded activity</div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          className="px-3 py-2 rounded-lg bg-[rgba(0,245,233,0.03)] hover:bg-[rgba(0,245,233,0.08)] transition-colors"
                        >
                          <div className="text-sm font-medium text-[#E9FFFF] truncate">{item.label}</div>
                          <div className="text-[10px] text-[#8BA8AA] mt-0.5">
                            {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Button & Popover */}
            <div className="relative">
              <button
                className={`ib ${notifications.some((n) => !n.read) ? 'dot' : ''} ${notificationsOpen ? 'active' : ''}`}
                type="button"
                aria-label="Notifications"
                title="Notifications"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen)
                  setHistoryOpen(false)
                  setAccountOpen(false)
                  if (!notificationsOpen) markNotificationsRead()
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" />
                </svg>
              </button>

              {notificationsOpen && (
                <div className="dropdown-popover notifications">
                  <div className="px-4 py-3 border-b border-[#00F5E9]/20 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00F5E9]">Notifications</span>
                    {notifications.filter((n) => !n.read).length > 0 && (
                      <span className="bg-[#00F5E9]/20 text-[#00F5E9] px-2 py-0.5 rounded-full text-[9px] font-bold">
                        {notifications.filter((n) => !n.read).length} NEW
                      </span>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-[300px] p-2 flex flex-col gap-1.5">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-sm text-[#8BA8AA]">No notifications</div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-[rgba(0,245,233,0.04)] border border-[rgba(0,245,233,0.1)] hover:bg-[rgba(0,245,233,0.08)] transition-colors"
                        >
                          <div className="text-sm font-semibold text-white mb-0.5">{item.title}</div>
                          <div className="text-xs text-[#8BA8AA] leading-relaxed">{item.message}</div>
                          <div className="text-[10px] text-[#00CFC8] mt-1.5 font-mono">
                            {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Account Profile Button & Popover */}
            <div className="relative">
              <button
                className={`me ${accountOpen ? 'active' : ''}`}
                type="button"
                aria-label="Account menu"
                onClick={() => {
                  setAccountOpen(!accountOpen)
                  setHistoryOpen(false)
                  setNotificationsOpen(false)
                }}
              >
                <span className="pg">{initials}</span>
                <span>Hi, {user?.display_name?.split(' ')[0] || 'Researcher'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 9l7 7 7-7" />
                </svg>
              </button>

              {accountOpen && (
                <div className="dropdown-popover account">
                  <div className="px-4 py-3 border-b border-[#00F5E9]/15">
                    <div className="text-xs font-bold text-white truncate">{user?.display_name || 'Researcher'}</div>
                    <div className="text-[11px] text-[#8BA8AA] truncate">{user?.email || 'user@rogveda.local'}</div>
                  </div>
                  <div className="p-1.5 flex flex-col">
                    <button
                      onClick={() => navigate('/draw?tab=Draw')}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-[#E9FFFF] hover:bg-[#00F5E9]/10 rounded-md transition-colors border-none bg-transparent cursor-pointer flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00F5E9" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Open Workspace
                    </button>
                    <button
                      onClick={() => navigate('/experiments')}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-[#E9FFFF] hover:bg-[#00F5E9]/10 rounded-md transition-colors border-none bg-transparent cursor-pointer flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00F5E9" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      Saved Experiments
                    </button>
                    <button
                      onClick={() => navigate('/documents')}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-[#E9FFFF] hover:bg-[#00F5E9]/10 rounded-md transition-colors border-none bg-transparent cursor-pointer flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00F5E9" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Saved Documents
                    </button>
                    <div className="h-px bg-[#00F5E9]/15 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/15 rounded-md transition-colors border-none bg-transparent cursor-pointer flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Floating Quotes ── */}
        <aside className="quote q1">
          <span>Analyze Molecules.</span>
          <span>Generate Insights.</span>
          <span>Drive Discovery.</span>
        </aside>

        {/* ── Main Stage ── */}
        <main className="wrap">
          <div className="stage" id="stage">
            {/* Top Offline-First Pill */}
            <div className="pill">
              <svg viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {isOnline ? 'Offline-First' : 'Offline Mode'}
            </div>

            {/* Central Spoke Lines SVG */}
            <svg className="spokes" id="spokes" viewBox="0 0 960 660" aria-hidden="true">
              {TOOLS.map((tool, i) => {
                const a = (tool.angle * Math.PI) / 180
                const c = Math.cos(a)
                const s = Math.sin(a)
                const x1 = CX + 118 * c
                const y1 = CY + 118 * s
                const x2 = CX + (D - 52) * c
                const y2 = CY + (D - 52) * s
                const isHovered = hoverIndex === i

                return (
                  <g key={`spoke-${tool.id}`}>
                    <line
                      className={`sp ${isHovered ? 'on' : ''}`}
                      id={`sp${i}`}
                      x1={x1.toFixed(1)}
                      y1={y1.toFixed(1)}
                      x2={x2.toFixed(1)}
                      y2={y2.toFixed(1)}
                    />
                    <line
                      className="pu"
                      style={{ animationDelay: `${-i * 0.55}s` }}
                      x1={x1.toFixed(1)}
                      y1={y1.toFixed(1)}
                      x2={x2.toFixed(1)}
                      y2={y2.toFixed(1)}
                    />
                  </g>
                )
              })}
            </svg>

            {/* Central Hub with Spinning 3D Molecule */}
            <a
              className="hub"
              href="/draw?tab=Draw&new=true"
              id="hub"
              onClick={(e) => {
                e.preventDefault()
                navigate('/draw?tab=Draw&new=true')
              }}
              onPointerEnter={() => setHoverHub(true)}
              onPointerLeave={() => setHoverHub(false)}
              onFocus={() => setHoverHub(true)}
              onBlur={() => setHoverHub(false)}
              title="Draw Molecule — Start your research here"
            >
              <div className="card">
                <canvas ref={hvCanvasRef} id="hv" aria-label="Rotating demo molecule" />
                <div className="alt">
                  <svg viewBox="0 0 24 24">
                    <circle cx="6" cy="8" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="7" r="2" />
                    <circle cx="12" cy="19" r="2" />
                    <path d="M7.5 9l3 2M13.7 11l3-3M12 14v3" />
                  </svg>
                </div>
              </div>
              <strong>Draw Molecule</strong>
              <small>Start your research here</small>
            </a>

            {/* 6 Outer Feature Nodes */}
            {TOOLS.map((tool, i) => {
              const a = (tool.angle * Math.PI) / 180
              const x = CX + D * Math.cos(a)
              const y = CY + D * Math.sin(a)

              return (
                <a
                  key={tool.id}
                  className={`node ${tool.align}`}
                  href={tool.route}
                  style={{
                    '--x': x.toFixed(1),
                    '--y': y.toFixed(1),
                    '--w': `${tool.width}px`,
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(tool.route)
                  }}
                  onPointerEnter={() => setHoverIndex(i)}
                  onPointerLeave={() => setHoverIndex(null)}
                  onFocus={() => setHoverIndex(i)}
                  onBlur={() => setHoverIndex(null)}
                >
                  <span className="ring">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={tool.iconPath} />
                    </svg>
                  </span>
                  <span className="lab">
                    <b>{tool.title}</b>
                    <span>{tool.desc}</span>
                  </span>
                </a>
              )
            })}

            {/* Onboarding Guidance Tooltip */}
            {showOnboarding && (
              <div
                className="absolute z-50 flex flex-col pointer-events-auto"
                style={{
                  top: '190px',
                  right: '18px',
                  width: '260px',
                  background: 'rgba(3, 25, 29, 0.98)',
                  border: '1.5px solid #00F5E9',
                  borderRadius: '14px',
                  padding: '18px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 24px rgba(0,245,233,0.3)',
                  backdropFilter: 'blur(12px)',
                  animation: 'fade-in-up 0.4s ease-out',
                }}
              >
                <h4 className="text-white m-0 mb-2 font-bold flex items-center gap-2 text-sm">
                  <span style={{ color: '#00F5E9' }}>✨</span> Welcome to Rogveda
                </h4>
                <p className="m-0 mb-4 text-[#cfe9ea] text-xs leading-relaxed">
                  Start by clicking <b>Draw Molecule</b> to sketch a chemical structure or select any module around the hub to run AI predictions and screening.
                </p>
                <button
                  onClick={() => {
                    localStorage.setItem('rogveda_onboarding_seen', 'true')
                    setShowOnboarding(false)
                    showToast('Ready for discovery!')
                  }}
                  className="bg-[#00F5E9] text-[#020D10] font-bold py-1.5 px-4 rounded-lg transition-colors hover:bg-white border-none cursor-pointer text-xs self-start"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </main>

        {/* ── Bottom Quote ── */}
        <aside className="quote q2">
          <span>Discover Molecules.</span>
          <span>Decode Possibilities.</span>
        </aside>

        {/* ── Research Statistics Bar (100% Dynamic) ── */}
        <footer className="stats" aria-label="Research statistics">
          <div>
            <b>
              <AnimatedNumber value={stats?.total_experiments ?? experiments.length ?? 0} />
            </b>
            <span>Experiments</span>
          </div>
          <div>
            <b>
              <AnimatedNumber value={stats?.saved_documents ?? 0} />
            </b>
            <span>Documents</span>
          </div>
          <div>
            <b>
              {stats?.reference_molecules ? `${Number(stats.reference_molecules).toLocaleString()}+` : <AnimatedNumber value={0} />}
            </b>
            <span>References</span>
          </div>
        </footer>
      </div>

      {/* ── Floating Assistant Bot with Smooth Slide-In ── */}
      <button
        className="bot-fab"
        type="button"
        aria-label="Ask Rogveda"
        style={{
          maxWidth: isBotExpanded ? '190px' : '56px',
        }}
        onMouseEnter={() => setIsBotExpanded(true)}
        onMouseLeave={() => setIsBotExpanded(false)}
        onFocus={() => setIsBotExpanded(true)}
        onBlur={() => setIsBotExpanded(false)}
        onClick={() => setIsChatOpen(!isChatOpen)}
      >
        <div className="bot-icon-wrapper">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="9" width="14" height="10" rx="3" />
            <path d="M12 9V6M12 4v.01M9.5 14v.01M14.5 14v.01M3 13v2M21 13v2" />
          </svg>
        </div>
        <span
          className="bot-text-label"
          style={{
            opacity: isBotExpanded ? 1 : 0,
            transform: isBotExpanded ? 'translateX(0)' : 'translateX(10px)',
            transitionDelay: isBotExpanded ? '0.08s' : '0s',
          }}
        >
          Ask Rogveda
        </span>
      </button>

      {/* ── Rogveda AI Chat Modal / Drawer ── */}
      {isChatOpen && (
        <div
          className="fixed flex flex-col rounded-2xl overflow-hidden"
          style={{
            bottom: '100px',
            right: '28px',
            width: 'clamp(320px, 90vw, 420px)',
            height: '540px',
            background: 'rgba(3, 25, 29, 0.98)',
            border: '1.5px solid rgba(0, 245, 233, 0.4)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 30px rgba(0,245,233,0.25)',
            zIndex: 65,
            backdropFilter: 'blur(20px)',
            animation: 'fade-in-up 0.3s ease-out both',
          }}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[rgba(2,13,16,0.95)] border-b border-[#00F5E9]/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00F5E9]/15 border border-[#00F5E9] flex items-center justify-center text-[#00F5E9]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="9" width="14" height="10" rx="3" />
                  <path d="M12 9V6M12 4v.01M9.5 14v.01M14.5 14v.01M3 13v2M21 13v2" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white m-0">Rogveda AI Assistant</h3>
                <span className="text-[11px] text-[#00CFC8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5E9] inline-block animate-pulse" />
                  Chemistry Intelligence
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-[#8BA8AA] hover:text-white bg-transparent border-none cursor-pointer text-lg p-1 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Quick prompt chips */}
          <div className="px-4 py-2 bg-[rgba(0,59,64,0.3)] border-b border-[#00F5E9]/10 flex gap-1.5 overflow-x-auto scrollbar-none">
            {[
              'Explain QSAR models',
              'Lipinski Rule of 5',
              'How to screen 500 molecules?',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendChat(chip)}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] bg-[rgba(0,245,233,0.08)] hover:bg-[rgba(0,245,233,0.18)] text-[#E9FFFF] border border-[rgba(0,245,233,0.25)] rounded-full transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-xl max-w-[88%] px-4 py-3 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[rgba(0,245,233,0.15)] text-[#E9FFFF] border border-[rgba(0,245,233,0.35)]'
                      : 'bg-[rgba(255,255,255,0.05)] text-[#cfe9ea] border border-white/10'
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-2.5 bg-[rgba(255,255,255,0.05)] text-[#8BA8AA] text-xs flex items-center gap-2 border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-[#00F5E9] animate-ping" />
                  Generating molecular insights...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-[rgba(2,13,16,0.95)] border-t border-[#00F5E9]/20">
            <div className="flex items-center rounded-full bg-[rgba(0,0,0,0.4)] border border-[#00F5E9]/30 pl-4 pr-1.5 py-1 focus-within:border-[#00F5E9] transition-colors">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about molecules, descriptors, or drugs..."
                className="flex-1 bg-transparent border-none outline-none text-[#E9FFFF] text-xs placeholder-[#8BA8AA]"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                className="w-8 h-8 rounded-full bg-[#00F5E9] text-[#020D10] font-bold flex items-center justify-center cursor-pointer hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed border-none ml-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Toast ── */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </div>
  )
}
