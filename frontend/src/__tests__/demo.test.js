// The browser-only preview must answer like the real API. These mirror backend/tests/test_api_flow.py.
import { demoFetch, resetDemo } from '../demo/mockApi.js'

const call = async (method, path, body, token) => {
  const r = await demoFetch('/api' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: token ? { Authorization: 'Bearer ' + token } : {} })
  return { status: r.status, data: await r.json() }
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token

beforeEach(async () => { await resetDemo() })

describe('browser preview API', () => {
  it('routes the story sentences to the right tab', async () => {
    const route = async (q) => (await call('GET', '/search?q=' + encodeURIComponent(q))).data
    const a = await route('I’m a high schooler, stuck in bed after knee surgery')
    expect(a.route).toBe('care')
    expect(a.topics[0].slug).toBe('recovery-rehab')
    expect(a.matched).toContain('surgery')
    expect((await route('I want to start jogging again')).topics[0].slug).toBe('move-exercise')
    expect((await route('find a running group')).route).toBe('people')
    const v = await route('the road to the park has no sidewalk')
    expect(v.route).toBe('voice')
    expect(v.ideas.length).toBeGreaterThan(0)
  })

  it('has the same login rules', async () => {
    expect((await call('POST', '/auth/login', { email: 'maya@example.com', password: 'nope-nope' })).status).toBe(401)
    expect((await call('POST', '/auth/register', { email: 'a@b.co', password: 'short', name: 'A' })).status).toBe(422)
    const ok = await call('POST', '/auth/register', { email: 'tess@example.com', password: 'longenough1', name: 'Tess', area: 'North' })
    expect(ok.status).toBe(200)
    expect((await call('POST', '/auth/register', { email: 'TESS@example.com', password: 'longenough1', name: 'Tess' })).status).toBe(409)
    expect((await call('GET', '/me')).status).toBe(401)
    expect((await call('GET', '/me', null, ok.data.token)).data.area).toBe('North')
  })

  it('serves the sourced options and filters', async () => {
    const o = (await call('GET', '/options/remote-learning')).data
    expect(o.resources.length).toBeGreaterThanOrEqual(3)
    const all = (await call('GET', '/options/jogging-track-locator')).data
    const paved = (await call('GET', '/options/jogging-track-locator?tag=paved')).data
    expect(paved.resources.length).toBeGreaterThan(0)
    expect(paved.resources.length).toBeLessThan(all.resources.length)
  })

  it('saves, joins, votes and logs miles for Maya', async () => {
    const t = await login('maya@example.com', 'MayaDemo2026!')
    const people = (await call('GET', '/people', null, t)).data
    expect(people.challenge.areas.find((a) => a.name === 'West').percent).toBe(76)
    const g = people.groups.find((x) => x.slug === 'weekend-runners-club')
    const joined = (await call('POST', `/groups/${g.id}/join`, null, t)).data
    expect(joined.members).toBe(g.members + 1)
    const res = (await call('GET', '/options/jogging-track-locator', null, t)).data.resources[0]
    await call('PUT', '/saved', { type: 'resource', id: res.id }, t)
    const stuff = (await call('GET', '/mystuff', null, t)).data
    expect(stuff.counts.options).toBe(1)
    const idea = (await call('GET', '/voice', null, t)).data.ideas[0]
    expect((await call('POST', `/ideas/${idea.id}/vote`, { stance: 'support' }, t)).data.support).toBe(idea.support + 1)
    expect((await call('POST', '/challenge/log', { miles: 3 }, t)).data.my_miles).toBe(9.2)
  })

  it('lets county staff answer a report and residents see the new status', async () => {
    const t = await login('maya@example.com', 'MayaDemo2026!')
    const c = await login('county@example.com', 'CountyDemo2026!')
    const issue = (await call('POST', '/issues', { title: 'No sidewalk to the park', category: 'sidewalk' }, t)).data
    expect(issue.code).toMatch(/^MHD-\d{4}$/)
    expect(issue.similar_count).toBeGreaterThanOrEqual(25)
    expect((await call('GET', '/county/pulse', null, t)).status).toBe(403)
    const pulse = (await call('GET', '/county/pulse', null, c)).data
    expect(pulse.by_area.find((a) => a.area === 'West').count).toBe(Math.max(...pulse.by_area.map((a) => a.count)))
    const out = (await call('POST', '/county/updates', { title: 'Sidewalk approved', category: 'sidewalk', set_status: 'Planned' }, c)).data
    expect(out.reports_updated).toBeGreaterThanOrEqual(25)
    expect((await call('GET', `/issues/${issue.code}`, null, t)).data.status).toBe('Planned')
  })
})

describe('browser preview matches the Oct 2026 corrections', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T15:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('has no video option, uses the two official school links, and starts jogging without Recovery & Rehab', async () => {
    const o = (await call('GET', '/options/remote-learning')).data
    expect(o.resources.map((r) => r.title).join(' ')).not.toMatch(/video/i)
    const by = Object.fromEntries(o.resources.map((r) => [r.slug, r]))
    expect(by['georgia-virtual-school'].url).toBe('https://gavs.geniussis.com/PublicStudentAdd.aspx')
    expect(by['forsyth-virtual-academy'].url).toBe('https://ace.forsyth.k12.ga.us/forsyth-virtual-academy/our-program')
    const s = (await call('GET', '/search?q=' + encodeURIComponent('I want to start jogging again'))).data
    expect(s.topics.map((t) => t.slug)).toEqual(['move-exercise'])
  })

  it('gives every jogging place an official county page and a Google Maps search', async () => {
    const o = (await call('GET', '/options/jogging-track-locator')).data
    expect(o.resources.length).toBeGreaterThanOrEqual(10)
    for (const r of o.resources) {
      expect(r.url).toMatch(/^https:\/\/www\.forsythco\.com\/locations\/.+\/$/)
      expect(r.map_query).toContain('Cumming')
    }
  })

  it('lists real events this week, real county projects, and the official calendar link', async () => {
    const t = await login('maya@example.com', 'MayaDemo2026!')
    const home = (await call('GET', '/home', null, t)).data
    expect(home.events.length).toBeGreaterThan(0)
    expect(home.events.every((e) => !e.sample && e.source_url.startsWith('https://'))).toBe(true)
    expect(home.calendar_url).toBe('https://www.forsythco.com/calendar/?event_category=165')
    expect(home.events.some((e) => /NAMI|Jazzercise|Yoga/.test(e.title))).toBe(true)
    const v = (await call('GET', '/voice', null, t)).data
    expect(v.projects.some((p) => p.status.startsWith('Completed'))).toBe(true)
    expect(v.projects.some((p) => !p.status.startsWith('Completed'))).toBe(true)
    expect(v.announcements).toHaveLength(4)
  })
})
