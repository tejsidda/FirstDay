export const GUEST_COOKIE_NAME = "fdfs_guest"
export const GUEST_COOKIE_VALUE = "1"
export const GUEST_COOKIE_MAX_AGE = 86400

const SESSION_DELTA_KEY = "fdfs_guest_delta"
const DEMO_SETUP_KEY = "fdfs_demo_setup"

export function isGuestMode(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie
    .split("; ")
    .some((c) => c === `${GUEST_COOKIE_NAME}=${GUEST_COOKIE_VALUE}`)
}

/** Owner curating the published demo (signed-in + set up demo). */
export function isDemoSetupMode(): boolean {
  if (typeof sessionStorage === "undefined") return false
  return isGuestMode() && sessionStorage.getItem(DEMO_SETUP_KEY) === "1"
}

export function enterGuestMode(): void {
  if (typeof document === "undefined") return
  sessionStorage.removeItem(SESSION_DELTA_KEY)
  sessionStorage.removeItem(DEMO_SETUP_KEY)
  document.cookie = `${GUEST_COOKIE_NAME}=${GUEST_COOKIE_VALUE}; path=/; max-age=${GUEST_COOKIE_MAX_AGE}; SameSite=Lax`
}

/** Enter guest mode to curate the portfolio demo while signed in. */
export function enterGuestSetupMode(): void {
  if (typeof document === "undefined") return
  sessionStorage.removeItem(SESSION_DELTA_KEY)
  sessionStorage.setItem(DEMO_SETUP_KEY, "1")
  document.cookie = `${GUEST_COOKIE_NAME}=${GUEST_COOKIE_VALUE}; path=/; max-age=${GUEST_COOKIE_MAX_AGE}; SameSite=Lax`
}

export function exitGuestMode(): void {
  if (typeof document === "undefined") return
  sessionStorage.removeItem(SESSION_DELTA_KEY)
  sessionStorage.removeItem(DEMO_SETUP_KEY)
  document.cookie = `${GUEST_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}
