import api from './apiClient'

const LOCAL_STORAGE_KEY = 'rogveda_experiments'

export const experimentService = {
  /**
   * Sync local experiments with backend
   */
  async syncExperiments() {
    try {
      if (!api.isAuthenticated()) return getLocalExperiments()

      // Fetch from backend
      const rawBackendExps = await api.get('/api/experiments/')
      
      // Deduplicate by local_id (id)
      const backendExps = []
      const seenIds = new Set()
      for (const exp of rawBackendExps) {
        if (!seenIds.has(exp.id)) {
          seenIds.add(exp.id)
          backendExps.push(exp)
        }
      }
      
      // Get local experiments
      const localExps = getLocalExperiments()
      
      // Merge logic: Push missing local experiments or newer local modifications
      const backendExpMap = new Map(backendExps.map(e => [e.id, e]))
      const toPush = []
      
      for (const localExp of localExps) {
        const backendExp = backendExpMap.get(localExp.id)
        if (!backendExp) {
          toPush.push(localExp)
        } else {
          const localDate = new Date(localExp.date).getTime()
          const backendDate = new Date(backendExp.date).getTime()
          // If local is strictly newer (e.g., offline edit), push it to backend
          if (localDate > backendDate) {
            toPush.push(localExp)
            // Remove the stale backend record from the array so the updated one takes its place
            const idx = backendExps.findIndex(e => e.id === localExp.id)
            if (idx !== -1) backendExps.splice(idx, 1)
          }
        }
      }
      
      for (const exp of toPush) {
        try {
          // Push to backend (now acts as upsert due to backend changes)
          const saved = await api.post('/api/experiments/', exp)
          backendExps.push(saved)
        } catch (e) {
          console.error("Failed to sync experiment to backend:", e)
        }
      }

      // Update local storage to match synced state
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backendExps))
      return backendExps

    } catch (e) {
      console.error("Experiment sync failed. Using local storage.", e)
      return getLocalExperiments()
    }
  },

  /**
   * Save a new experiment
   */
  async saveExperiment(expData) {
    // Save to local first for instant UI response
    const localExps = getLocalExperiments()
    
    // Check if already exists locally (update case for autosave/overwrite)
    const existingIdx = localExps.findIndex(e => e.id === expData.id)
    if (existingIdx !== -1) {
      localExps[existingIdx] = { ...localExps[existingIdx], ...expData }
    } else {
      localExps.unshift(expData)
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localExps))

    // Async push to backend
    if (api.isAuthenticated()) {
      try {
        await api.post('/api/experiments/', expData)
      } catch (e) {
        console.error("Failed to save experiment to backend:", e)
      }
    }
  },

  /**
   * Delete experiment
   */
  async deleteExperiment(id) {
    // Delete local
    const localExps = getLocalExperiments()
    const remaining = localExps.filter(e => e.id !== id)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining))

    // Delete backend
    if (api.isAuthenticated()) {
      try {
        await api.delete(`/api/experiments/${id}`)
      } catch (e) {
        console.error("Failed to delete experiment on backend:", e)
      }
    }
    return remaining
  },

  async renameExperiment(id, newName) {
    // Update local
    const localExps = getLocalExperiments()
    const updated = localExps.map(e => (e.id === id ? { ...e, name: newName } : e))
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))

    // Update backend
    if (api.isAuthenticated()) {
      try {
        await api.patch(`/api/experiments/${id}`, { name: newName })
      } catch (e) {
        console.error("Failed to rename experiment on backend:", e)
      }
    }
    return updated
  },

  /**
   * Get all experiments locally (fallback)
   */
  getLocalExperiments() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }
}

function getLocalExperiments() {
  return experimentService.getLocalExperiments()
}
