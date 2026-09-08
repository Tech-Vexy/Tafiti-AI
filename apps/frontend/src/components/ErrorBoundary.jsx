'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from './ui/Button';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        
        // Log error to error reporting service
        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            return (
                <div role="alert" aria-live="assertive" className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full space-y-8 text-center animate-fade-in">
                        {/* Error Icon */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        
                        {/* Error Message */}
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold">Something went wrong</h1>
                            <p className="text-lg text-[var(--text-dim)]">
                                We encountered an unexpected error. This has been logged and our team will look into it.
                            </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                onClick={this.handleReset}
                                icon={RefreshCw}
                                iconPosition="left"
                            >
                                Try Again
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={this.handleGoHome}
                                icon={Home}
                                iconPosition="left"
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                        
                        {/* Development Details */}
                        {isDevelopment && this.state.error && (
                            <div className="mt-8 p-6 bg-[var(--bg-glass)] border border-[var(--border-glass)] rounded-2xl text-left overflow-auto max-h-96">
                                <h3 className="text-sm font-bold text-red-400 mb-2">Error Details</h3>
                                <pre className="text-xs text-[var(--text-dim)] whitespace-pre-wrap">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
