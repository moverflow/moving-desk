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
