import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { EventCard, Heading, Icon, Loading, SaveButton, SearchBar, Sample, Section, useLoad } from '../components/ui.jsx'

export function GroupCard({ g, onJoin }) {
  return (
    <div className="card flat" data-testid="group-card">
      <span className="groupicon" aria-hidden="true"><Icon name="people" size={28} /></span>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{g.name}</b>
        <span className="small mute">{g.members} members · {g.next_meeting}</span>
        <span className="small mute">{g.blurb}</span>
        {g.teen_safe && <span className="small" style={{ color: 'var(--teal)', fontWeight: 700 }}>Moderated · no private messages between adults and teens</span>}
        <Sample show={g.sample} />
      </div>
      <button className={'btn sm ' + (g.joined ? 'on' : '')} onClick={() => onJoin(g)}>{g.joined ? 'Joined ✓' : 'Join'}</button>
      <SaveButton item={g} />
    </div>
  )
}

function Challenge({ c, onLog }) {
  const [miles, setMiles] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const n = parseFloat(miles)
    if (!(n > 0)) return setErr('Enter miles, like 2.5')
    try { await onLog(n); setMiles('') } catch (x) { setErr(x.message) }
  }
  return (
    <section className="card open" aria-label="Healthy Forsyth Challenge">
      <div className="row between"><b style={{ fontFamily: 'var(--serif)', fontSize: 21 }}>Healthy Forsyth Challenge</b><Sample /></div>
      <span className="small mute">Which part of the county moves the most this month?</span>
      {c.areas.map((a) => (
        <div key={a.name} className={'bar' + (a.name === c.my_area ? ' me' : '')}>
          <span className="name" style={{ fontWeight: a.name === c.my_area ? 700 : 400 }}>{a.name}</span>
          <div className="track"><div className="fill" style={{ width: a.percent + '%' }} /></div>
          <b>{a.percent}%</b>
        </div>
      ))}
      <b style={{ color: 'var(--teal)', fontSize: 14 }}>You’ve added {c.my_miles} miles for {c.my_area}</b>
      <form className="row wrap" onSubmit={submit}>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>Log miles
          <input className="input" inputMode="decimal" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="2.5" />
        </label>
        <button className="btn sm" type="submit" style={{ alignSelf: 'flex-end' }}>Add</button>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
      <Link to="/voice/report?category=trail" style={{ fontWeight: 700, fontSize: 14 }}>Want a safer route or a new trail? Suggest it to the county →</Link>
    </section>
  )
}

export default function People() {
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [st, set] = useLoad(() => api('/people'), [])
  const [match] = useLoad(() => (q ? api('/search', { params: { q } }) : Promise.resolve(null)), [q])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', blurb: '', next_meeting: '' })
  const [err, setErr] = useState('')

  const join = async (g) => {
    const up = await api(`/groups/${g.id}/join`, { method: 'POST' })
    set((d) => ({ ...d, groups: d.groups.map((x) => (x.id === up.id ? up : x)) }))
  }
  const rsvp = async (e) => {
    const up = await api(`/events/${e.id}/rsvp`, { method: 'POST' })
    set((d) => ({ ...d, events: d.events.map((x) => (x.id === up.id ? up : x)) }))
  }
  const create = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      const g = await api('/groups', { method: 'POST', body: form })
      set((d) => ({ ...d, groups: [g, ...d.groups] }))
      setForm({ name: '', blurb: '', next_meeting: '' })
      setAdding(false)
    } catch (x) { setErr(x.message) }
  }
  const d = st.data
  const mg = match.data?.groups || []
  const me = match.data?.events || []

  return (
    <>
      <SearchBar initial={q} placeholder="Search groups and events, or describe a need" />
      <Heading title="Find your people" sub="Popular in Forsyth this week. Groups are moderated, and teen groups have no private messages between adults and teens." />
      <Loading state={st} />
      {q && (mg.length > 0 || me.length > 0) && (
        <Section title={`Matching “${q}”`}>
          <div className="grid g3">
            {mg.map((g) => <GroupCard key={'m' + g.id} g={d?.groups.find((x) => x.id === g.id) || g} onJoin={join} />)}
            {me.map((e) => <EventCard key={'e' + e.id} e={d?.events.find((x) => x.id === e.id) || e} onChange={rsvp} />)}
          </div>
        </Section>
      )}
      {d && (
        <div className="grid g2">
          <div className="stack">
            <h2>Popular groups</h2>
            {d.groups.map((g) => <GroupCard key={g.id} g={g} onJoin={join} />)}
            {adding ? (
              <form className="card" onSubmit={create} aria-label="Start a group">
                <label className="field">Group name<input className="input" required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="field">What is it for?<textarea className="input" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} /></label>
                <label className="field">When do you meet?<input className="input" value={form.next_meeting} onChange={(e) => setForm({ ...form, next_meeting: e.target.value })} /></label>
                {err && <p className="error" role="alert">{err}</p>}
                <div className="row"><button className="btn" type="submit">Start group</button><button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button></div>
              </form>
            ) : (
              <button className="btn ghost" onClick={() => setAdding(true)}>+ Start a group</button>
            )}
          </div>
          <div className="stack">
            <h2>Events this week</h2>
            {d.events.map((e) => <EventCard key={e.id} e={e} onChange={rsvp} />)}
            {d.events.length === 0 && <p className="notice">Nothing listed for the next few days.</p>}
            <p className="small mute">Health, wellness and mental health events near you. Always check the host’s page: dates and times can change.</p>
            {d.calendar_url && <a href={d.calendar_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>See the full official county calendar ↗</a>}
            <Challenge c={d.challenge} onLog={async (miles) => {
              const c = await api('/challenge/log', { method: 'POST', body: { miles } })
              set((x) => ({ ...x, challenge: c }))
            }} />
          </div>
        </div>
      )}
    </>
  )
}
