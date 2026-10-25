import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Heading, IconBox, Loading, SaveButton, SearchBar, Sample, Section, useLoad } from '../components/ui.jsx'

export function IdeaCard({ i, onVote }) {
  return (
    <article className="card" data-testid="idea-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: 1, gap: 4 }}>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{i.title}</b>
          <span className="small mute">{i.body}</span>
        </div>
        <SaveButton item={i} />
      </div>
      <div className="row wrap small" style={{ gap: 8 }}>
        <span className="step done">{i.status}</span>
        <span><b>{i.support_pct}%</b> support · {i.responses} responses</span>
        <Sample show={i.sample} />
      </div>
      {onVote && (
        <div className="row wrap">
          <button className={'btn sm ' + (i.my_vote === 'support' ? 'on' : 'ghost')} aria-pressed={i.my_vote === 'support'} onClick={() => onVote(i, 'support')}>I support this</button>
          <button className={'btn sm ' + (i.my_vote === 'concern' ? 'on' : 'ghost')} aria-pressed={i.my_vote === 'concern'} onClick={() => onVote(i, 'concern')}>I have concerns</button>
        </div>
      )}
    </article>
  )
}

export function useVote(set) {
  return async (i, stance) => {
    const up = await api(`/ideas/${i.id}/vote`, { method: 'POST', body: { stance } })
    set((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === up.id ? up : x)) }))
  }
}

export function ProjectCard({ p }) {
  return (
    <article className="card flat" data-testid="project-card">
      <div className="stack" style={{ flex: 1, gap: 2 }}>
        <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{p.title}</b>
        <span className="small" style={{ fontWeight: 700, color: p.status.startsWith('Completed') ? 'var(--teal)' : 'var(--sun-ink)' }}>{p.status}</span>
        <span className="small mute">{p.summary}</span>
        {p.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>Source ↗</a>}
        <Sample show={p.sample} />
      </div>
      <SaveButton item={p} />
    </article>
  )
}

function Tile({ icon, title, sub, to }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <IconBox name={icon} /><b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{title}</b>
      <span className="small mute" style={{ fontSize: 14 }}>{sub}</span>
    </Link>
  )
}

export default function Voice() {
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [st, set] = useLoad(() => api('/voice'), [])
  const vote = useVote(set)
  const d = st.data
  return (
    <>
      <SearchBar initial={q} placeholder="Search, or describe what you’ve noticed" />
      <Heading title="Your voice in Forsyth" sub="See what the county is doing, and help shape what comes next. Support here is a community pulse, not official public comment." />
      {q && (
        <div className="card open" role="region" aria-label="Suggest this">
          <b style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Is this an idea you want the county to hear?</b>
          <span className="mute">“{q}”</span>
          <Link className="btn" style={{ width: 'max-content' }} to={`/voice/report?title=${encodeURIComponent(q)}`}>Suggest this</Link>
        </div>
      )}
      <div className="grid g4">
        <Tile icon="pin" title="Make a suggestion" sub="A health program, rally, or place you’d like to see" to="/voice/report" />
        <Tile icon="voice" title="Back an idea" sub="Support what neighbors are asking for" to="/voice/ideas" />
        <Tile icon="people" title="Public meetings" sub="Find one, or get help speaking" to="#meetings" />
        <Tile icon="mystuff" title="My suggestions" sub="See where your suggestion stands" to="/voice/reports" />
      </div>
      <Loading state={st} />
      {d && (
        <div className="grid g2">
          <div className="stack">
            <h2>From your county</h2>
            {d.announcements.map((a) => (
              <article key={a.id} className="card open">
                <div className="row"><span className={a.official ? 'official' : 'sample'}>{a.official ? 'Official' : 'Sample'}</span><span className="small mute">From your county</span></div>
                <b style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{a.title}</b>
                <span className="small mute" style={{ fontSize: 14 }}>{a.body}</span>
                {a.source_url && <a href={a.source_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 14 }}>Source ↗</a>}
              </article>
            ))}
            <h2>Help shape Forsyth</h2>
            {d.ideas.slice(0, 2).map((i) => <IdeaCard key={i.id} i={i} onVote={vote} />)}
            <Link to="/voice/ideas" style={{ fontWeight: 700 }}>See all ideas →</Link>
          </div>
          <div className="stack">
            <h2>Current county projects</h2>
            {d.projects.filter((p) => !p.status.startsWith('Completed')).map((p) => <ProjectCard key={p.id} p={p} />)}
            <h2>Recently finished</h2>
            {d.projects.filter((p) => p.status.startsWith('Completed')).map((p) => <ProjectCard key={p.id} p={p} />)}
            {d.projects_url && <a href={d.projects_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>More county projects on forsythco.com ↗</a>}
            <h2 id="meetings">Public meetings</h2>
            {d.meetings.map((x) => (
              <article key={x.id} className="card flat" data-testid="meeting-card">
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{x.title}</b>
                  <span className="small">{x.schedule}</span>
                  <span className="small mute">{x.location}</span>
                  <span className="small mute">{x.blurb}</span>
                  {x.source_url && <a href={x.source_url} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>Source ↗</a>}
                  <Sample show={x.sample} />
                </div>
                <SaveButton item={x} />
              </article>
            ))}
            <Link className="btn soft" to="/county">See what the county sees (staff dashboard) →</Link>
          </div>
        </div>
      )}
    </>
  )
}
