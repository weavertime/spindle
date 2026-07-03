import { Component, type ReactNode } from 'react';

/** Keeps a runtime error in the embedded editor from blanking the whole page. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[spindle-website] embedded editor failed to render:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
