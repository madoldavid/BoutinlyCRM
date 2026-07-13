/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.moduleName ? `:${this.props.moduleName}` : ''}]`,
      error.message,
      info.componentStack,
    );
  }

  render() {
    if ((this.state as any)?.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const err = (this.state as any)?.error;

      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-theme-card border border-theme-border rounded-xl p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-primary font-sans">
                {this.props.moduleName ? `${this.props.moduleName} Error` : 'Something went wrong'}
              </h3>
              <p className="text-xs text-theme-secondary mt-1 font-sans">
                {err?.message || 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme-border rounded-lg text-xs font-medium text-theme-primary hover:bg-theme-base transition-colors font-sans"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
