import { Component } from 'react'

import { ErrorState } from './ErrorState'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorState
            description="Refresh the page once. If it keeps happening, try again in a moment."
            onRetry={() => {
              this.setState({ hasError: false })
              this.props.onRetry?.()
            }}
            title={this.props.title || 'This section failed to load'}
          />
        )
      )
    }

    return this.props.children
  }
}
