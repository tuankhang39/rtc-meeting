/** Client-side host gate (demo). Not secure against determined users. */
const HOST_USER = 'admin'
const HOST_PASS = '110422'
const STORAGE_KEY = 'rtc-host'

export function isHostLoggedIn() {
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

export function loginHost(username: string, password: string) {
  if (username.trim() === HOST_USER && password === HOST_PASS) {
    sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  }
  return false
}

export function logoutHost() {
  sessionStorage.removeItem(STORAGE_KEY)
}
