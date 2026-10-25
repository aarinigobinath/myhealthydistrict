import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { COUNTIES, HOME_COUNTY, useCounty } from '../county.jsx'
import { Logo } from './Logo.jsx'

const PATHS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  care: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.3c2.2.6 3.5 2.6 3.5 5.7"/>',
  voice: '<path d="M3 10v4h4l6 4V6L7 10H3z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
  mystuff: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M5 21l3-6 3 2 2-5-3-2 3-3 3 3h3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  car: '<path d="M3 16V8a2 2 0 0 1 2-2h10l4 4v6"/><path d="M3 16h18"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  apple: '<path d="M12 7c-2-2-6-1-6 4 0 4 2 9 4 9 1 0 1.5-.6 2-.6s1 .6 2 .6c2 0 4-5 4-9 0-5-4-6-6-4z"/><path d="M12 7c0-2 1-3 3-4"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  assistant: '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 7.5l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/>',
  bandage: '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01"/>',
}

export function Icon({ name, size = 22, filled = false }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: PATHS[name] || PATHS.care }} />
  )
}

export const IconBox = ({ name }) => <span className="iconbox"><Icon name={name} size={24} /></span>
/** Link text for “also in People”: only mentions events when some actually match. */
export function peopleLinkText(groups = [], events = []) {
  if (groups.length && events.length) return `Also in People: groups and events like “${groups[0].name}” →`
  if (groups.length) return `Also in People: groups like “${groups[0].name}” →`
  return 'Also in People: events →'
}
export const Sample = ({ show = true }) => (show ? <span className="sample">Sample</span> : null)

/** Official Google Maps links (the documented Maps URLs). No key needed. */
export const mapsLink = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)
export const directionsLink = (q) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q)
export const mapsEmbed = (q) => 'https://maps.google.com/maps?output=embed&z=14&q=' + encodeURIComponent(q)
/** What to search on Google Maps for a place. Uses the saved search text, or the name and address. */
export const placeQuery = (r) => r.map_query || [r.title, r.address && !/tap the map/i.test(r.address) ? r.address : 'Cumming, GA'].filter(Boolean).join(', ')

const NAV = [
  ['/', 'Today', 'home'], ['/care', 'Care', 'care'], ['/people', 'People', 'people'],
  ['/voice', 'Voice', 'voice'], ['/mystuff', 'MyStuff', 'mystuff'],
]

export function DemoBar() {
  const nav = useNavigate()
  const { logout } = useAuth()
  if (!import.meta.env.VITE_DEMO) return null
  const reset = async () => {
    const m = await import('../demo/mockApi.js')
    await m.resetDemo()
    logout()
    nav('/login')
  }
  return (
    <div className="demobar" role="note">
      <span><b>Preview mode.</b> Runs in this browser only. Sample data, nothing is sent anywhere.</span>
      <span className="row">
        <button type="button" className="linkbtn" onClick={() => nav(-1)}>← Back</button>
        <button type="button" className="linkbtn" onClick={reset}>Reset demo</button>
      </span>
    </div>
  )
}

function CountyPicker() {
  const { county, setCounty } = useCounty()
  return (
    <label className="county" title="Choose your county">
      <Icon name="pin" size={16} />
      <select aria-label="County" value={county} onChange={(e) => setCounty(e.target.value)}>
        {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  )
}

/** Small round AI Assistant button, bottom right, on every signed-in page. */
function AssistantButton() {
  const { pathname } = useLocation()
  if (pathname === '/assistant') return null
  return (
    <Link to="/assistant" className="aifab" title="Click for AI Assistant" aria-label="AI Assistant: click to ask a question">
      <span className="aidot"><Icon name="assistant" size={26} /></span>
      <span className="aicap">AI Assistant</span>
    </Link>
  )
}

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const { county } = useCounty()
  const nav = useNavigate()
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <DemoBar />
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand" aria-label="MyHealthyDistrict home"><Logo size={34} /></Link>
          <nav className={'nav' + (user?.is_admin ? ' six' : '')} aria-label="Main">
            {NAV.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end={to === '/'} title={label} aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name={icon} size={20} /><span className="lbl">{label}</span>
              </NavLink>
            ))}
            {user?.is_admin && (
              <NavLink to="/county" title="County" aria-label="County" className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name="care" size={20} /><span className="lbl">County</span>
              </NavLink>
            )}
          </nav>
          <div className="topright">
            <CountyPicker />
            <div className="userbox">
              <div className="avatar" title={user?.name} aria-hidden="true">{user?.name?.[0]?.toUpperCase()}</div>
              <button className="linkbtn" aria-label="Sign out" title="Sign out" onClick={() => { logout(); nav('/login') }}>
                <Icon name="logout" size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>
      {county !== HOME_COUNTY && (
        <div className="countynote" role="status">
          <span>MyHealthyDistrict only has Forsyth County information right now, so you’re still seeing Forsyth.</span>
          <CountyBack />
        </div>
      )}
      <main id="main" className="page">{children}</main>
      <footer className="footer">
        <div className="footer-in">
          <span>MyHealthyDistrict is a student project, not an official Forsyth County service.</span>
          <span>Emergency: call 911 · Crisis: call or text 988</span>
        </div>
      </footer>
      <AssistantButton />
    </>
  )
}

function CountyBack() {
  const { setCounty } = useCounty()
  return <button type="button" className="linkbtn" onClick={() => setCounty(HOME_COUNTY)}>Back to Forsyth</button>
}

export function SearchBar({ initial = '', placeholder = 'Search or describe a need', button, onSubmit }) {
  const nav = useNavigate()
  const [q, setQ] = useState(initial)
  useEffect(() => setQ(initial), [initial])
  const go = (e) => {
    e.preventDefault()
    const text = q.trim()
    if (!text) return
    onSubmit ? onSubmit(text) : nav('/search?q=' + encodeURIComponent(text))
  }
  return (
    <form className="searchbar" role="search" onSubmit={go}>
      <label className="searchbox">
        <Icon name="search" size={20} />
        <input aria-label="Search or describe a need" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} />
        <Icon name="mic" size={20} />
      </label>
      {button && <button className="btn" type="submit" style={{ minHeight: 56 }}>{button}</button>}
    </form>
  )
}

export function Heading({ title, sub }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h1>{title}</h1>
      {sub && <p className="lead">{sub}</p>}
    </div>
  )
}

export function Section({ title, link, children }) {
  return (
    <div className="stack">
      <div className="row between"><h2>{title}</h2>{link}</div>
      {children}
    </div>
  )
}

export function Chip({ on, children, ...rest }) {
  return <button type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={!!on} {...rest}>{children}</button>
}

/** Bookmark button used on every resource, group, event, idea and project. */
export function SaveButton({ item, onChange }) {
  const [saved, setSaved] = useState(!!item.saved)
  const [busy, setBusy] = useState(false)
  useEffect(() => setSaved(!!item.saved), [item.saved])
  const toggle = async () => {
    if (busy) return
    const next = !saved
    setSaved(next)
    setBusy(true)
    try {
      if (next) await api('/saved', { method: 'PUT', body: { type: item.type, id: item.id } })
      else await api(`/saved/${item.type}/${item.id}`, { method: 'DELETE' })
      onChange && onChange(next)
    } catch {
      setSaved(!next)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className="save" aria-pressed={saved} aria-label={saved ? 'Saved to MyStuff' : 'Save to MyStuff'}
      title={saved ? 'Saved to MyStuff' : 'Save to MyStuff'} onClick={toggle}>
      <Icon name="mystuff" filled={saved} />
    </button>
  )
}

export function useLoad(fn, deps) {
  const [state, set] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    set((s) => ({ ...s, loading: true, error: null }))
    fn().then((data) => live && set({ data, error: null, loading: false }))
      .catch((error) => live && set({ data: null, error, loading: false }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return [state, (updater) => set((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }))]
}

export const Loading = ({ state }) =>
  state.loading ? <p className="mute" role="status">Loading…</p>
    : state.error ? <p className="error" role="alert">{state.error.message}</p> : null

export function DateBox({ iso }) {
  const d = new Date(iso)
  const tz = { timeZone: 'America/New_York' }
  const mon = d.toLocaleString('en-US', { ...tz, month: 'short' }).toUpperCase()
  const day = d.toLocaleString('en-US', { ...tz, day: 'numeric' })
  return <div className="datebox"><b>{mon}</b><b>{day}</b></div>
}

export const whenText = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' })

export function ResourceCard({ r, onSaved }) {
  return (
    <article className="card" data-testid="resource-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h3 style={{ flex: 1, fontSize: 21, lineHeight: 1.2, paddingTop: 8 }}>{r.title}</h3>
        <SaveButton item={r} onChange={onSaved} />
      </div>
      <p>{r.description}</p>
      {r.good_if && <div className="goodif"><b style={{ color: 'var(--teal)' }}>Good if:</b> {r.good_if}</div>}
      <div className="stack small mute" style={{ gap: 2 }}>
        {r.address && <span>{r.address}</span>}
        {r.phone && <span>Phone: {r.phone}</span>}
        {r.hours && <span>{r.hours}</span>}
      </div>
      {r.map_query && (
        <a href={mapsLink(r.map_query)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14 }}>Open in Google Maps ↗</a>
      )}
      <div className="row between" style={{ marginTop: 4 }}>
        {r.source_url || r.url
          ? <a href={r.url || r.source_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14 }}>Official page ↗</a>
          : <span className="small mute">[Official page to be added]</span>}
        <Sample show={r.sample} />
      </div>
    </article>
  )
}

export function EventCard({ e, onChange }) {
  return (
    <div className="card flat" data-testid="event-card">
      <DateBox iso={e.starts_at} />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <b style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{e.title}</b>
        <span className="small mute">{whenText(e.starts_at)} · {e.location}</span>
        {e.blurb && <span className="small mute">{e.blurb}</span>}
        {e.going_count > 0 && <span className="small mute">{e.going_count} going</span>}
        {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>Event details ↗</a>}
        <Sample show={e.sample} />
      </div>
      {onChange && (
        <button className={'btn sm ' + (e.going ? 'on' : 'ghost')} onClick={() => onChange(e)}>{e.going ? "I’m going ✓" : "I’m going"}</button>
      )}
      <SaveButton item={e} />
    </div>
  )
}
