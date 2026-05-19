/** Dispatched on mobile pull-to-refresh. Call `preventDefault()` to handle in-app without reload. */
export const PULL_REFRESH_EVENT = "fdfs:pull-refresh"

export function dispatchPullRefresh() {
  if (typeof window === "undefined") return
  const event = new CustomEvent(PULL_REFRESH_EVENT, { cancelable: true })
  window.dispatchEvent(event)
  if (!event.defaultPrevented) {
    window.location.reload()
  }
}
