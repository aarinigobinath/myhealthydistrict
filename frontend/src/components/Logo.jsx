import { useId } from 'react'

/** The MyHealthyDistrict mark: a map pin (your district) holding a heart (your health). */
export function LogoMark({ size = 34 }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id={`lg${id}`} x1="8" y1="2" x2="32" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a8b80" />
          <stop offset="1" stopColor="#0f4a47" />
        </linearGradient>
      </defs>
      <path d="M20 38.5S4.5 26 4.5 15.6a15.5 15.5 0 0 1 31 0C35.5 26 20 38.5 20 38.5z" fill={`url(#lg${id})`} />
      <path d="M20 23.6s-7.9-4.9-7.9-10.1a4.2 4.2 0 0 1 7.9-1.9 4.2 4.2 0 0 1 7.9 1.9c0 5.2-7.9 10.1-7.9 10.1z" fill="#fff" />
      <path d="M13.6 14.6h3.4l1.3-2.5 2.2 4.6 1.5-2.1h3.4" fill="none" stroke="#e0694a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark"><span className="wm-my">My</span><span className="wm-h">Healthy</span><span className="wm-d">District</span></span>
  )
}

export function Logo({ size = 34 }) {
  return <><LogoMark size={size} /><Wordmark /></>
}
