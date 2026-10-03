import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { clearToken } from '../lib/apiClient.js'
import { addHistory, getHistory, getNotifications, markNotificationsRead } from '../lib/events.js'

export function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8aafaf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8aafaf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aafaf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function TopNav({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [notifications, setNotifications] = useState([])
  
  // Load initial data
  useEffect(() => {
    setHistory(getHistory())
    
    const initialNotifs = getNotifications()
    if (initialNotifs.length === 0) {
      // Add a welcome notification if empty
      const welcome = {
        id: 'welcome-1',
        title: 'Welcome to Rogveda!',
        message: 'Your molecular workspace is ready. Start by drawing a molecule or creating a new experiment.',
        time: new Date().toISOString(),
        read: false
      }
      localStorage.setItem('rogveda_notifications', JSON.stringify([welcome]))
      setNotifications([welcome])
    } else {
      setNotifications(initialNotifs)
    }
  }, [])

  // Listen to cross-component updates
  useEffect(() => {
    const handleHistory = () => setHistory(getHistory())
    const handleNotifs = () => setNotifications(getNotifications())
    
    window.addEventListener('rogveda_history_updated', handleHistory)
    window.addEventListener('rogveda_notifications_updated', handleNotifs)
    return () => {
      window.removeEventListener('rogveda_history_updated', handleHistory)
      window.removeEventListener('rogveda_notifications_updated', handleNotifs)
    }
  }, [])

  // Route tracking
  useEffect(() => {
    const pathName = location.pathname
    let label = 'Viewed ' + pathName.replace('/', '').toUpperCase()
    if (pathName === '/') label = 'Viewed DASHBOARD'
    addHistory(label)
  }, [location.pathname])

  const toggleHistory = () => {
    setHistoryOpen(!historyOpen)
    setNotificationsOpen(false)
    setDropdownOpen(false)
  }
  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen)
    setHistoryOpen(false)
    setDropdownOpen(false)
    if (!notificationsOpen) {
      // Mark as read when opened
      markNotificationsRead()
    }
  }
  const toggleUserDropdown = () => {
    setDropdownOpen(!dropdownOpen)
    setHistoryOpen(false)
    setNotificationsOpen(false)
  }
  const initials = user
    ? user.display_name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  const navLinks = ['About', 'Features', 'Experiments', 'Contact', 'Tutorial']

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-3"
      style={{
        background: 'rgba(5, 13, 15, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(45,212,212,0.08)',
        zIndex: 50,
      }}
    >
      {/* Left: Logo */}
      <div 
        className="flex items-center gap-2.5 cursor-pointer" 
        style={{ flexBasis: '30%', paddingLeft: '40px' }}
        onClick={() => navigate('/')}
      >
        <img src="/rogveda_logo.png" alt="Rogveda Logo" style={{ height: '56px' }} />
      </div>

      {/* Center: Nav Links */}
      <div className="flex items-center justify-center gap-10" style={{ flexBasis: '45%' }}>
        {navLinks.map(link => {
          const isActive = location.pathname === `/${link.toLowerCase()}`
          const isTutorial = link === 'Tutorial'
          return (
          <div key={link} className="relative flex items-center">
            <button
              onClick={() => navigate(`/${link.toLowerCase()}`)}
              className="uppercase font-medium bg-transparent border-none cursor-pointer transition-colors duration-200"
              style={{ 
                fontSize: '12px', 
                letterSpacing: '0.15em', 
                color: isActive ? '#ffffff' : '#a0c4c4', 
                padding: '10px 0',
                textShadow: isActive ? '0 0 10px rgba(255,255,255,0.3)' : 'none'
              }}
              onMouseEnter={e => !isActive && (e.target.style.color = '#ffffff')}
              onMouseLeave={e => !isActive && (e.target.style.color = '#a0c4c4')}
            >
              {link}
            </button>
            {isTutorial && (
              <button
                onClick={() => {
                  if (location.pathname !== '/home') {
                    navigate('/home')
                    setTimeout(() => window.dispatchEvent(new Event('rogveda_show_onboarding')), 100)
                  } else {
                    window.dispatchEvent(new Event('rogveda_show_onboarding'))
                  }
                }}
                title="Show tutorial again"
                className="ml-2 items-center justify-center bg-transparent border border-[#2dd4d4] rounded-full cursor-pointer text-[#2dd4d4] hover:bg-[#2dd4d4] hover:text-[#050d0f] transition-colors"
                style={{ 
                  display: 'flex',
                  width: '18px', height: '18px', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 
                }}
              >
                ?
              </button>
            )}
          </div>
        )})}
      </div>

      {/* Right: Icons + User */}
      <div className="flex items-center justify-end gap-5" style={{ flexBasis: '30%' }}>
        <div className="relative">
          <button 
            onClick={toggleHistory}
            className={`bg-transparent border-none cursor-pointer transition-transform hover:scale-110 flex items-center justify-center ${historyOpen ? 'text-[#2dd4d4]' : 'text-[#8aafaf] hover:text-[#2dd4d4]'}`}
            title="Activity History"
          >
            <HistoryIcon />
          </button>
          
          {historyOpen && (
            <div
              className="absolute right-0 mt-3 py-3 w-64 rounded-xl shadow-2xl flex flex-col max-h-[300px] overflow-hidden"
              style={{ background: 'rgba(10, 24, 26, 0.98)', border: '1px solid rgba(45,212,212,0.2)', backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 pb-2 border-b border-[rgba(45,212,212,0.1)] mb-2 text-[#a0c4c4] text-xs font-bold uppercase tracking-widest">
                Activity History
              </div>
              <div className="overflow-y-auto px-2 flex-1">
                {history.length === 0 ? (
                  <div className="text-center text-[#5a8080] text-xs py-4">No recent activity</div>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="py-2 px-2 hover:bg-[rgba(45,212,212,0.05)] rounded-lg transition-colors mb-1">
                      <div className="text-[#c0dede] text-sm truncate">{item.label}</div>
                      <div className="text-[#5a8080] text-[10px] mt-0.5">{new Date(item.time).toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={toggleNotifications}
            className={`bg-transparent border-none cursor-pointer transition-transform hover:scale-110 flex items-center justify-center relative ${notificationsOpen ? 'text-[#2dd4d4]' : 'text-[#8aafaf] hover:text-[#2dd4d4]'}`}
            title="Notifications"
          >
            <BellIcon />
            {notifications.some(n => !n.read) && (
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#2dd4d4] shadow-[0_0_8px_#2dd4d4]"></div>
            )}
          </button>
          
          {notificationsOpen && (
            <div
              className="absolute right-0 mt-3 py-3 w-72 rounded-xl shadow-2xl flex flex-col max-h-[300px] overflow-hidden"
              style={{ background: 'rgba(10, 24, 26, 0.98)', border: '1px solid rgba(45,212,212,0.2)', backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 pb-2 border-b border-[rgba(45,212,212,0.1)] mb-2 text-[#a0c4c4] text-xs font-bold uppercase tracking-widest flex justify-between">
                <span>Notifications</span>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="bg-[rgba(45,212,212,0.2)] text-[#2dd4d4] px-1.5 py-0.5 rounded text-[9px]">
                    {notifications.filter(n => !n.read).length} NEW
                  </span>
                )}
              </div>
              <div className="px-2 overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="text-center text-[#5a8080] text-xs py-4">No notifications</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="py-2 px-3 mb-2 bg-[rgba(45,212,212,0.05)] rounded-lg border border-[rgba(45,212,212,0.1)] transition-colors hover:bg-[rgba(45,212,212,0.08)]">
                      <div className="text-white text-sm font-medium mb-1">{notif.title}</div>
                      <div className="text-[#8aafaf] text-xs leading-relaxed">
                        {notif.message}
                      </div>
                      <div className="text-[#5a8080] text-[10px] mt-2">
                        {new Date(notif.time).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar with Dropdown */}
        <div className="relative">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleUserDropdown}
          >
            <div
              className="rounded-full flex items-center justify-center font-bold"
              style={{
                width: '36px', height: '36px',
                fontSize: '12px', color: '#2dd4d4',
                background: 'rgba(45,212,212,0.12)',
                border: '1.5px solid rgba(45,212,212,0.4)',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <span style={{ fontSize: '13px', color: '#c0dede', whiteSpace: 'nowrap' }}>
              Hi, {user?.display_name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown />
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 py-2 w-32 rounded-lg shadow-xl"
              style={{ background: 'rgba(10, 24, 26, 0.95)', border: '1px solid rgba(45,212,212,0.2)' }}
            >
              <button
                onClick={handleLogout}
                className="w-full text-left hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
                style={{ color: '#ff4d4d', fontSize: '13px', fontWeight: 'bold', padding: '10px 16px' }}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
