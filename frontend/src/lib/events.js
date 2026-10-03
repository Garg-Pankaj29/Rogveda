// Global event dispatchers and local storage managers for History and Notifications

export const addHistory = (label) => {
  try {
    const rawHistory = localStorage.getItem('rogveda_history')
    let currentHistory = rawHistory ? JSON.parse(rawHistory) : []
    const newEntry = { id: Date.now().toString() + Math.random().toString(), label, time: new Date().toISOString() }
    
    // Prevent duplicate consecutive entries
    if (currentHistory.length > 0 && currentHistory[0].label === label) return

    currentHistory.unshift(newEntry)
    if (currentHistory.length > 25) currentHistory = currentHistory.slice(0, 25)
    
    localStorage.setItem('rogveda_history', JSON.stringify(currentHistory))
    window.dispatchEvent(new Event('rogveda_history_updated'))
  } catch (e) {
    console.error('Failed to save history', e)
  }
}

export const getHistory = () => {
  try {
    return JSON.parse(localStorage.getItem('rogveda_history') || '[]')
  } catch {
    return []
  }
}

export const addNotification = (title, message) => {
  try {
    const rawNotifs = localStorage.getItem('rogveda_notifications')
    let notifs = rawNotifs ? JSON.parse(rawNotifs) : []
    const newEntry = { id: Date.now().toString() + Math.random().toString(), title, message, time: new Date().toISOString(), read: false }
    
    notifs.unshift(newEntry)
    if (notifs.length > 15) notifs = notifs.slice(0, 15)
    
    localStorage.setItem('rogveda_notifications', JSON.stringify(notifs))
    window.dispatchEvent(new Event('rogveda_notifications_updated'))
  } catch (e) {
    console.error('Failed to save notification', e)
  }
}

export const getNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem('rogveda_notifications') || '[]')
  } catch {
    return []
  }
}

export const markNotificationsRead = () => {
  try {
    const notifs = getNotifications().map(n => ({ ...n, read: true }))
    localStorage.setItem('rogveda_notifications', JSON.stringify(notifs))
    window.dispatchEvent(new Event('rogveda_notifications_updated'))
  } catch (e) {
    console.error('Failed to mark notifications read', e)
  }
}
