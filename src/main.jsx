import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    // Log to console for debugging — no stack trace shown to users
    console.error('[TaxLift]', error?.message, info?.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh',
          background: '#f8fafc', padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
          <h2 style={{ color: '#1e293b', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, maxWidth: 400, marginBottom: 24, lineHeight: 1.6 }}>
            We hit an unexpected error. Try refreshing — if it keeps happening,
            reach out to <a href="mailto:support@taxlift.ai" style={{ color: '#4f46e5' }}>support@taxlift.ai</a>.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
