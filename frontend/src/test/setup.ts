import '@testing-library/jest-dom'

// Radix UI components (Select, Switch) require ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Radix UI Tabs uses PointerEvent
if (!global.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params?: PointerEventInit) {
      super(type, params)
    }
  }
  global.PointerEvent = PointerEvent as typeof globalThis.PointerEvent
}

// jsdom doesn't implement the Pointer Capture APIs Radix Select uses to
// manage its click/keyboard interactions, or scrollIntoView for the
// highlighted option — without these, clicking a Select in a test throws.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
