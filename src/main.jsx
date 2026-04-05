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
    console.error('[TaxLift crash]', error, info?.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 720, margin: '60px auto' }}>
          <h2 style={{ color: '#dc2626', marginBottom: 12 }}>⚠️ Something went wrong</h2>
          <pre style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Try again
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
