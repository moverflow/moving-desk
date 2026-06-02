import '@testing-library/jest-dom'

// Radix UI components (Select, Switch) require ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
