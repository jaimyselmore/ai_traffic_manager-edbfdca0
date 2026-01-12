/**
 * API Client
 *
 * Dit bestand bevat helper functies voor alle API calls naar de backend.
 * Alle requests gebruiken automatisch de JWT token voor authenticatie.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Haal JWT token op uit localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

/**
 * Maak headers met authenticatie
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  }
}

/**
 * Generic API call helper
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: 'GET' })
}

/**
 * POST request
 */
export async function post<T>(endpoint: string, data?: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PUT request
 */
export async function put<T>(endpoint: string, data: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * PATCH request
 */
export async function patch<T>(endpoint: string, data: any): Promise<T> {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * DELETE request
 */
export async function del<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: 'DELETE' })
}

/**
 * Check of user is ingelogd
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

/**
 * Sla auth token op
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token)
}

/**
 * Verwijder auth token (logout)
 */
export function clearAuthToken(): void {
  localStorage.removeItem('auth_token')
}
