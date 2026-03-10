const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL =
  rawApiBaseUrl || "https://chat-training-api.onrender.com"

function isPrivateHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

function rebaseUrl(urlLike, nextProtocol) {
  const currentUrl = new URL(urlLike)
  const apiUrl = new URL(API_BASE_URL)
  const shouldRebaseHost = currentUrl.host !== apiUrl.host && isPrivateHostname(currentUrl.hostname)

  if (shouldRebaseHost) {
    currentUrl.host = apiUrl.host
  }

  if (nextProtocol) {
    currentUrl.protocol = nextProtocol
  }

  return currentUrl.toString()
}

export function resolveHttpUrl(path) {
  if (!path) return null

  if (path.startsWith("http://") || path.startsWith("https://")) {
    const apiUrl = new URL(API_BASE_URL)
    const nextProtocol = apiUrl.protocol === "https:" ? "https:" : undefined
    return rebaseUrl(path, nextProtocol)
  }

  return new URL(path, API_BASE_URL).toString()
}

export function resolveWsUrl(path) {
  if (!path) return null

  if (path.startsWith("ws://") || path.startsWith("wss://")) {
    const apiUrl = new URL(API_BASE_URL)
    const nextProtocol = apiUrl.protocol === "https:" || window.location.protocol === "https:"
      ? "wss:"
      : undefined
    return rebaseUrl(path, nextProtocol)
  }

  const apiUrl = new URL(API_BASE_URL)
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
  const wsBaseUrl = `${wsProtocol}//${apiUrl.host}`

  return new URL(path, wsBaseUrl).toString()
}
