// Tiny fetch wrapper: adds the login token and turns API errors into readable messages.
const KEY = 'mhd_token'

// Preview build (npm run build:demo) answers API calls inside the browser instead of using a server.
async function transport(url, init) {
  if (import.meta.env.VITE_DEMO) {
    const m = await import('./demo/mockApi.js')
    return m.demoFetch(url, init)
  }
  return fetch(url, init)
}

export const getToken = () => {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* private mode */ }
}

function messageFrom(body, status) {
  const d = body && body.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length) {
    const first = d[0]
    const field = (first.loc || []).filter((x) => x !== 'body').join(' ')
    return field ? `${field}: ${first.msg}` : first.msg
  }
  return `Something went wrong (${status})`
}

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = '/api' + path
  if (params) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
      else if (v !== undefined && v !== null && v !== '') qs.append(k, v)
    })
    const s = qs.toString()
    if (s) url += '?' + s
  }
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await transport(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(messageFrom(data, res.status))
    err.status = res.status
    throw err
  }
  return data
}
