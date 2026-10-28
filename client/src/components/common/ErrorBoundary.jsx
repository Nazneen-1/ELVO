import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 m-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Something went wrong displaying this component</span>
          </div>
          <p className="text-xs text-rose-700/90 dark:text-rose-300/90 leading-relaxed font-mono bg-rose-100/60 dark:bg-rose-900/40 p-2.5 rounded-lg overflow-x-auto">
            {this.state.error?.message || 'Unknown render error occurred.'}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50"
              onClick={this.handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
