# Codebase Patterns

Populated by explorer agent after each feature.
Used by future explorers to avoid re-scanning existing code.

---

## sprint-1/05-auth-pages — Explorer map (2026-06-02)

### Frontend file structure
```
frontend/src/
├── App.tsx              — router, all routes wrapped in <AppShell> (needs restructure)
├── main.tsx             — QueryClientProvider + BrowserRouter already set up
├── index.css            — Tailwind v4 via @import "tailwindcss"; brand: #1d9e75
├── routes/              — page components (OrdersPage, NewOrderPage, InvoicesPage, ClientsPage)
├── components/shared/
│   └── AppShell.tsx     — header + 4 nav tabs; must NOT wrap auth pages
├── hooks/               — empty (.gitkeep only)
├── store/
│   └── auth.store.ts    — stub: only { isAuthenticated: boolean }
├── lib/
│   ├── api.ts           — apiFetch<T>(path, init?) with credentials:'include'
│   └── utils.ts         — cn(), formatDate(), formatPhone(), formatCurrency()
└── types/index.ts       — export type {} (empty)
```

### No shadcn/ui components installed
`components/ui/` does NOT exist. Must install: button, input, label, card, select.
CLI: `cd frontend && npx shadcn@latest add button input label card select`

### TypeScript config
- strict mode ON, noUnusedLocals, noUnusedParameters
- `@/` alias → `src/`
- moduleResolution: bundler

### Key patterns
- Fetch: `apiFetch<ResponseType>('/path', { method: 'POST', body: JSON.stringify(data) })`
- Zustand: `create<StoreType>()((set) => ({ ... }))` pattern
- TanStack Query v5: `useMutation({ mutationFn: async (data) => ... })`
- JSX return type: always `JSX.Element` (see AppShell.tsx)
- NavLink active class via `({ isActive }) =>` callback

### App.tsx restructure needed
Auth routes (/register, /login, /setup, /join) must render WITHOUT AppShell.
Protected routes (/orders, etc.) must use ProtectedRoute wrapper.
New structure:
```tsx
<Routes>
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/setup" element={<QuickSetupPage />} />
  <Route path="/join" element={<JoinPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<AppShell />}>
      <Route path="/orders" element={<OrdersPage />} />
      ...
    </Route>
  </Route>
</Routes>
```
AppShell must use `<Outlet />` instead of `{children}` after this restructure.

<!-- Explorer appends entries here after each exploration -->
