'use client';

import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur space-y-4 my-8">
          <span className="text-rose-400 text-xs uppercase tracking-wider">Runtime error</span>
          <h2 className="text-xl font-bold text-slate-100">
            This section ran into a problem.
          </h2>
          <p className="text-slate-400 text-sm">
            An error occurred while rendering this part of the app. Reload the page or try again. If the issue persists, email{' '}
            <a
              href="mailto:support@tafitiai.co.ke"
              className="text-sky-400 hover:text-sky-300 text-sm"
            >
              support@tafitiai.co.ke
            </a>
            .
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
