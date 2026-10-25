import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { Logo } from '../components/Logo.jsx'

export function AuthSide() {
  return (
    <aside className="auth-side">
      <span className="brand"><Logo size={44} /></span>
      <h1>Your neighbors, your care, your voice.</h1>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li>Describe what’s going on and see the options in Forsyth County.</li>
        <li>Find people, groups and events that fit you.</li>
        <li>Report a problem, back an idea, and watch it get built.</li>
      </ul>
      <p className="small" style={{ color: '#d6ebe5' }}>A student project. Not an official Forsyth County service.</p>
    </aside>
  )
}

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      nav(loc.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <AuthSide />
      <div className="auth-main">
        <form className="auth-form" onSubmit={submit} aria-labelledby="login-title">
          <h2 id="login-title" style={{ fontSize: 32 }}>Sign in</h2>
          {error && <p className="error" role="alert">{error}</p>}
          <label className="field">Email
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">Password
            <div className="row">
              <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn ghost sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="mute">New here? <Link to="/register">Create an account</Link></p>
          <div className="notice">
            <b>Try the demo:</b> maya@example.com · MayaDemo2026!
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm ghost" onClick={() => { setEmail('maya@example.com'); setPassword('MayaDemo2026!') }}>Fill in Maya</button>
              <button type="button" className="btn sm ghost" onClick={() => { setEmail('county@example.com'); setPassword('CountyDemo2026!') }}>Fill in county staff</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
