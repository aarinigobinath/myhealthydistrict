import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())

  useEffect(() => {
    if (!getToken()) return
    api('/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const finish = (data) => { setToken(data.token); setUser(data.user); return data.user }
  const value = {
    user, ready,
    login: async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (form) => finish(await api('/auth/register', { method: 'POST', body: form })),
    logout: () => { setToken(null); setUser(null) },
    updateUser: setUser,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
