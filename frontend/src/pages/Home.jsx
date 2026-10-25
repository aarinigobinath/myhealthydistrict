import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { EventCard, Heading, IconBox, Loading, SearchBar, Section, useLoad } from '../components/ui.jsx'

const EXAMPLE = 'I’m a high schooler, stuck in bed after knee surgery'

export default function Home() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [st, set] = useLoad(() => api('/home'), [])
  const rsvp = async (e) => {
    const up = await api(`/events/${e.id}/rsvp`, { method: 'POST' })
    set((d) => ({ ...d, events: d.events.map((x) => (x.id === up.id ? up : x)) }))
  }
  const ask = (text) => nav('/search?q=' + encodeURIComponent(text))

  return (
    <>
      <div className="hero grid g2">
        <div className="stack" style={{ gap: 16 }}>
          <h1 className="herotitle">Hi {user.name}.<br />What’s going on?</h1>
          <p className="lead" style={{ fontSize: 18 }}>Say it in your own words. We’ll take you to the right place: Care, People or Voice.</p>
          <SearchBar placeholder="Describe your situation" button="Show my options" />
          <div className="stack" style={{ gap: 8 }}>
            <div className="small mute" style={{ fontWeight: 700 }}>Try an example, or people also asked about</div>
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="chip" onClick={() => ask(EXAMPLE)}>High schooler after knee surgery</button>
              <button className="chip" onClick={() => ask('I want to start jogging again')}>Start jogging again</button>
              <button className="chip" onClick={() => ask('Food on a budget')}>Food on a budget</button>
              <button className="chip" onClick={() => ask('Dad, 72, staying active')}>Dad, 72, staying active</button>
              <button className="chip" onClick={() => ask('The road to the park has no sidewalk')}>No sidewalk to the park</button>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="small mute" style={{ fontWeight: 700 }}>This week near you</div>
          <Loading state={st} />
          {st.data?.events.map((e) => <EventCard key={e.id} e={e} onChange={rsvp} />)}
          {st.data?.events.length === 0 && <p className="small mute">Nothing listed for the next few days. Check the county calendar below.</p>}
          <Link to="/people" style={{ fontWeight: 700, fontSize: 14 }}>See all events →</Link>
          {st.data?.calendar_url && (
            <a href={st.data.calendar_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14 }}>Official county events calendar ↗</a>
          )}
        </div>
      </div>
      <Section title="Where we’ll take you">
        <div className="grid g3">
          {[
            ['care', 'Care', '/care', 'Health options near you: learning while you heal, jogging tracks, clinics, food help.'],
            ['people', 'People', '/people', 'Groups, events and challenges with neighbors who get what you’re going through.'],
            ['voice', 'Voice', '/voice', 'Make a suggestion, back an idea, and see what the county is building.'],
          ].map(([icon, t, to, d]) => (
            <Link key={t} to={to} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <IconBox name={icon} />
              <b style={{ fontFamily: 'var(--serif)', fontSize: 21 }}>{t}</b>
              <span className="small mute" style={{ fontSize: 14 }}>{d}</span>
              <span style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 14 }}>Open {t} →</span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  )
}
