import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import './styles.css'

// The preview runs inside a page frame, so it keeps its own page history instead of the address bar.
const Router = import.meta.env.VITE_DEMO ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
)
