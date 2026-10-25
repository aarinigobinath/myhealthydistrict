import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { maya, mockApi, renderApp } from './helpers.jsx'

const topic = (open) => ({ slug: 'recovery-rehab', title: 'Recovery & Rehab', icon: 'bandage', open, matched: ['surgery'],
  options: [{ slug: 'remote-learning', title: 'Remote learning options', summary: 's', layout: 'cards' }, { slug: 'physical-therapy', title: 'Physical therapy clinics', summary: '', layout: 'cards' }] })

const search = { query: 'q', route: 'care', matched: ['surgery', 'high schooler'], groups: [], events: [], ideas: [], projects: [], meetings: [], resources: [],
  topics: [topic(true), { ...topic(false), slug: 'mental-wellbeing', title: 'Mental Wellbeing', options: [{ slug: 'x', title: 'Peer groups', summary: '', layout: 'cards' }] }] }

const resource = (over) => ({ type: 'resource', id: 1, slug: 'a', title: 'Join your class by video', description: 'd', good_if: 'you can focus', address: '', phone: '', hours: '', url: '', source_url: '', tags: [], sample: true, saved: false, ...over })

beforeEach(() => localStorage.setItem('mhd_token', 'abc'))

describe("Maya's flow", () => {
  it('routes a sentence to the Care results with "Because you said" and an open group', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/search': search })
    renderApp('/search?q=knee%20surgery')
    expect(await screen.findByText(/Because you said “surgery” and “high schooler”/)).toBeInTheDocument()
    const cards = screen.getAllByTestId('topic-card')
    expect(within(cards[0]).getByRole('link', { name: /Remote learning options/ })).toHaveAttribute('href', expect.stringContaining('/care/option/remote-learning'))
    expect(within(cards[1]).queryByRole('link')).toBeNull() // second group starts closed
    await userEvent.click(within(cards[1]).getByRole('button', { name: /Mental Wellbeing/ }))
    expect(within(cards[1]).getByRole('link', { name: /Peer groups/ })).toBeInTheDocument()
  })

  it('sends voice-style sentences to the Voice tab with a Suggest this button', async () => {
    mockApi({
      'GET /api/me': maya,
      'GET /api/search': { ...search, route: 'voice', topics: [] },
      'GET /api/voice': { announcements: [], ideas: [], projects: [], meetings: [] },
    })
    renderApp('/search?q=no%20sidewalk')
    const btn = await screen.findByRole('link', { name: 'Suggest this' })
    expect(btn).toHaveAttribute('href', expect.stringContaining('/voice/report?title=no%20sidewalk'))
  })

  it('saves an option to MyStuff with the bookmark button and rolls back when the save fails', async () => {
    const calls = mockApi({
      'GET /api/me': maya,
      'GET /api/options/remote-learning': { slug: 'remote-learning', title: 'Remote learning options', summary: 's', layout: 'cards', tags: [], topic: {}, resources: [resource(), resource({ id: 2, title: 'Second' })] },
      'PUT /api/saved': (b) => (b.id === 2 ? { __status: 500, body: { detail: 'boom' } } : { saved: true }),
    })
    renderApp('/care/option/remote-learning')
    await screen.findByRole('heading', { name: 'Remote learning options' })
    const [one, two] = screen.getAllByTestId('resource-card')
    await userEvent.click(within(one).getByRole('button', { name: 'Save to MyStuff' }))
    expect(await within(one).findByRole('button', { name: 'Saved to MyStuff' })).toHaveAttribute('aria-pressed', 'true')
    expect(calls.find((c) => c.method === 'PUT').body).toEqual({ type: 'resource', id: 1 })
    await userEvent.click(within(two).getByRole('button', { name: 'Save to MyStuff' }))
    expect(await within(two).findByRole('button', { name: 'Save to MyStuff' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the jogging track locator by tag and marks invented items as Sample', async () => {
    const calls = mockApi({
      'GET /api/me': maya,
      'GET /api/options/jogging-track-locator': { slug: 'jogging-track-locator', title: 'Jogging track locator', summary: 's', layout: 'map', tags: ['paved', 'trail'], topic: {}, resources: [resource({ title: 'Big Creek Greenway', sample: false, tags: ['paved'] })] },
    })
    renderApp('/care/option/jogging-track-locator')
    await screen.findByText('Big Creek Greenway')
    expect(within(screen.getByTestId('resource-card')).queryByText('Sample')).not.toBeInTheDocument() // real, sourced item
    await userEvent.click(screen.getByRole('button', { name: 'Paved' }))
    await screen.findByText('Big Creek Greenway')
    expect(calls.some((c) => c.url.includes('tag=paved'))).toBe(true)
  })

  it('shows the MyStuff empty state, then the saved lists', async () => {
    mockApi({ 'GET /api/me': maya, 'GET /api/mystuff': { profile: maya, counts: { all: 0, communities: 0, projects: 0, events: 0, options: 0 }, communities: [], projects: [], events: [], options: [] } })
    renderApp('/mystuff')
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument()
  })

  it('blocks residents from the county dashboard', async () => {
    mockApi({ 'GET /api/me': maya })
    renderApp('/county')
    expect(await screen.findByRole('alert')).toHaveTextContent('County staff only')
  })
})
