/**
 * ROGVEDA — Login Page
 *
 * Right-panel form inside AuthLayout.
 * Matches the spec exactly: logo wordmark, tagline, form fields, button.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import { post, setToken, isAuthenticated } from '../lib/apiClient.js'



/* ── Fade-in animation wrapper ───────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(() => localStorage.getItem('rogveda_remembered_email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('rogveda_remembered_email'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/home')
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await post('/api/auth/login', { email, password })
      setToken(data.access_token, rememberMe)
      if (rememberMe) {
        localStorage.setItem('rogveda_remembered_email', email)
      } else {
        localStorage.removeItem('rogveda_remembered_email')
      }
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout navAction="signup">
      <motion.div initial="hidden" animate="visible">
        {/* ── Logo ──────────────────────────────────────────── */}
        <motion.div custom={0} variants={fadeUp} style={{ marginBottom: '12px' }}>
          <img
            src="/rogveda_logo.png"
            alt="ROGVEDA"
            style={{
              maxWidth: '420px',
              width: '100%',
              height: 'auto',
              display: 'block',
              mixBlendMode: 'screen',
              background: 'transparent !important',
              filter: 'drop-shadow(0 0 16px rgba(45, 212, 191, 0.15))',
            }}
            draggable={false}
          />
        </motion.div>

        <motion.div custom={1} variants={fadeUp}>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#2dd4bf', marginBottom: '24px' }} />
        </motion.div>

        {/* ── Tagline ───────────────────────────────────────── */}
        <motion.p
          custom={2}
          variants={fadeUp}
          className="italic"
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '17px',
            color: '#5eead4',
            marginBottom: '40px',
          }}
        >
          Analyze Molecules. Generate Insights. Drive Discovery.
        </motion.p>

        {/* ── Form header ───────────────────────────────────── */}
        <motion.div custom={3} variants={fadeUp} style={{ marginBottom: '8px' }}>
          <h2
            className="text-[28px] text-white"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', marginBottom: '8px' }}
          >
            Welcome back
          </h2>
        </motion.div>
        <motion.div custom={3} variants={fadeUp} style={{ marginBottom: '32px' }}>
          <p className="text-[13px] text-white/40">Sign in to continue</p>
        </motion.div>

        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
            style={{
              background: 'rgba(192, 80, 80, 0.12)',
              border: '1px solid rgba(192, 80, 80, 0.3)',
              color: '#f87171',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Form ──────────────────────────────────────────── */}
        <motion.form custom={4} variants={fadeUp} onSubmit={handleSubmit}>
          {/* Email */}
          <div className="relative group" style={{ marginBottom: '16px' }}>
            <div
              className="absolute text-white/25 group-focus-within:text-[#2dd4bf] transition-colors"
              style={{ left: '20px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30"
              style={{
                height: '56px',
                paddingLeft: '48px',
                paddingRight: '16px',
                borderRadius: '10px',
                background: '#0f1a19',
                border: '1px solid #1f3a37',
              }}
            />
          </div>

          {/* Password */}
          <div className="relative group" style={{ marginBottom: '16px' }}>
            <div
              className="absolute text-white/25 group-focus-within:text-[#2dd4bf] transition-colors"
              style={{ left: '20px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30"
              style={{
                height: '56px',
                paddingLeft: '48px',
                paddingRight: '56px',
                borderRadius: '10px',
                background: '#0f1a19',
                border: '1px solid #1f3a37',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute text-white/25 hover:text-[#2dd4bf] transition-colors"
              style={{ right: '20px', top: '50%', transform: 'translateY(-50%)' }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Remember / Forgot */}
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center peer-checked:bg-[#2dd4bf] peer-checked:border-[#2dd4bf] transition-all">
                {rememberMe && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#071211" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                  </svg>
                )}
              </div>
              <span className="text-[12px] text-white/40">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-[12px] text-[#2dd4bf] hover:underline transition-all"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
            whileTap={{ scale: 0.99 }}
            className="w-full font-bold uppercase text-white flex items-center justify-center disabled:opacity-50 cursor-pointer"
            style={{
              height: '56px',
              borderRadius: '10px',
              letterSpacing: '0.1em',
              fontSize: '13px',
              background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Login
                <span style={{ marginLeft: '12px', fontSize: '16px' }}>→</span>
              </>
            )}
          </motion.button>
        </motion.form>
      </motion.div>
    </AuthLayout>
  )
}
