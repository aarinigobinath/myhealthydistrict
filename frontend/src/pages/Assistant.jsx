import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { EventCard, Icon, peopleLinkText } from '../components/ui.jsx'
import { TopicCard } from './Results.jsx'
import { GroupCard } from './People.jsx'
import { IdeaCard, ProjectCard } from './Voice.jsx'

const STARTERS = [
  'I want to start jogging again',
  'I’m a high schooler, stuck in bed after knee surgery',
  'What’s happening this week?',
  'I feel stressed and want someone to talk to',
  'What is the county building?',
  'Food on a budget',
]
const CRISIS = /\b(suicid\w*|kill myself|end my life|want to die|hurt myself|self[- ]harm)\b/i
const SAFETY = 'In an emergency, call 911. For an emotional crisis, call or text 988.'

const enc = encodeURIComponent
const join = (words) => words.map((w) => `“${w}”`).join(' and ')

/**
 * The assistant asks the same /search the search bar uses and shows the same page content,
 * in short plain sentences. Nothing is added that the search page would not show.
 */
async function buildReply(text) {
  const reply = { text: '', blocks: {}, chips: [], links: [], note: '' }
  if (CRISIS.test(text)) {
    reply.note = 'If you are thinking about hurting yourself, please call or text 988 now. It is free and open any time. In an emergency, call 911. You do not have to handle this alone.'
  }
  const d = await api('/search', { params: { q: text } })
  const because = d.matched?.length ? `You said ${join(d.matched)}. ` : ''

  if (d.route === 'people') {
    const p = await api('/people')
    const found = d.groups.length > 0 || d.events.length > 0
    const kinds = d.groups.length && d.events.length ? 'groups and events' : d.events.length ? 'events' : 'groups'
    reply.text = found ? `${because}Here are ${kinds} near you.` : 'Here are popular groups near you.'
    reply.blocks.groups = (found ? d.groups : p.groups).slice(0, 3)
    reply.blocks.events = d.events.slice(0, 3)   // only events that match; none are added just to fill space
    reply.links = [{ to: `/people?q=${enc(text)}`, text: 'Open People →' }]
    if (p.calendar_url) reply.links.push({ href: p.calendar_url, text: 'See the county events calendar ↗', external: true })
    reply.chips = ['What is the county building?']
  } else if (d.route === 'voice') {
    const hasStuff = d.ideas.length > 0 || d.projects.length > 0
    reply.text = hasStuff ? `${because}Here is what neighbors and the county have on this.` : `${because}You can tell the county about this.`
    reply.blocks.ideas = d.ideas.slice(0, 3)
    const now = d.projects.filter((x) => !x.status.startsWith('Completed'))
    const done = d.projects.filter((x) => x.status.startsWith('Completed'))
    reply.blocks.projects = [...now, ...done].slice(0, 6)
    reply.links = [
      { to: `/voice/report?title=${enc(text)}`, text: 'Suggest this to the county →' },
      { to: `/voice?q=${enc(text)}`, text: 'Open Voice →' },
    ]
    reply.chips = ['What’s happening this week?']
  } else {
    const has = d.topics.length > 0
    reply.text = has
      ? `${because}Here is what Forsyth offers. These are choices, not a plan.`
      : `I could not find “${text}”. Try other words, or look through all health topics.`
    reply.blocks.topics = d.topics
    reply.links = has
      ? [{ to: `/care/results?q=${enc(text)}`, text: 'Open the full results page →' }]
      : [{ to: '/care', text: 'Browse all health topics →' }]
    if (has && (d.groups.length > 0 || d.events.length > 0)) {
      reply.links.push({ to: `/people?q=${enc(text)}`, text: peopleLinkText(d.groups, d.events) })
    }
    if (has) reply.links.push({ to: '/care', text: 'Not quite? Browse all health topics' })
    if (d.groups.length || d.events.length) reply.chips = ['Find a group to join']
    if (d.topics.some((t) => t.slug === 'mental-wellbeing')) reply.note = reply.note || SAFETY
  }
  return reply
}

function OpenTopic({ t, q }) {
  const [open, setOpen] = useState(!!t.open)
  return <TopicCard t={t} q={q} open={open} onToggle={() => setOpen(!open)} />
}

function Blocks({ msg, onEvent, onGroup, onVote }) {
  const b = msg.blocks || {}
  return (
    <>
      {b.topics?.length > 0 && <div className="grid g3">{b.topics.map((t) => <OpenTopic key={t.slug} t={t} q={msg.q} />)}</div>}
      {b.groups?.length > 0 && <div className="grid g3">{b.groups.map((g) => <GroupCard key={g.id} g={g} onJoin={onGroup} />)}</div>}
      {b.events?.length > 0 && <div className="grid g3">{b.events.map((e) => <EventCard key={e.id} e={e} onChange={onEvent} />)}</div>}
      {b.ideas?.length > 0 && <div className="grid g3">{b.ideas.map((i) => <IdeaCard key={i.id} i={i} onVote={onVote} />)}</div>}
      {b.projects?.length > 0 && <div className="grid g3">{b.projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
    </>
  )
}

export default function Assistant() {
  const nav = useNavigate()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const ask = async (q) => {
    q = q.trim()
    if (!q || busy) return
    setText('')
    setMsgs((m) => [...m, { id: m.length, who: 'user', text: q }])
    setBusy(true)
    try {
      const r = await buildReply(q)
      setMsgs((m) => [...m, { id: m.length, who: 'bot', q, ...r }])
    } catch (e) {
      setMsgs((m) => [...m, { id: m.length, who: 'bot', q, text: `Sorry, I could not get that just now (${e.message}). Please try again.`, blocks: {}, chips: [] }])
    } finally {
      setBusy(false)
    }
  }
  const patch = (key, up) => setMsgs((ms) => ms.map((m) => (m.blocks?.[key] ? { ...m, blocks: { ...m.blocks, [key]: m.blocks[key].map((x) => (x.id === up.id ? up : x)) } } : m)))
  const onEvent = async (e) => patch('events', await api(`/events/${e.id}/rsvp`, { method: 'POST' }))
  const onGroup = async (g) => patch('groups', await api(`/groups/${g.id}/join`, { method: 'POST' }))
  const onVote = async (i, stance) => patch('ideas', await api(`/ideas/${i.id}/vote`, { method: 'POST', body: { stance } }))
  const submit = (e) => { e.preventDefault(); ask(text) }

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => nav(-1)}>← Back</button>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="assistant" size={30} />AI Assistant</h1>
        <p className="lead">Ask in your own words. You get the same answers as the search bar, in a quick chat. I show choices, never a plan, and I do not make things up.</p>
      </div>

      <div className="chat" role="log" aria-live="polite" aria-label="Conversation with the AI Assistant">
        {msgs.length === 0 && (
          <div className="msg bot">
            <div className="bubble">Hi! What’s going on? Ask about health options, groups, events, or what the county is doing.</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {STARTERS.map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={'msg ' + m.who}>
            <div className="bubble">{m.text}</div>
            {m.who === 'bot' && (
              <>
                {m.note && <p className="notice" role="note">{m.note}</p>}
                <Blocks msg={m} onEvent={onEvent} onGroup={onGroup} onVote={onVote} />
                {m.links?.length > 0 && (
                  <div className="row wrap" style={{ gap: '4px 20px' }}>
                    {m.links.map((l) => (l.external
                      ? <a key={l.text} href={l.href} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{l.text}</a>
                      : <Link key={l.text} to={l.to} style={{ fontWeight: 700 }}>{l.text}</Link>))}
                  </div>
                )}
                {m.chips?.length > 0 && (
                  <div className="row wrap" style={{ gap: 8 }}>
                    {m.chips.map((c) => <button key={c} type="button" className="chip" onClick={() => ask(c)}>{c}</button>)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {busy && <p className="mute" role="status">Looking…</p>}
        <div ref={end} />
      </div>

      <form className="searchbar" onSubmit={submit} aria-label="Ask the AI Assistant">
        <label className="searchbox">
          <Icon name="assistant" size={20} />
          <input aria-label="Ask the AI Assistant" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question or describe what’s going on" />
        </label>
        <button className="btn" type="submit" style={{ minHeight: 56 }} disabled={busy}>Ask</button>
      </form>
      <p className="small mute">{SAFETY}</p>
    </>
  )
}
