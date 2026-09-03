"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
};

type State = {
  hasError: boolean;
};

export class WorkflowRenderErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
