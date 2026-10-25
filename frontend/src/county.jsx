import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'

/** Counties near Forsyth. The site only has Forsyth information, whichever one is picked. */
export const COUNTIES = ['Forsyth', 'Cherokee', 'Dawson', 'Fulton', 'Gwinnett', 'Hall', 'Cobb', 'Lumpkin']
export const HOME_COUNTY = 'Forsyth'

const Ctx = createContext({ county: HOME_COUNTY, setCounty: () => {} })
export const useCounty = () => useContext(Ctx)

export function CountyProvider({ children }) {
  const { user } = useAuth()
  const [county, setCounty] = useState(HOME_COUNTY)
  // Every sign-in (and sign-out) starts on Forsyth.
  useEffect(() => setCounty(HOME_COUNTY), [user?.id])
  return <Ctx.Provider value={{ county, setCounty }}>{children}</Ctx.Provider>
}
