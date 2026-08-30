import React from "react";
import { reportError } from "../lib/errorTracking";
import { logger } from "../lib/logger";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack ?? undefined });
    logger.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div role="alert" className="error-boundary-fallback" style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <p className="error-boundary-message">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <p className="error-boundary-hint">All data remains local. Try reloading the view.</p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={this.handleReset}>
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
