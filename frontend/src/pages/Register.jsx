import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { AuthSide } from './Login.jsx'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '', neighborhood: '', area: 'Central' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (f.password.length < 8) return setError('Use at least 8 characters for your password')
    setBusy(true)
    try {
      await register({ ...f, email: f.email.trim(), name: f.name.trim() })
      nav('/', { replace: true })
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
        <form className="auth-form" onSubmit={submit} aria-labelledby="reg-title">
          <h2 id="reg-title" style={{ fontSize: 32 }}>Create your account</h2>
          {error && <p className="error" role="alert">{error}</p>}
          <label className="field">First name
            <input className="input" required autoComplete="given-name" value={f.name} onChange={set('name')} />
          </label>
          <label className="field">Email
            <input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
          </label>
          <label className="field">Password (8+ characters)
            <input className="input" type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} />
          </label>
          <label className="field">Neighborhood (optional)
            <input className="input" value={f.neighborhood} onChange={set('neighborhood')} />
          </label>
          <label className="field">Part of the county
            <select className="input" value={f.area} onChange={set('area')}>
              {['North', 'West', 'Central', 'South'].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <p className="small mute">We only keep what you type here. Your saved items are private to you.</p>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="mute">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  )
}
