import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { CountyProvider } from './county.jsx'
import { Layout } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import SearchRouter from './pages/SearchRouter.jsx'
import Results from './pages/Results.jsx'
import OptionPage from './pages/OptionPage.jsx'
import Care, { TopicPage } from './pages/Care.jsx'
import People from './pages/People.jsx'
import Voice from './pages/Voice.jsx'
import Report, { MyReports } from './pages/Report.jsx'
import Ideas from './pages/Ideas.jsx'
import County from './pages/County.jsx'
import MyStuff from './pages/MyStuff.jsx'
import Assistant from './pages/Assistant.jsx'

function Protected({ children }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <p role="status" style={{ padding: 24 }}>Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { user, ready } = useAuth()
  return (
    <CountyProvider>
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={ready && user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/search" element={<Protected><SearchRouter /></Protected>} />
      <Route path="/care" element={<Protected><Care /></Protected>} />
      <Route path="/care/results" element={<Protected><Results /></Protected>} />
      <Route path="/care/topic/:slug" element={<Protected><TopicPage /></Protected>} />
      <Route path="/care/option/:slug" element={<Protected><OptionPage /></Protected>} />
      <Route path="/people" element={<Protected><People /></Protected>} />
      <Route path="/voice" element={<Protected><Voice /></Protected>} />
      <Route path="/voice/report" element={<Protected><Report /></Protected>} />
      <Route path="/voice/reports" element={<Protected><MyReports /></Protected>} />
      <Route path="/voice/ideas" element={<Protected><Ideas /></Protected>} />
      <Route path="/county" element={<Protected><County /></Protected>} />
      <Route path="/assistant" element={<Protected><Assistant /></Protected>} />
      <Route path="/mystuff" element={<Protected><MyStuff /></Protected>} />
      <Route path="*" element={<Protected><h1>Page not found</h1></Protected>} />
    </Routes>
    </CountyProvider>
  )
}
