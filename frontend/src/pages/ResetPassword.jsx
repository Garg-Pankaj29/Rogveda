import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import { post } from '../lib/apiClient.js'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.')
    }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await post('/api/auth/reset-password', { token, new_password: newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'Something went wrong. The token might have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout navAction="login">
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

        {/* ── Form header ───────────────────────────────────── */}
        <motion.div custom={2} variants={fadeUp} style={{ marginBottom: '8px' }}>
          <h2
            className="text-[28px] text-white"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', marginBottom: '8px' }}
          >
            Reset Password
          </h2>
        </motion.div>
        <motion.div custom={3} variants={fadeUp} style={{ marginBottom: '32px' }}>
          <p className="text-[13px] text-white/40">Choose a new password for your account</p>
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

        {/* ── Success view ──────────────────────────────────── */}
        {success ? (
          <motion.div custom={4} variants={fadeUp} className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(45, 212, 191, 0.1)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-white mb-2 font-bold text-lg">
              Password Reset Successfully
            </p>
            <p className="text-white/50 text-sm">
              Redirecting you to login...
            </p>
          </motion.div>
        ) : (
          /* ── Form ──────────────────────────────────────────── */
          <motion.form custom={4} variants={fadeUp} onSubmit={handleSubmit}>
            {/* New Password */}
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                required
                disabled={!token}
                className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30 disabled:opacity-50"
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

            {/* Confirm Password */}
            <div className="relative group" style={{ marginBottom: '24px' }}>
              <div
                className="absolute text-white/25 group-focus-within:text-[#2dd4bf] transition-colors"
                style={{ left: '20px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                required
                disabled={!token}
                className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30 disabled:opacity-50"
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

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || !token}
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
                'Save Password'
              )}
            </motion.button>
            
            <div className="text-center mt-6">
              <Link to="/login" className="text-[12px] text-white/50 hover:text-white transition-colors">
                Cancel
              </Link>
            </div>
          </motion.form>
        )}
      </motion.div>
    </AuthLayout>
  )
}
