import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#050b0d', color: '#ef4444', height: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '20px' }}>Something went wrong.</h1>
          <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>{this.state.error && this.state.error.toString()}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#fca5a5' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
