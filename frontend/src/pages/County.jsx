import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Heading, Loading, Sample, useLoad } from '../components/ui.jsx'
import { CAT_LABEL, STEP_LABEL } from './Report.jsx'

const CATS = ['sidewalk', 'program', 'event', 'park', 'trail', 'lighting', 'crossing', 'other']
const STATUSES = ['Seen', 'Planned', 'Fixed']

export default function County() {
  const { user } = useAuth()
  if (!user.is_admin) {
    return (<><Heading title="County dashboard" /><p className="notice" role="alert">County staff only. Sign in with a county account to see this page.</p></>)
  }
  return <Dashboard />
}

function Dashboard() {
  const [st] = useLoad(() => api('/county/pulse'), [])
  const [f, setF] = useState({ title: '', body: '', category: 'sidewalk', set_status: 'Planned' })
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')
  const d = st.data
  const max = d ? Math.max(1, ...d.by_area.map((a) => a.count)) : 1
  const publish = async (e) => {
    e.preventDefault()
    setError('')
    try { setRes(await api('/county/updates', { method: 'POST', body: f })) } catch (x) { setError(x.message) }
  }
  return (
    <>
      <div className="row between wrap"><Heading title="District Pulse" sub="What residents are suggesting and backing. Sample data." /><Sample /></div>
      <Loading state={st} />
      {d && (
        <>
          <div className="grid g3">
            <div className="card"><span className="small mute">Suggestions</span><span className="stat" data-testid="total-reports">{d.total_reports}</span></div>
            <div className="card"><span className="small mute">Still open</span><span className="stat">{d.open_reports}</span></div>
            <div className="card"><span className="small mute">Residents on the app</span><span className="stat">{d.estimated_reach}</span></div>
          </div>
          <div className="grid g2">
            <section className="card" aria-label="Hot spots">
              <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Hot spots by part of the county</b>
              {d.by_area.map((a) => (
                <div key={a.area} className="bar"><span className="name">{a.area}</span>
                  <div className="track"><div className="fill" style={{ width: (100 * a.count / max) + '%', background: a.count === max ? 'var(--clay)' : undefined }} /></div><b>{a.count}</b></div>
              ))}
              <b style={{ fontFamily: 'var(--serif)', fontSize: 17, marginTop: 8 }}>What people suggest</b>
              {d.by_category.map((c) => <div key={c.category} className="row between small"><span>{CAT_LABEL[c.category] || c.category}</span><b>{c.count}</b></div>)}
            </section>
            <form className="card" onSubmit={publish} aria-label="Respond to residents">
              <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Respond to residents</b>
              {error && <p className="error" role="alert">{error}</p>}
              {res && <p className="okbox" role="status">Published. {res.reports_updated} suggestions moved to the new status.</p>}
              <label className="field">Headline<input className="input" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Running track at Central Park approved for design" /></label>
              <label className="field">Message<textarea className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
              <div className="row wrap">
                <label className="field" style={{ flex: 1 }}>Suggestions about<select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></label>
                <label className="field" style={{ flex: 1 }}>Mark as<select className="input" value={f.set_status} onChange={(e) => setF({ ...f, set_status: e.target.value })}>{STATUSES.map((c) => <option key={c} value={c}>{STEP_LABEL(c)}</option>)}</select></label>
              </div>
              <button className="btn" type="submit">Publish official update</button>
            </form>
          </div>
          <section className="stack" aria-label="Latest suggestions">
            <h2>Latest suggestions from residents</h2>
            {(d.recent || []).length === 0 && <p className="notice">No suggestions yet.</p>}
            <div className="grid g2">
              {(d.recent || []).map((x) => (
                <article key={x.code} className="card" data-testid="suggestion-row">
                  <div className="row between wrap">
                    <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{x.title}</b>
                    <span className="step done">{STEP_LABEL(x.status)}</span>
                  </div>
                  <span className="small mute">{CAT_LABEL[x.category] || x.category} · {x.location || 'No location given'} · {x.area} Forsyth</span>
                  {x.description && <span className="small">{x.description}</span>}
                  <span className="small mute">From {x.by} · ID {x.code}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}
