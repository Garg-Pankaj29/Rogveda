/**
 * ROGVEDA — API Client
 *
 * Fetch wrapper hardcoded to localhost backend (127.0.0.1:8000).
 * No external DNS calls at runtime (docs/04_RULES.md §2).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const TOKEN_KEY = 'rogveda_token'

/** Store the JWT */
export function setToken(token, remember = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
  }
}

/** Retrieve the stored JWT */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

/** Remove the stored JWT (logout) */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

/** Check if a token exists */
export function isAuthenticated() {
  return !!getToken()
}

/**
 * Core fetch wrapper — attaches auth header if token exists,
 * sets JSON content type, handles error responses.
 */
async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.detail || `Request failed: ${res.status}`)
    error.status = res.status
    error.body = body
    throw error
  }

  return res.json()
}

/** GET request */
export function get(path) {
  return request(path, { method: 'GET' })
}

/** POST request with JSON body */
export function post(path, data, extraOptions = {}) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(data),
    ...extraOptions,
  })
}

/** PATCH request with JSON body */
export function patch(path, data) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/** DELETE request */
export function del(path) {
  return request(path, { method: 'DELETE' })
}

/** Upload a file via multipart form data (no JSON Content-Type) */
export async function upload(path, formData) {
  const token = getToken()
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.detail || `Request failed: ${res.status}`)
    error.status = res.status
    error.body = body
    throw error
  }

  return res.json()
}

export default { get, post, patch, delete: del, upload, setToken, getToken, clearToken, isAuthenticated }
