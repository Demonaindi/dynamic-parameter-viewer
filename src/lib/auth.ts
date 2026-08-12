const AUTH_KEY = 'tpv-web-auth'

export function isElectronApp(): boolean {
  return navigator.userAgent.toLowerCase().includes('electron')
}

export function isWebApp(): boolean {
  return !isElectronApp()
}

export function isAuthenticated(): boolean {
  if (isElectronApp()) return true
  try {
    return sessionStorage.getItem(AUTH_KEY) === 'ok'
  } catch {
    return false
  }
}

export function loginWithPassword(password: string): boolean {
  if (password !== 'texa1236') return false
  try {
    sessionStorage.setItem(AUTH_KEY, 'ok')
  } catch {
    /* ignore */
  }
  return true
}

export function logout(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}
