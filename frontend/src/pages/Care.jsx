import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Heading, IconBox, Loading, ResourceCard, SearchBar, Section, useLoad } from '../components/ui.jsx'

export default function Care() {
  const [pop] = useLoad(() => api('/popular'), [])
  const [tp] = useLoad(() => api('/topics'), [])
  return (
    <>
      <SearchBar placeholder="What do you want help with?" button="Search" />
      <Heading title="Care in Forsyth" sub="Health options near you. Search above, or browse what’s popular." />
      <div className="stack" style={{ gap: 10 }}>
        <div className="small mute" style={{ fontWeight: 700 }}>Popular searches</div>
        <div className="row wrap" style={{ gap: 8 }}>
          {pop.data?.searches.map((s) => <Link key={s} className="chip" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} to={'/search?q=' + encodeURIComponent(s)}>{s}</Link>)}
        </div>
      </div>
      <Section title="Browse health topics">
        <Loading state={tp} />
        <div className="grid g4">
          {tp.data?.map((t) => (
            <Link key={t.slug} to={`/care/topic/${t.slug}`} className="card" style={{ flexDirection: 'row', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 16px', minHeight: 64 }}>
              <IconBox name={t.icon} /><b>{t.title}</b>
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Popular this week">
        <div className="grid g3">{pop.data?.items.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
      </Section>
    </>
  )
}

export function TopicPage() {
  const { slug } = useParams()
  const [tp] = useLoad(() => api('/topics'), [])
  const t = tp.data?.find((x) => x.slug === slug)
  return (
    <>
      <SearchBar />
      <Link to="/care" style={{ fontWeight: 700 }}>← Care</Link>
      <Loading state={tp} />
      {tp.data && !t && <p className="error">That topic doesn’t exist.</p>}
      {t && (
        <>
          <Heading title={t.title} sub={t.blurb} />
          <div className="grid g3">
            {t.options.map((o) => (
              <Link key={o.slug} to={`/care/option/${o.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{o.title}</b>
                <span className="small mute">{o.summary}</span>
                <span style={{ color: 'var(--teal)', fontWeight: 700 }}>See options →</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
