import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Heading, Loading, SearchBar, useLoad } from '../components/ui.jsx'

// Suggestion types. The values are the category keys the API stores; "lighting" and "crossing" still exist
// for older sample rows but are no longer offered in the form.
export const CAT_LABEL = {
  program: 'Health program', event: 'Event or rally', park: 'Park, track or facility', sidewalk: 'Sidewalk or path',
  trail: 'Trail', lighting: 'Lighting', crossing: 'Crosswalk', other: 'Something else',
}
const CATS = ['program', 'event', 'park', 'sidewalk', 'trail', 'other'].map((v) => [v, CAT_LABEL[v]])
export const STEP_LABEL = (s) => (s === 'Fixed' ? 'Done' : s)

export function Tracker({ issue }) {
  return (
    <article className="card open" data-testid="tracker">
      <div className="row between wrap">
        <b style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{issue.title}</b>
        <span className="small mute">Tracking ID <b data-testid="tracking-id" style={{ color: 'var(--ink)' }}>{issue.code}</b></span>
      </div>
      <span className="small mute">{CAT_LABEL[issue.category] || issue.category}</span>
      <div className="steps" role="list" aria-label="Status">
        {issue.steps.map((s, i) => <span role="listitem" key={s} className={'step' + (i <= issue.step_index ? ' done' : '')}>{STEP_LABEL(s)}</span>)}
      </div>
      <span className="small mute">{issue.location || 'No location given'} · {issue.area} Forsyth</span>
      {issue.similar_count > 1 && <p className="okbox">{issue.similar_count - 1} neighbors made similar suggestions in {issue.area} Forsyth (sample data)</p>}
    </article>
  )
}

export default function Report() {
  const [sp] = useSearchParams()
  const [f, setF] = useState({ title: sp.get('title') || '', category: sp.get('category') || 'program', location: '', description: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try { setDone(await api('/issues', { method: 'POST', body: f })) } catch (x) { setError(x.message) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <>
        <Heading title="Suggestion sent to Forsyth County" sub="Thank you. Here is where it stands." />
        <Tracker issue={done} />
        <div className="row wrap">
          <Link className="btn" to="/voice/ideas">Back an idea neighbors are asking for →</Link>
          <Link className="btn ghost" to="/voice/reports">My suggestions</Link>
        </div>
        <p className="small mute">MyHealthyDistrict is a student project. This demo does not send real suggestions to the county.</p>
      </>
    )
  }
  return (
    <>
      <SearchBar placeholder="Search Voice" />
      <Heading title="Make a suggestion" sub="Tell us about a health program, event, or place you’d like to see. We’ll give you a tracking number." />
      <form className="card" style={{ maxWidth: 640 }} onSubmit={submit} aria-label="Make a suggestion">
        {error && <p className="error" role="alert">{error}</p>}
        <label className="field">What’s your suggestion?<input className="input" required minLength={3} value={f.title} onChange={set('title')} placeholder="e.g. A veterans wellness program" /></label>
        <label className="field">Type<select className="input" value={f.category} onChange={set('category')}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field">Where? (park, street or landmark)<input className="input" value={f.location} onChange={set('location')} placeholder="e.g. Central Park" /></label>
        <label className="field">Why it would help (optional)<textarea className="input" value={f.description} onChange={set('description')} /></label>
        <p className="small mute">Ideas neighbors have shared: a cancer awareness rally, a veterans wellness program, a public running track.</p>
        <p className="small mute">For emergencies call 911. Do not include private details about other people.</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send suggestion'}</button>
      </form>
    </>
  )
}

export function MyReports() {
  const [st] = useLoad(() => api('/issues'), [])
  return (
    <>
      <Heading title="My suggestions" sub="Everything you’ve sent, and where it stands." />
      <Loading state={st} />
      {st.data?.length === 0 && <p className="notice">You haven’t made a suggestion yet. <Link to="/voice/report">Make a suggestion</Link></p>}
      <div className="grid g2">{st.data?.map((i) => <Tracker key={i.code} issue={i} />)}</div>
    </>
  )
}
