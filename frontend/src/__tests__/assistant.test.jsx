import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { maya, mockApi, renderApp } from './helpers.jsx'

const topic = { slug: 'move-exercise', title: 'Move & Exercise', icon: 'run', open: true, matched: ['jogging'],
  options: [{ slug: 'jogging-track-locator', title: 'Jogging track locator', summary: '', layout: 'map' }] }
const empty = { query: '', route: 'care', matched: [], topics: [], groups: [], events: [], ideas: [], projects: [], meetings: [], resources: [] }
const event = { type: 'event', id: 7, slug: 'e', title: 'NAMI Connection Support Group', starts_at: '2026-10-27T22:45:00+00:00', location: 'United Way', blurb: '6:45 p.m.',
  going_count: 0, going: false, source_url: 'https://namifdl.org/events/', tags: [], sample: false, saved: false }
const project = { type: 'project', id: 3, slug: 'p', title: 'Freedom Park county administration campus', status: 'Completed · March 2026', summary: 's', source_url: 'https://x.test', sample: false, saved: false }

beforeEach(() => localStorage.setItem('mhd_token', 'abc'))

const homeData = { suggestions: [], events: [], calendar_url: '' }
const peoplePage = { groups: [], events: [], calendar_url: 'https://www.forsythco.com/calendar/?event_category=165', challenge: { areas: [], my_area: 'West', my_miles: 0 } }

describe('AI Assistant button', () => {
  it('is a small round button with a caption, bottom right, on every page, and not one of the main tabs', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/home': homeData, 'GET /api/people': peoplePage, 'GET /api/care/topics': [], 'GET /api/voice': { announcements: [], ideas: [], meetings: [], projects: [] } })
    for (const path of ['/', '/people', '/voice']) {
      const { unmount } = renderApp(path)
      const link = await screen.findByRole('link', { name: /AI Assistant/ })
      expect(link).toHaveAttribute('href', '/assistant')
      expect(link).toHaveAttribute('title', 'Click for AI Assistant')
      expect(link).toHaveClass('aifab')
      expect(link).toHaveTextContent('AI Assistant')
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: /Assistant/ })).toBeNull()
      unmount()
    }
  })

  it('keeps all the menu tabs in the one header row, and opens its own page', async () => {
    mockApi({ 'GET /api/me': maya })
    renderApp('/assistant')
    expect(await screen.findByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument()
    const names = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').map((l) => l.getAttribute('aria-label'))
    expect(names).toEqual(['Today', 'Care', 'People', 'Voice', 'MyStuff'])
    expect(screen.queryByRole('link', { name: /AI Assistant: click/ })).toBeNull() // the page itself needs no button
  })
})

describe('AI Assistant answers', () => {
  it('shows the same topic cards as the search results page, and nothing extra like school or other resources', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/search': { ...empty, matched: ['jogging'], topics: [topic],
      resources: [{ type: 'resource', id: 9, title: 'Forsyth Virtual Academy', description: 'x', tags: [] }] } })
    renderApp('/assistant')
    await userEvent.click(await screen.findByRole('button', { name: 'I want to start jogging again' }))
    expect(await screen.findByText(/You said “jogging”/)).toBeInTheDocument()
    expect(within(screen.getByTestId('topic-card')).getByRole('link', { name: /Jogging track locator/ })).toBeInTheDocument()
    expect(screen.queryByText('Forsyth Virtual Academy')).toBeNull()
    expect(screen.queryByTestId('resource-card')).toBeNull()
    expect(screen.getByRole('link', { name: /Open the full results page/ })).toHaveAttribute('href', expect.stringContaining('/care/results?q='))
    expect(screen.getByRole('link', { name: /Browse all health topics/ })).toHaveAttribute('href', '/care')
  })

  it('shows this week’s events like the People page, with the official calendar link, and lets you say you are going', async () => {
    const calls = mockApi({
      'GET /api/me': maya,
      'GET /api/search': { ...empty, route: 'people', matched: ['this week'], events: [event] },
      'GET /api/people': { ...peoplePage, events: [event] },
      'POST /api/events/7/rsvp': { ...event, going: true, going_count: 1 },
    })
    renderApp('/assistant')
    await userEvent.type(await screen.findByLabelText('Ask the AI Assistant', { selector: 'input' }), 'What’s happening this week?{enter}')
    const card = await screen.findByTestId('event-card')
    expect(card).toHaveTextContent('NAMI Connection Support Group')
    expect(screen.getByRole('link', { name: /county events calendar/ })).toHaveAttribute('href', 'https://www.forsythco.com/calendar/?event_category=165')
    await userEvent.click(within(card).getByRole('button', { name: 'I’m going' }))
    expect(await within(screen.getByTestId('event-card')).findByRole('button', { name: 'I’m going ✓' })).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/events/7/rsvp'))).toBe(true)
  })

  it('suggests groups without adding events that do not match, and every group has the same icon', async () => {
    const group = { type: 'group', id: 4, slug: 'g', name: 'Weekend Runners Club', members: 40, next_meeting: 'Sat 8 a.m.', blurb: 'Easy runs', teen_safe: false, joined: false, sample: true, saved: false, tags: [] }
    mockApi({
      'GET /api/me': maya,
      'GET /api/search': { ...empty, route: 'people', matched: ['runners'], groups: [group, { ...group, id: 5, name: 'Walk and Talk' }], events: [] },
      'GET /api/people': { ...peoplePage, groups: [group], events: [event] },
    })
    renderApp('/assistant')
    await userEvent.type(await screen.findByLabelText('Ask the AI Assistant', { selector: 'input' }), 'find runners to join{enter}')
    const cards = await screen.findAllByTestId('group-card')
    expect(cards).toHaveLength(2)
    cards.forEach((c) => expect(c.querySelector('.groupicon svg')).not.toBeNull())
    expect(screen.queryByTestId('event-card')).toBeNull()
    expect(screen.getByText(/Here are groups near you/)).toBeInTheDocument()
  })

  it('answers county project questions with the same project cards as Voice', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/search': { ...empty, route: 'voice', matched: ['building'], projects: [project] } })
    renderApp('/assistant')
    await userEvent.click(await screen.findByRole('button', { name: 'What is the county building?' }))
    expect(await screen.findByTestId('project-card')).toHaveTextContent('Freedom Park county administration campus')
    expect(screen.getByRole('link', { name: /Suggest this to the county/ })).toBeInTheDocument()
  })

  it('shows 988 first when someone mentions hurting themselves, and says so kindly', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/search': { ...empty, topics: [] } })
    renderApp('/assistant')
    await userEvent.type(await screen.findByLabelText('Ask the AI Assistant', { selector: 'input' }), 'I want to hurt myself{enter}')
    expect(await screen.findByRole('note')).toHaveTextContent(/call or text 988/)
  })

  it('says plainly when nothing matches', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/search': empty })
    renderApp('/assistant')
    await userEvent.type(await screen.findByLabelText('Ask the AI Assistant', { selector: 'input' }), 'zzzz{enter}')
    expect(await screen.findByText(/could not find “zzzz”/)).toBeInTheDocument()
  })
})

describe('County dropdown', () => {
  it('starts on Forsyth, lists nearby counties, and keeps showing Forsyth whichever is picked', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/home': homeData })
    renderApp('/')
    const sel = await screen.findByRole('combobox', { name: 'County' })
    expect(sel).toHaveValue('Forsyth')
    expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual(expect.arrayContaining(['Forsyth', 'Cherokee', 'Dawson', 'Fulton', 'Gwinnett', 'Hall']))
    expect(screen.queryByText(/only has Forsyth County information/)).toBeNull()
    await userEvent.selectOptions(sel, 'Gwinnett')
    expect(screen.getByText(/only has Forsyth County information/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hi Maya/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Forsyth' }))
    expect(screen.getByRole('combobox', { name: 'County' })).toHaveValue('Forsyth')
  })
})

describe('Jogging map and links', () => {
  const place = (over) => ({ type: 'resource', id: 1, slug: 'a', title: 'Fowler Park', description: 'd', good_if: '', address: '4110 Carolene Way, Cumming, GA', phone: '', hours: '',
    url: 'https://www.forsythco.com/locations/fowler-park/', source_url: 'https://x.test', map_query: 'Fowler Park, 4110 Carolene Way, Cumming, GA', tags: [], sample: false, saved: false, ...over })

  it('shows a real Google Map, moves it when you pick another place, and links to Google Maps and the park page', async () => {
    mockApi({
      'GET /api/me': maya,
      'GET /api/options/jogging-track-locator': { slug: 'jogging-track-locator', title: 'Jogging track locator', summary: 's', layout: 'map', tags: [], topic: {},
        resources: [place(), place({ id: 2, slug: 'b', title: 'Bennett Park', map_query: 'Bennett Park, 6050 Burruss Mill Rd, Cumming, GA', url: 'https://www.forsythco.com/locations/bennett-park/' })] },
    })
    renderApp('/care/option/jogging-track-locator')
    const frame = await screen.findByTitle('Google Map of Fowler Park')
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/maps\.google\.com\/maps\?output=embed&z=14&q=Fowler/)
    expect(screen.queryByText(/Sketch/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Show Bennett Park on the map' }))
    expect(screen.getByTitle('Google Map of Bennett Park')).toBeInTheDocument()
    const cards = screen.getAllByTestId('resource-card')
    expect(within(cards[0]).getByRole('link', { name: /Open in Google Maps/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Fowler/))
    expect(within(cards[0]).getByRole('link', { name: /Official page/ })).toHaveAttribute('href', 'https://www.forsythco.com/locations/fowler-park/')
    expect(screen.getByRole('link', { name: /Get directions/ })).toHaveAttribute('href', expect.stringContaining('/maps/dir/?api=1&destination=Bennett'))
  })

  it('still shows the map when the server did not send the map search text (uses the name and address)', async () => {
    mockApi({
      'GET /api/me': maya,
      'GET /api/options/jogging-track-locator': { slug: 'jogging-track-locator', title: 'Jogging track locator', summary: 's', layout: 'map', tags: [], topic: {},
        resources: [place({ map_query: '' })] },
    })
    renderApp('/care/option/jogging-track-locator')
    const frame = await screen.findByTitle('Google Map of Fowler Park')
    expect(decodeURIComponent(frame.getAttribute('src'))).toContain('Fowler Park, 4110 Carolene Way, Cumming, GA')
    expect(screen.getAllByRole('link', { name: /Open in Google Maps/ }).length).toBeGreaterThan(0)
  })
})
