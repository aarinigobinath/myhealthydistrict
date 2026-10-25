// Preview mode: the same API the Python server offers, running inside the browser.
// Data comes from data.json (a snapshot of the Forsyth County sample data). Changes you make
// (accounts, saves, reports, votes) are kept in this browser only. Built with `npm run build:demo`.
import DATA from './data.json'

const KEY = 'mhd_demo_v2'
const AREAS = ['North', 'West', 'Central', 'South']
const STEPS = ['Sent', 'Seen', 'Planned', 'Fixed']

// ---------------------------------------------------------------- storage
let mem = null
const sha = async (s) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return 'plain:' + s }
}

async function seedState() {
  return {
    nextUser: 4, nextGroup: 100, nextAnn: 100,
    users: [
      { id: 1, email: 'maya@example.com', name: 'Maya', pw: await sha('maya@example.com:MayaDemo2026!'), tagline: 'Runner · back from injury', neighborhood: '[YOUR NEIGHBORHOOD]', area: 'West', is_admin: false },
      { id: 2, email: 'county@example.com', name: 'County Demo Staff', pw: await sha('county@example.com:CountyDemo2026!'), tagline: 'Demo county staff account', neighborhood: '', area: 'Central', is_admin: true },
      { id: 3, email: 'neighbor@example.com', name: 'Sample Neighbor', pw: await sha('neighbor@example.com:NeighborDemo2026!'), tagline: '', neighborhood: '', area: 'West', is_admin: false },
    ],
    saved: [], members: [], extraGroups: [], rsvps: [], votes: [], issues: [], flags: [],
    logs: [{ uid: 1, miles: 6.2 }], announcements: [], catStatus: {},
  }
}

async function load() {
  if (mem) return mem
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { mem = JSON.parse(raw); return mem }
  } catch { /* storage blocked: keep in memory */ }
  mem = await seedState()
  persist()
  return mem
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* ignore */ } }
export async function resetDemo() { mem = await seedState(); persist() }

// ---------------------------------------------------------------- helpers
class HttpError extends Error { constructor(status, detail) { super(detail); this.status = status; this.detail = detail } }
const fail = (s, d) => { throw new HttpError(s, d) }

const byId = (arr, id) => arr.find((x) => x.id === id)
const topicOptions = (t) => DATA.options.filter((o) => o.topic === t.slug).sort((a, b) => a.sort - b.sort)
const optionBrief = (o) => ({ slug: o.slug, title: o.title, summary: o.summary, layout: o.layout })
const topicOut = (t, withOptions = true) => {
  const d = { slug: t.slug, title: t.title, blurb: t.blurb, icon: t.icon }
  if (withOptions) d.options = topicOptions(t).map(optionBrief)
  return d
}

// ---------------------------------------------------------------- serializers
const hasSaved = (st, u, type, id) => !!u && st.saved.some((s) => s.uid === u.id && s.type === type && s.id === id)

function resourceOut(st, u, r) {
  return { type: 'resource', id: r.id, slug: r.slug, title: r.title, description: r.description, good_if: r.good_if, address: r.address,
    phone: r.phone, hours: r.hours, url: r.url, source_url: r.source_url, map_query: r.map_query || '', tags: r.tags || [], lat: r.lat, lng: r.lng, sample: !r.verified,
    option_slug: r.option, saved: hasSaved(st, u, 'resource', r.id) }
}
const allGroups = (st) => [...DATA.groups, ...st.extraGroups]
function groupOut(st, u, g) {
  const n = st.members.filter((x) => x.gid === g.id).length
  return { type: 'group', id: g.id, slug: g.slug, name: g.name, blurb: g.blurb, next_meeting: g.next_meeting, members: g.base_members + n,
    teen_safe: g.teen_safe, tags: g.tags || [], sample: !g.verified, joined: !!u && st.members.some((x) => x.gid === g.id && x.uid === u.id),
    saved: hasSaved(st, u, 'group', g.id) }
}
function eventOut(st, u, e) {
  const n = st.rsvps.filter((x) => x.eid === e.id).length
  return { type: 'event', id: e.id, slug: e.slug, title: e.title, starts_at: e.starts_at, location: e.location, blurb: e.blurb,
    going_count: e.base_going + n, going: !!u && st.rsvps.some((x) => x.eid === e.id && x.uid === u.id), source_url: e.source_url || '', tags: e.tags || [],
    sample: !e.verified, saved: hasSaved(st, u, 'event', e.id) }
}
function ideaOut(st, u, i) {
  const votes = st.votes.filter((v) => v.iid === i.id)
  const sup = i.base_support + votes.filter((v) => v.stance === 'support').length
  const con = i.base_concerns + votes.filter((v) => v.stance === 'concern').length
  const total = sup + con
  const mine = u ? votes.find((v) => v.uid === u.id) : null
  return { type: 'idea', id: i.id, slug: i.slug, title: i.title, body: i.body, status: i.status, support: sup, concerns: con, responses: total,
    support_pct: total ? Math.round((100 * sup) / total) : 0, my_vote: mine ? mine.stance : null, sample: !i.verified, saved: hasSaved(st, u, 'idea', i.id) }
}
const projectOut = (st, u, p) => ({ type: 'project', id: p.id, slug: p.slug, title: p.title, status: p.status, summary: p.summary, source_url: p.source_url, sample: !p.verified, saved: hasSaved(st, u, 'project', p.id) })
const meetingOut = (st, u, x) => ({ type: 'meeting', id: x.id, slug: x.slug, title: x.title, schedule: x.schedule, location: x.location, blurb: x.blurb, source_url: x.source_url, sample: !x.verified, saved: hasSaved(st, u, 'meeting', x.id) })
const annOut = (a) => ({ id: a.id, title: a.title, body: a.body, source_url: a.source_url, published_at: a.published_at, official: a.official, sample: !a.verified })
const userOut = (u) => ({ id: u.id, email: u.email, name: u.name, tagline: u.tagline, neighborhood: u.neighborhood, area: u.area, is_admin: u.is_admin })

// ---------------------------------------------------------------- issues (reports)
const baseCount = (area, cat) => (DATA.issue_matrix.find((x) => x.area === area && x.category === cat) || { n: 0 }).n
function issueOut(st, u, x) {
  const flags = st.flags.filter((f) => f.code === x.code).length
  const similar = baseCount(x.area, x.category) + st.issues.filter((y) => y.area === x.area && y.category === x.category).length
  const status = x.status
  return { code: x.code, title: x.title, description: x.description, category: x.category, location: x.location, area: x.area, status, steps: STEPS,
    step_index: Math.max(0, STEPS.indexOf(status)), created_at: x.created_at, flag_count: flags, similar_count: similar, i_flagged: !!u && st.flags.some((f) => f.code === x.code && f.uid === u.id) }
}

// ---------------------------------------------------------------- challenge
function challengeOut(st, u) {
  const rows = DATA.areas.map((a) => {
    const extra = st.logs.filter((l) => (byId(st.users, l.uid) || {}).area === a.name).reduce((n, l) => n + l.miles, 0)
    const total = a.base_miles + extra
    return { name: a.name, miles: Math.round(total * 10) / 10, percent: Math.min(100, Math.round((100 * total) / a.goal_miles)) }
  }).sort((a, b) => b.percent - a.percent)
  rows.forEach((r, i) => { r.rank = i + 1 })
  const mine = u ? st.logs.filter((l) => l.uid === u.id).reduce((n, l) => n + l.miles, 0) : 0
  return { areas: rows, my_area: u ? u.area : null, my_miles: Math.round(mine * 10) / 10 }
}

// ---------------------------------------------------------------- search (same rules as backend/app/search.py)
const VOICE_WORDS = ['report', 'pothole', 'sidewalk', 'crosswalk', 'unsafe', 'dark', 'streetlight', 'street light', 'broken', 'county', 'commissioner', 'meeting', 'petition', 'idea', 'complain', 'traffic', 'speed', 'no sidewalk', 'public comment', 'vote', 'ordinance', 'trail extension', 'litter', 'hazard', 'flooded', 'overgrown', 'project', 'projects', 'construction', 'building']
const EVENT_INTENT = /\b(this week|what'?s on|what is on|happening|events?|things to do|calendar)\b/i
const PROJECT_INTENT = /\b(projects?|construction|county news)\b|\bwhat(?:'?s| is| are) the county\b|\bcounty\b.*\b(building|working on)\b/i
const PEOPLE_WORDS = ['group', 'club', 'friend', 'join', 'meet', 'buddy', 'buddies', 'team', 'event', 'events', 'lonely', 'together', 'walkers', 'runners', 'challenge', 'volunteer', 'community', 'neighbors', 'neighbour', 'people like me', 'social', 'this week', 'things to do', 'calendar', 'happening']
const CARE_HINTS = ['surgery', 'injury', 'doctor', 'clinic', 'flu', 'shot', 'jog', 'run', 'walk', 'recover', 'therapy', 'food', 'pantry', 'health', 'school', 'learn', 'exercise', 'sick', 'anxiety', 'stress', 'senior', 'baby', 'diet']
const STOP = new Set(['i', 'im', "i'm", 'a', 'an', 'the', 'to', 'and', 'of', 'in', 'on', 'my', 'me', 'is', 'am', 'want', 'need', 'after', 'for', 'with', 'are', 'be', 'can', 'how', 'do', 'what', 'where', 'some', 'any', 'get', 'find', 'looking', 'help', 'near', 'stuck', 'start', 'again', 'feel', 'just', 'have', 'like', 'going', 'this', 'week', 'happening', 'want', 'know', 'tell', 'about'])
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hits = (text, words) => words.filter((w) => new RegExp('\\b' + esc(w.toLowerCase()) + '\\w*').test(text))
const tokens = (q) => (q.toLowerCase().match(/[a-z0-9']+/g) || []).filter((t) => !STOP.has(t) && t.length > 2)

function routeFor(q) {
  const text = q.toLowerCase()
  const v = hits(text, VOICE_WORDS).length
  const p = hits(text, PEOPLE_WORDS).length
  const c = hits(text, CARE_HINTS).length
  if (v && v >= p && v >= c) return 'voice'
  if (p && p >= c) return 'people'
  return 'care'
}
function careMatches(q) {
  const text = q.toLowerCase()
  const toks = tokens(q)
  const scored = []
  const matched = []
  for (const t of [...DATA.topics].sort((a, b) => a.sort - b.sort)) {
    const words = [...(t.keywords || [])]
    topicOptions(t).forEach((o) => words.push(...(o.keywords || [])))
    const h = hits(text, words)
    for (const tok of toks) for (const w of words) if (tok.length >= 4 && w.toLowerCase().startsWith(tok.slice(0, 4)) && !h.includes(w.toLowerCase())) h.push(w)
    if (h.length) { scored.push([h.length, t, h]); h.forEach((x) => { if (!matched.includes(x)) matched.push(x) }) }
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].sort - b[1].sort)
  return { scored, matched }
}
function tidy(text, words) {
  const typed = words.filter((w) => new RegExp('\\b' + esc(w.toLowerCase())).test(text))
  return typed.filter((w) => !typed.some((o) => o !== w && o.toLowerCase().includes(w.toLowerCase()))).slice(0, 4)
}
function runSearch(st, u, q) {
  q = (q || '').trim()
  const out = { query: q, route: 'care', matched: [], topics: [], groups: [], events: [], ideas: [], projects: [], meetings: [], resources: [] }
  if (!q) return out
  let route = routeFor(q)
  const { scored, matched: m0 } = careMatches(q)
  const text = q.toLowerCase()
  const toks = tokens(q)
  const has5 = (blob) => toks.some((t) => new RegExp('\\b' + esc(t.slice(0, 5))).test(blob))
  allGroups(st).forEach((g) => { if (has5([g.name, g.blurb, (g.tags || []).join(' ')].join(' ').toLowerCase())) out.groups.push(groupOut(st, u, g)) })
  DATA.events.filter((e) => new Date(e.starts_at) >= new Date()).forEach((e) => { if (has5([e.title, e.blurb, (e.tags || []).join(' ')].join(' ').toLowerCase())) out.events.push(eventOut(st, u, e)) })
  out.events.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  DATA.ideas.forEach((i) => { if (toks.some((t) => (i.title + ' ' + i.body).toLowerCase().includes(t.slice(0, 5)))) out.ideas.push(ideaOut(st, u, i)) })
  DATA.projects.forEach((p) => { if (toks.some((t) => (p.title + ' ' + p.summary).toLowerCase().includes(t.slice(0, 5)))) out.projects.push(projectOut(st, u, p)) })
  DATA.meetings.forEach((x) => { if (toks.some((t) => (x.title + ' ' + x.blurb).toLowerCase().includes(t.slice(0, 5)))) out.meetings.push(meetingOut(st, u, x)) })
  DATA.resources.forEach((r) => {
    const blob = [r.title, r.description, (r.tags || []).join(' ')].join(' ').toLowerCase()
    if (toks.some((t) => t.length >= 4 && blob.includes(t.slice(0, 5)))) out.resources.push(resourceOut(st, u, r))
  })
  out.resources = out.resources.slice(0, 6)
  if (route === 'people' && !(out.groups.length || out.events.length)) route = scored.length ? 'care' : 'people'
  if (route === 'care' && !scored.length && (out.groups.length || out.events.length)) route = 'people'
  const asksProjects = PROJECT_INTENT.test(q) && !/\b(sidewalk|pothole|unsafe|dark)\b/i.test(text)
  const asksEvents = EVENT_INTENT.test(q) && !asksProjects
  if (asksProjects) { out.projects = DATA.projects.map((p) => projectOut(st, u, p)); out.ideas = []; route = 'voice' }
  else if (asksEvents) { out.events = upcoming(st, u, 8); route = 'people' }
  out.route = route
  let matched = m0
  if (route === 'voice') matched = hits(text, VOICE_WORDS)
  else if (route === 'people') { const ph = hits(text, PEOPLE_WORDS); if (ph.length) matched = ph }
  out.matched = tidy(text, matched)
  scored.slice(0, 3).forEach(([, t, h], k) => { const d = topicOut(t); d.open = k === 0; d.matched = h.slice(0, 3); out.topics.push(d) })
  return out
}

// ---------------------------------------------------------------- routes
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CATS = ['sidewalk', 'lighting', 'crossing', 'trail', 'park', 'other']
const CALENDAR_URL = 'https://www.forsythco.com/calendar/?event_category=165'
const PROJECTS_URL = 'https://www.forsythco.com/Capital-Projects/Parks-and-Recreation-Projects'
/** Events in the next 7 days; if there are none, the next few. Same rule as the Python server. */
const upcoming = (st, u, n) => {
  const now = new Date()
  const all = DATA.events.map((e) => eventOut(st, u, e)).filter((e) => new Date(e.starts_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const week = all.filter((e) => new Date(e.starts_at) < new Date(now.getTime() + 7 * 86400000)).slice(0, n)
  return week.length ? week : all.slice(0, Math.min(n, 3))
}

async function handle(method, path, query, body, token) {
  const st = await load()
  let u = null
  if (token && token.startsWith('demo-')) u = byId(st.users, parseInt(token.slice(5), 10)) || null
  const need = () => u || fail(401, 'Please sign in')
  const admin = () => { need(); if (!u.is_admin) fail(403, 'County staff only'); return u }
  const is = (m, re) => method === m && re.test(path)
  const seg = path.split('/')

  if (is('GET', /^\/health$/)) return { ok: true, time: new Date().toISOString() }

  if (is('POST', /^\/auth\/register$/)) {
    if (!EMAIL.test(body.email || '')) fail(422, 'email: value is not a valid email address')
    if (!body.password || body.password.length < 8) fail(422, 'password: String should have at least 8 characters')
    if (!body.name || !body.name.trim()) fail(422, 'name: String should have at least 1 character')
    const email = body.email.toLowerCase()
    if (st.users.some((x) => x.email === email)) fail(409, 'An account with that email already exists')
    const nu = { id: st.nextUser++, email, name: body.name.trim(), pw: await sha(email + ':' + body.password), tagline: '', neighborhood: body.neighborhood || '', area: AREAS.includes(body.area) ? body.area : 'Central', is_admin: false }
    st.users.push(nu); persist()
    return { token: 'demo-' + nu.id, user: userOut(nu) }
  }
  if (is('POST', /^\/auth\/login$/)) {
    const email = (body.email || '').toLowerCase()
    const found = st.users.find((x) => x.email === email)
    if (!found || found.pw !== (await sha(email + ':' + (body.password || '')))) fail(401, 'Email or password is not right')
    return { token: 'demo-' + found.id, user: userOut(found) }
  }
  if (is('GET', /^\/me$/)) return userOut(need())
  if (is('PATCH', /^\/me$/)) {
    need()
    for (const k of ['name', 'tagline', 'neighborhood']) if (typeof body[k] === 'string') u[k] = body[k]
    if (AREAS.includes(body.area)) u.area = body.area
    persist(); return userOut(u)
  }

  if (is('GET', /^\/search$/)) return runSearch(st, u, query.get('q'))
  if (is('GET', /^\/home$/)) return { suggestions: ['New parent', 'Dad, 72, staying active', 'Food on a budget', 'Moving to Forsyth'], events: upcoming(st, u, 3), calendar_url: CALENDAR_URL }
  if (is('GET', /^\/topics$/)) return [...DATA.topics].sort((a, b) => a.sort - b.sort).map((t) => topicOut(t))
  if (is('GET', /^\/popular$/)) {
    const slugs = ['health-department-immunizations', 'the-place-of-forsyth-food-pantry']
    return { searches: ['Flu shots', 'Food pantries', 'Start jogging again', 'Counseling for teens', 'Senior fitness'], items: DATA.resources.filter((r) => slugs.includes(r.slug)).map((r) => resourceOut(st, u, r)) }
  }
  if (method === 'GET' && seg[1] === 'options' && seg[2]) {
    const o = DATA.options.find((x) => x.slug === seg[2])
    if (!o) fail(404, 'Option not found')
    const tags = query.getAll('tag')
    const all = DATA.resources.filter((r) => r.option === o.slug).sort((a, b) => a.sort - b.sort)
    const res = tags.length ? all.filter((r) => tags.every((t) => (r.tags || []).includes(t))) : all
    return { ...optionBrief(o), topic: topicOut(DATA.topics.find((t) => t.slug === o.topic), false), tags: [...new Set(all.flatMap((r) => r.tags || []))].sort(), resources: res.map((r) => resourceOut(st, u, r)) }
  }

  if (is('GET', /^\/people$/)) {
    return { groups: [...allGroups(st)].sort((a, b) => b.base_members - a.base_members).map((g) => groupOut(st, u, g)), events: upcoming(st, u, 8), calendar_url: CALENDAR_URL, challenge: challengeOut(st, u) }
  }
  if (is('POST', /^\/groups$/)) {
    need()
    if (!body.name || body.name.trim().length < 3) fail(422, 'name: String should have at least 3 characters')
    const g = { id: st.nextGroup++, slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: body.name.trim(), blurb: body.blurb || '', next_meeting: body.next_meeting || '', base_members: 0, teen_safe: false, tags: [], verified: false }
    st.extraGroups.push(g); st.members.push({ uid: u.id, gid: g.id }); persist()
    return groupOut(st, u, g)
  }
  if (method === 'POST' && seg[1] === 'groups' && seg[3] === 'join') {
    need()
    const g = allGroups(st).find((x) => x.id === +seg[2]) || fail(404, 'Group not found')
    const i = st.members.findIndex((x) => x.gid === g.id && x.uid === u.id)
    if (i >= 0) st.members.splice(i, 1); else st.members.push({ uid: u.id, gid: g.id })
    persist(); return groupOut(st, u, g)
  }
  if (method === 'POST' && seg[1] === 'events' && seg[3] === 'rsvp') {
    need()
    const e = DATA.events.find((x) => x.id === +seg[2]) || fail(404, 'Event not found')
    const i = st.rsvps.findIndex((x) => x.eid === e.id && x.uid === u.id)
    if (i >= 0) st.rsvps.splice(i, 1); else st.rsvps.push({ uid: u.id, eid: e.id })
    persist(); return eventOut(st, u, e)
  }
  if (is('POST', /^\/challenge\/log$/)) {
    need()
    if (!(body.miles > 0 && body.miles <= 50)) fail(422, 'miles: Input should be greater than 0')
    st.logs.push({ uid: u.id, miles: body.miles }); persist(); return challengeOut(st, u)
  }

  if (is('GET', /^\/voice$/)) {
    const anns = [...DATA.announcements, ...st.announcements].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 4)
    return { announcements: anns.map(annOut), ideas: DATA.ideas.map((i) => ideaOut(st, u, i)), projects: DATA.projects.map((p) => projectOut(st, u, p)), projects_url: PROJECTS_URL, meetings: DATA.meetings.map((x) => meetingOut(st, u, x)) }
  }
  if (is('POST', /^\/issues$/)) {
    need()
    if (!body.title || body.title.trim().length < 3) fail(422, 'title: String should have at least 3 characters')
    let code
    do { code = 'MHD-' + (1000 + Math.floor(Math.random() * 9000)) } while (st.issues.some((x) => x.code === code))
    const cat = CATS.includes(body.category) ? body.category : 'other'
    const x = { code, uid: u.id, title: body.title.trim(), description: body.description || '', category: cat, location: body.location || '', area: u.area, status: st.catStatus[cat] || 'Sent', created_at: new Date().toISOString() }
    st.issues.push(x); persist(); return issueOut(st, u, x)
  }
  if (is('GET', /^\/issues$/)) { need(); return st.issues.filter((x) => x.uid === u.id).reverse().map((x) => issueOut(st, u, x)) }
  if (method === 'GET' && seg[1] === 'issues' && seg[2]) {
    need()
    const x = st.issues.find((y) => y.code === seg[2])
    if (!x || (x.uid !== u.id && !u.is_admin)) fail(404, 'Report not found')
    return issueOut(st, u, x)
  }
  if (method === 'POST' && seg[1] === 'ideas' && seg[3] === 'vote') {
    need()
    if (!['support', 'concern'].includes(body.stance)) fail(422, 'stance: Input should be support or concern')
    const i = DATA.ideas.find((x) => x.id === +seg[2]) || fail(404, 'Idea not found')
    const row = st.votes.find((v) => v.iid === i.id && v.uid === u.id)
    if (row && row.stance === body.stance) st.votes.splice(st.votes.indexOf(row), 1)
    else if (row) row.stance = body.stance
    else st.votes.push({ iid: i.id, uid: u.id, stance: body.stance })
    persist(); return ideaOut(st, u, i)
  }

  if (is('GET', /^\/county\/pulse$/)) {
    admin()
    const byArea = AREAS.map((a) => ({ area: a, count: DATA.issue_matrix.filter((x) => x.area === a).reduce((n, x) => n + x.n, 0) + st.issues.filter((y) => y.area === a).length }))
    const cats = {}
    DATA.issue_matrix.forEach((x) => { cats[x.category] = (cats[x.category] || 0) + x.n })
    st.issues.forEach((y) => { cats[y.category] = (cats[y.category] || 0) + 1 })
    const total = byArea.reduce((n, a) => n + a.count, 0)
    const fixedBase = DATA.issue_matrix.filter((x) => st.catStatus[x.category] === 'Fixed').reduce((n, x) => n + x.n, 0)
    const fixedUser = st.issues.filter((y) => y.status === 'Fixed').length
    return { total_reports: total, open_reports: total - fixedBase - fixedUser, by_area: byArea,
      by_category: Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })),
      ideas: DATA.ideas.map((i) => ideaOut(st, u, i)), estimated_reach: st.users.length }
  }
  if (is('POST', /^\/county\/updates$/)) {
    admin()
    if (!body.title || body.title.trim().length < 3) fail(422, 'title: String should have at least 3 characters')
    const a = { id: st.nextAnn++, title: body.title, body: body.body || '', source_url: '', published_at: new Date().toISOString(), official: true, verified: false }
    st.announcements.push(a)
    let changed = 0
    if (body.category && body.set_status) {
      st.catStatus[body.category] = body.set_status
      changed = baseCount('North', body.category) + baseCount('West', body.category) + baseCount('Central', body.category) + baseCount('South', body.category)
      st.issues.forEach((y) => { if (y.category === body.category && y.status !== 'Fixed') { y.status = body.set_status; changed += 1 } })
    }
    persist(); return { announcement: annOut(a), reports_updated: changed }
  }

  const types = { resource: DATA.resources, group: null, event: DATA.events, idea: DATA.ideas, project: DATA.projects, meeting: DATA.meetings }
  const exists = (type, id) => (type === 'group' ? allGroups(st) : types[type] || []).some((x) => x.id === id)
  if (is('PUT', /^\/saved$/)) {
    need()
    if (!(body.type in types)) fail(422, 'type: Input should be resource, group, event, idea, project or meeting')
    if (!exists(body.type, body.id)) fail(404, 'Nothing to save')
    if (!st.saved.some((s) => s.uid === u.id && s.type === body.type && s.id === body.id)) { st.saved.unshift({ uid: u.id, type: body.type, id: body.id }); persist() }
    return { saved: true }
  }
  if (method === 'DELETE' && seg[1] === 'saved') {
    need()
    st.saved = st.saved.filter((s) => !(s.uid === u.id && s.type === seg[2] && s.id === +seg[3])); persist()
    return { saved: false }
  }
  if (is('GET', /^\/mystuff$/)) {
    need()
    const out = { communities: [], projects: [], events: [], options: [] }
    for (const s of st.saved.filter((x) => x.uid === u.id)) {
      if (s.type === 'group') out.communities.push(groupOut(st, u, allGroups(st).find((g) => g.id === s.id)))
      else if (s.type === 'idea') out.projects.push(ideaOut(st, u, byId(DATA.ideas, s.id)))
      else if (s.type === 'project') out.projects.push(projectOut(st, u, byId(DATA.projects, s.id)))
      else if (s.type === 'event') out.events.push(eventOut(st, u, byId(DATA.events, s.id)))
      else if (s.type === 'meeting') out.events.push(meetingOut(st, u, byId(DATA.meetings, s.id)))
      else if (s.type === 'resource') out.options.push(resourceOut(st, u, byId(DATA.resources, s.id)))
    }
    out.counts = { communities: out.communities.length, projects: out.projects.length, events: out.events.length, options: out.options.length }
    out.counts.all = out.counts.communities + out.counts.projects + out.counts.events + out.counts.options
    out.profile = userOut(u)
    return out
  }
  fail(404, 'Not found')
}

/** Drop-in replacement for fetch() that answers /api/... requests. */
export async function demoFetch(url, init = {}) {
  const u = new URL(url, 'http://demo.local')
  const method = (init.method || 'GET').toUpperCase()
  const auth = (init.headers && init.headers.Authorization) || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const body = init.body ? JSON.parse(init.body) : {}
  try {
    const data = await handle(method, u.pathname.replace(/^\/api/, ''), u.searchParams, body, token)
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    if (e instanceof HttpError) return new Response(JSON.stringify({ detail: e.detail }), { status: e.status, headers: { 'Content-Type': 'application/json' } })
    throw e
  }
}
