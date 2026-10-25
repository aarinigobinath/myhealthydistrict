import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Chip, DateBox, Heading, Loading, SaveButton, SearchBar, Sample, whenText, useLoad } from '../components/ui.jsx'

const SECTIONS = [['communities', 'Communities'], ['projects', 'Projects'], ['events', 'Events'], ['options', 'Options']]

function Row({ x, onGone }) {
  const title = x.title || x.name
  const sub = x.type === 'group' ? `${x.members} members · ${x.next_meeting}`
    : x.type === 'event' ? `${whenText(x.starts_at)} · ${x.location}`
    : x.type === 'meeting' ? x.schedule
    : x.type === 'idea' ? `${x.support_pct}% support`
    : x.type === 'project' ? x.status
    : x.address || x.hours
  return (
    <div className="card flat" data-testid="saved-row">
      {x.type === 'event' && <DateBox iso={x.starts_at} />}
      <div className="stack" style={{ flex: 1, gap: 0, minWidth: 0 }}>
        <b style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{title}</b>
        <span className="small mute">{sub}</span>
        <Sample show={x.sample} />
      </div>
      <SaveButton item={{ ...x, saved: true }} onChange={(s) => !s && onGone(x)} />
    </div>
  )
}

function Profile({ p: initial }) {
  const { updateUser } = useAuth()
  const [p, setP] = useState(initial)
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState({ name: p.name, tagline: p.tagline, neighborhood: p.neighborhood })
  const [err, setErr] = useState('')
  const save = async (e) => {
    e.preventDefault()
    try { const u = await api('/me', { method: 'PATCH', body: f }); updateUser(u); setP(u); setEdit(false) } catch (x) { setErr(x.message) }
  }
  return (
    <section className="card" aria-label="Profile" style={{ position: 'sticky', top: 16 }}>
      <div className="avatar" style={{ width: 72, height: 72, fontFamily: 'var(--serif)', fontSize: 30 }}>{p.name[0]}</div>
      {edit ? (
        <form className="stack" onSubmit={save}>
          <label className="field">Name<input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field">About you<input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></label>
          <label className="field">Neighborhood<input className="input" value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></label>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="row"><button className="btn sm" type="submit">Save</button><button type="button" className="btn sm ghost" onClick={() => setEdit(false)}>Cancel</button></div>
        </form>
      ) : (
        <>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{p.name}</b>
          <span className="mute">{[p.tagline, p.neighborhood].filter(Boolean).join(' · ') || 'Add a line about you'}</span>
          <span className="small mute">{p.area} Forsyth · {p.email}</span>
          <button className="btn ghost" onClick={() => setEdit(true)}>Edit profile</button>
        </>
      )}
      <span className="small mute">Your saved items stay private.</span>
    </section>
  )
}

export default function MyStuff() {
  const [st, set] = useLoad(() => api('/mystuff'), [])
  const [filter, setFilter] = useState('all')
  const d = st.data
  const gone = (x) => set((cur) => {
    const key = { group: 'communities', idea: 'projects', project: 'projects', event: 'events', meeting: 'events', resource: 'options' }[x.type]
    const next = { ...cur, [key]: cur[key].filter((y) => !(y.type === x.type && y.id === x.id)) }
    next.counts = { ...cur.counts, [key]: next[key].length }
    next.counts.all = SECTIONS.reduce((n, [k]) => n + next[k].length, 0)
    return next
  })
  return (
    <>
      <SearchBar placeholder="Search your saved items" />
      <Heading title="MyStuff" sub="Everything you’ve saved from Care, People and Voice, in one place." />
      <Loading state={st} />
      {d && (
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 28 }}>
          <div style={{ flex: '1 1 280px' }}><Profile p={d.profile} /></div>
          <div className="stack" style={{ flex: '3 1 520px', minWidth: 0, gap: 20 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Chip on={filter === 'all'} onClick={() => setFilter('all')}>All {d.counts.all}</Chip>
              {SECTIONS.map(([k, label]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{label} {d.counts[k]}</Chip>)}
            </div>
            {d.counts.all === 0 && (
              <p className="notice">Nothing saved yet. Tap the bookmark on any option, group, event or idea. <Link to="/care">Browse Care</Link></p>
            )}
            <div className="grid g3">
              {SECTIONS.filter(([k]) => filter === 'all' || filter === k).map(([k, label]) => d[k].length > 0 && (
                <div key={k} className="stack" style={{ gap: 10 }} aria-label={label}>
                  <div className="small mute" style={{ fontWeight: 700 }}>{label}</div>
                  {d[k].map((x) => <Row key={x.type + x.id} x={x} onGone={gone} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
