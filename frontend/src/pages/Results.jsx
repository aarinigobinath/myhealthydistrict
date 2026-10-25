import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Heading, Icon, IconBox, Loading, SearchBar, peopleLinkText, useLoad } from '../components/ui.jsx'

export function TopicCard({ t, q, open, onToggle }) {
  const link = (slug) => `/care/option/${slug}` + (q ? `?q=${encodeURIComponent(q)}` : '')
  return (
    <section className={'card' + (open ? ' open' : '')} data-testid="topic-card" aria-label={t.title}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconBox name={t.icon} />
        <span className="stack" style={{ flex: 1, gap: 0 }}>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{t.title}</b>
          <span className="small mute">{t.options.length} kinds of options</span>
        </span>
        <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 6 }}>
          {t.options.map((o, i) => (
            <Link key={o.slug} to={link(o.slug)} className={'subrow' + (i === 0 ? ' first' : '')}>{o.title}<span>→</span></Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Results() {
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [st] = useLoad(() => api('/search', { params: { q } }), [q])
  const [openMap, setOpenMap] = useState({})
  const d = st.data
  const isOpen = (t) => (openMap[t.slug] !== undefined ? openMap[t.slug] : t.open)

  return (
    <>
      <SearchBar initial={q} />
      <Loading state={st} />
      {d && (
        <>
          {d.matched.length > 0 && (
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="pill">Because you said {d.matched.map((w) => `“${w}”`).join(' and ')}</span>
            </div>
          )}
          <Heading title="What’s available for you" sub="Pick a group to see what Forsyth offers. Nothing here is a plan: just options." />
          {d.topics.length === 0 ? (
            <div className="notice">
              We didn’t find a match for “{q}”. <Link to="/care">Browse all health topics</Link>, or try different words.
            </div>
          ) : (
            <div className="grid g3">
              {d.topics.map((t) => (
                <TopicCard key={t.slug} t={t} q={q} open={isOpen(t)} onToggle={() => setOpenMap({ ...openMap, [t.slug]: !isOpen(t) })} />
              ))}
            </div>
          )}
          <div className="row wrap">
            {(d.groups.length > 0 || d.events.length > 0) && (
              <Link className="btn" style={{ flex: 1 }} to={`/people?q=${encodeURIComponent(q)}`}>
                {peopleLinkText(d.groups, d.events)}
              </Link>
            )}
            <Link className="btn soft" style={{ flex: 1 }} to="/care">Not quite? Browse all health topics</Link>
          </div>
          <p className="small mute"><Icon name="care" size={14} /> In an emergency call 911. For emotional crisis call or text 988.</p>
        </>
      )}
    </>
  )
}
