import { Navigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Loading, useLoad } from '../components/ui.jsx'

/** Asks the API which tab a sentence belongs in, then sends the person there. */
export default function SearchRouter() {
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [st] = useLoad(() => api('/search', { params: { q } }), [q])
  if (!q) return <Navigate to="/" replace />
  if (st.loading || st.error) return <Loading state={st} />
  const enc = encodeURIComponent(q)
  const to = { care: `/care/results?q=${enc}`, people: `/people?q=${enc}`, voice: `/voice?q=${enc}` }[st.data.route]
  return <Navigate to={to} replace />
}
