"use client";

import { Component, type ReactNode } from "react";

type HeroPhoneErrorBoundaryProps = {
  children: ReactNode;
  onError: () => void;
};

type HeroPhoneErrorBoundaryState = {
  hasError: boolean;
};

export class HeroPhoneErrorBoundary extends Component<
  HeroPhoneErrorBoundaryProps,
  HeroPhoneErrorBoundaryState
> {
  state: HeroPhoneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HeroPhoneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;

    return this.props.children;
  }
}
