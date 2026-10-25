import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth.jsx'
import App from '../App.jsx'

/** Fake the API: routes is { 'GET /api/me': data | (body)=>data | {status, body} }. */
export function mockApi(routes) {
  const calls = []
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET'
    const path = String(url).split('?')[0]
    calls.push({ method, url: String(url), body: opts.body ? JSON.parse(opts.body) : undefined })
    const hit = routes[`${method} ${path}`]
    if (hit === undefined) return new Response(JSON.stringify({ detail: 'not mocked ' + method + ' ' + path }), { status: 404 })
    const val = typeof hit === 'function' ? hit(opts.body ? JSON.parse(opts.body) : undefined) : hit
    if (val && val.__status) return new Response(JSON.stringify(val.body), { status: val.__status })
    return new Response(JSON.stringify(val), { status: 200 })
  })
  return calls
}
export const fail = (status, detail) => ({ __status: status, body: { detail } })

export const maya = { id: 1, email: 'maya@example.com', name: 'Maya', tagline: '', neighborhood: '', area: 'West', is_admin: false }

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  )
}
