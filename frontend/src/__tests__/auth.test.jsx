import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fail, mockApi, maya, renderApp } from './helpers.jsx'

describe('login screens', () => {
  it('sends a signed-out visitor to the sign in page', async () => {
    mockApi({})
    renderApp('/care')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the server error when the password is wrong', async () => {
    mockApi({ 'POST /api/auth/login': fail(401, 'Email or password is not right') })
    renderApp('/login')
    await userEvent.type(screen.getByLabelText('Email'), 'maya@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'nope-nope')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is not right')
    expect(localStorage.getItem('mhd_token')).toBeNull()
  })

  it('stores the token and opens the home page after signing in', async () => {
    const calls = mockApi({
      'POST /api/auth/login': { token: 'abc', user: maya },
      'GET /api/home': { suggestions: [], events: [] },
    })
    renderApp('/login')
    await userEvent.click(screen.getByRole('button', { name: 'Fill in Maya' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: /Hi Maya/ })).toBeInTheDocument()
    expect(localStorage.getItem('mhd_token')).toBe('abc')
    expect(calls[0].body).toEqual({ email: 'maya@example.com', password: 'MayaDemo2026!' })
  })

  it('checks the password length before calling the server when registering', async () => {
    const calls = mockApi({})
    renderApp('/register')
    await userEvent.type(screen.getByLabelText('First name'), 'Tess')
    await userEvent.type(screen.getByLabelText('Email'), 'tess@example.com')
    await userEvent.type(screen.getByLabelText(/Password/), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(calls).toHaveLength(0)
  })

  it('signs out and returns to the sign in page', async () => {
    localStorage.setItem('mhd_token', 'abc')
    mockApi({ 'GET /api/me': maya, 'GET /api/home': { suggestions: [], events: [] } })
    renderApp('/')
    await screen.findByRole('heading', { name: /Hi Maya/ })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument())
    expect(localStorage.getItem('mhd_token')).toBeNull()
  })
})
