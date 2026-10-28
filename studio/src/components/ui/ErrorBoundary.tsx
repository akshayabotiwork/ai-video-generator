import React, { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          padding: '24px',
          background: '#0f172a',
          color: '#f8fafc',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <span style={{ fontSize: '36px', marginBottom: '8px' }}>⚠️</span>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Component Rendering Error</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected DOM error occurred.'}
          </p>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: '#5b6ef5',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            🔄 Reload Component
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
