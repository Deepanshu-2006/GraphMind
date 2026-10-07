import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('GraphMind caught an uncaught display error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    // Safely reset URL search params and reload if necessary
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0A0A0A',
            color: '#EEEEEE',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '24px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '32px',
              background: '#121212',
              border: '1px solid #222222',
              borderRadius: '8px'
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                color: '#A3FF12',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '12px'
              }}
            >
              GraphMind · Workspace
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 12px 0', color: '#FFFFFF' }}>
              Workspace Encountered an Error
            </h2>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#888888', margin: '0 0 24px 0' }}>
              The workspace encountered a temporary display issue. Your knowledge graphs, sources, and study progress are safe in storage.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: '#1A1A1A',
                  color: '#EEEEEE',
                  border: '1px solid #333333',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                style={{
                  background: '#A3FF12',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Return to Overview
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
