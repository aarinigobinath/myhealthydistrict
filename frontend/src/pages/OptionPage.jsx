import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Chip, Heading, Loading, ResourceCard, SearchBar, directionsLink, mapsEmbed, mapsLink, placeQuery, useLoad } from '../components/ui.jsx'

const TAG_LABEL = { paved: 'Paved', 'under-2-miles': 'Under 2 miles', trail: 'Trail', hilly: 'Hilly', flat: 'Flat' }
const FILTERABLE = ['paved', 'under-2-miles', 'trail', 'hilly']
const NEXT = {
  'remote-learning': { to: '/people?q=recovery', text: 'Talk to students who’ve done this →' },
  'jogging-track-locator': { to: '/people?q=running', text: 'Find people to run with →' },
}

/** A real Google Map of the place you pick from the list, plus links that open Google Maps itself. */
function PlaceMap({ items, selected }) {
  const sel = items.find((i) => i.id === selected) || items[0]
  if (!sel) return null
  const query = placeQuery(sel)
  return (
    <div className="card mapcard">
      <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Map: {sel.title}</b>
      <div className="row wrap" style={{ gap: 8 }}>
        <a className="btn sm" href={mapsLink(query)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
        <a className="btn sm ghost" href={directionsLink(query)} target="_blank" rel="noreferrer">Get directions ↗</a>
      </div>
      <iframe className="mapframe" title={`Google Map of ${sel.title}`} src={mapsEmbed(query)}
        referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      <a href={mapsLink('parks and trails near Cumming, GA')} target="_blank" rel="noreferrer" className="small">See more parks and trails on Google Maps ↗</a>
      <span className="small mute">Pick another number in the list to move the map. If the map stays blank, use the buttons above to open Google Maps. Check the county page for closures before you go.</span>
    </div>
  )
}

export default function OptionPage() {
  const { slug } = useParams()
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [tags, setTags] = useState([])
  const [picked, setPicked] = useState(null)
  const [st] = useLoad(() => api(`/options/${slug}`, { params: { tag: tags } }), [slug, tags.join(',')])
  const o = st.data
  const toggle = (t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  const filters = useMemo(() => (o ? FILTERABLE.filter((t) => o.tags.includes(t)) : []), [o])
  const back = q ? `/care/results?q=${encodeURIComponent(q)}` : '/care'

  return (
    <>
      <SearchBar initial={q} />
      <Link to={back} style={{ fontWeight: 700, minHeight: 44, display: 'flex', alignItems: 'center', width: 'max-content' }}>
        ← {q ? 'What’s available for you' : 'Care'}
      </Link>
      <Loading state={st} />
      {o && (
        <>
          <Heading title={o.title} sub={o.summary} />
          {o.layout === 'map' && filters.length > 0 && (
            <div className="row wrap" style={{ gap: 8 }} role="group" aria-label="Filters">
              <Chip on={tags.length === 0} onClick={() => setTags([])}>All</Chip>
              {filters.map((t) => <Chip key={t} on={tags.includes(t)} onClick={() => toggle(t)}>{TAG_LABEL[t] || t}</Chip>)}
            </div>
          )}
          {o.layout === 'map' ? (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="stack">
                {o.resources.map((r, i) => (
                  <div key={r.id} className="row" style={{ alignItems: 'flex-start' }}>
                    <button type="button" onClick={() => setPicked(r.id)} aria-label={`Show ${r.title} on the map`} aria-pressed={(picked ?? o.resources[0]?.id) === r.id}
                      style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', border: '2px solid var(--teal)', cursor: 'pointer', fontWeight: 700,
                        background: (picked ?? o.resources[0]?.id) === r.id ? 'var(--teal)' : '#fff', color: (picked ?? o.resources[0]?.id) === r.id ? '#fff' : 'var(--teal)', marginTop: 14 }}>{i + 1}</button>
                    <div style={{ flex: 1 }}><ResourceCard r={{ ...r, map_query: placeQuery(r) }} /></div>
                  </div>
                ))}
                {o.resources.length === 0 && <p className="notice">Nothing matches those filters.</p>}
              </div>
              <div className="mapcol"><PlaceMap items={o.resources} selected={picked} /></div>
            </div>
          ) : (
            <div className="grid g3">{o.resources.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
          )}
          {o.slug === 'remote-learning' && (
            <p className="notice">Rules differ by school. Ask your school counselor [COUNSELOR NAME] what a doctor’s note needs to say and how to start.</p>
          )}
          {NEXT[o.slug] && <Link className="btn" to={NEXT[o.slug].to}>{NEXT[o.slug].text}</Link>}
        </>
      )}
    </>
  )
}
