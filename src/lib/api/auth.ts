/**
 * Authenticatie API
 *
 * Functies voor login, logout, en gebruiker info ophalen
 */

import { post, get, setAuthToken, clearAuthToken } from './client'

export interface User {
  id: string
  email: string
  naam: string
  rol: string
  is_planner: boolean
}

export interface LoginResponse {
  token: string
  user: User
}

/**
 * Login met email en wachtwoord
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await post<LoginResponse>('/api/auth/login', { email, password })

  // Sla token op in localStorage
  setAuthToken(response.token)

  return response
}

/**
 * Logout (verwijder token)
 */
export function logout(): void {
  clearAuthToken()
}

/**
 * Haal huidige gebruiker info op
 */
export async function getCurrentUser(): Promise<{ user: User }> {
  return get<{ user: User }>('/api/auth/me')
}
