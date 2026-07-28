"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional label used in the default fallback (e.g. "editor"). */
  label?: string;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Generic client-side error boundary. React only surfaces render/lifecycle
// errors to class components, so this stays a class. Used to isolate crash-prone
// subtrees (notably the Monaco editor) from taking down the whole page.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
    console.error("[ErrorBoundary] caught:", error);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            Something went wrong{this.props.label ? ` in the ${this.props.label}` : ""}.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
