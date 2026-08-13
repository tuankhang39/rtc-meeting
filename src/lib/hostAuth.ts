/** Client-side host gate (demo). Not secure against determined users. */
const HOST_USER = 'admin'
const HOST_PASS = '110422'
const STORAGE_KEY = 'rtc-host'

function hostStore(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export function isHostLoggedIn() {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return true
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
      localStorage.setItem(STORAGE_KEY, '1')
      sessionStorage.removeItem(STORAGE_KEY)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function loginHost(username: string, password: string) {
  if (username.trim() === HOST_USER && password === HOST_PASS) {
    hostStore()?.setItem(STORAGE_KEY, '1')
    return true
  }
  return false
}

export function logoutHost() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
