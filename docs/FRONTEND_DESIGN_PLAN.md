# Boutinly CRM — Frontend Design & Enterprise UX Implementation Plan

Companion to `ENTERPRISE_READINESS_PLAN.md`. That document covers backend authority; this one covers making the frontend look and behave like an enterprise product. Design direction: a blend of modern SaaS (Linear/Notion — clean, dense, refined micro-interactions) and classic enterprise (Salesforce — information density, strong data tables, familiar patterns).

## Current State Assessment

What exists: 6 functional modules (Reports, Contacts, Pipeline, Tasks, Emails, Admin), a CSS-variable theme system with 4 light themes, Tailwind 4, lucide icons, Inter font, error boundaries, offline banner, splash screen, notification dropdown.

What is missing, in order of user-visible impact:

1. **No shared UI component library.** Every module hand-rolls buttons, inputs, modals, tables, badges, and empty states. Result: inconsistent spacing, font sizes (`text-[9px]` to `text-lg` used arbitrarily), and border radii across modules. This is the root cause of the "prototype feel."
2. **No real data visualization.** Reports uses icons and div-width bars. Enterprise dashboards need proper charts (axes, tooltips, legends, animation).
3. **No drag-and-drop kanban.** Pipeline stage moves happen via buttons; DnD is table stakes for a CRM pipeline.
4. **No dark mode.** All 4 themes are light. Enterprise buyers expect a dark theme.
5. **No accessibility layer.** Zero `aria-*` attributes, no focus-visible rings, no keyboard navigation for dropdowns/modals, no focus trapping. Blocks enterprise procurement (WCAG 2.1 AA is a common requirement).
6. **No toast/feedback system.** Mutations succeed or fail silently; the only feedback surface is the sidebar notification list.
7. **No global search / command palette.** Enterprise users expect Cmd+K to jump to any contact, deal, or action.
8. **No loading skeletons or optimistic UI.** Only a full-screen splash; per-panel states are absent.
9. **No table infrastructure.** List views lack sorting, column resize, pagination/virtualization, bulk selection, inline edit, saved views, and column pickers.
10. **No responsiveness.** Fixed 256px sidebar + desktop-only layout; unusable below ~1024px.
11. **No performance hygiene.** No `useMemo`/`useCallback`; scoped-data filters recompute on every render. Fine at seed scale, not at 50k contacts.
12. **Weak micro-interactions.** The global `* { transition }` rule is a blunt instrument (and causes flash-of-transition on theme/page load); no entrance animations, no reduced-motion support.

## Design System Specification

### Tokens (extend `src/index.css`)

- **Color:** keep the 4-slot semantic model (`base/card/primary/secondary/accent/border`) but add: `--bg-inset` (recessed wells), `--bg-hover`, `--accent-soft` (10% tint surface), semantic status colors (`--success`, `--warning`, `--danger`, `--info` with soft variants), and elevation shadows (`--shadow-sm/md/lg/overlay`). Add a `.theme-dark` theme mapped to the same slots.
- **Typography scale:** replace ad-hoc `text-[9px]`…: `xs 11px` (meta), `sm 12.5px` (body/tables), `base 14px` (emphasis), `lg 16px` (panel titles), `xl 20px` (page metrics). Tabular numerals (`font-variant-numeric: tabular-nums`) for all money/metric columns. Add a real mono font for IDs/audit data.
- **Spacing & radius:** 4px spacing grid; radius scale `6px` (inputs/buttons), `10px` (cards), `14px` (modals). Stop mixing `rounded`, `rounded-lg`, `rounded-2xl` arbitrarily.
- **Motion:** remove the global `*` transition. Define `--ease-out-quart` and 120/180/240ms durations; entrance animations for modals/drawers (scale+fade), respect `prefers-reduced-motion`.
- **Focus:** visible 2px `--accent` focus ring via `:focus-visible` on all interactive elements.

### Component Library (`src/components/ui/`)

Build once, refactor modules onto them: `Button` (primary/secondary/ghost/danger; sm/md; loading state), `Input`/`Select`/`Textarea` (label, error, help text), `Modal` (focus trap, Esc close, overlay blur, entrance animation), `Drawer` (right-side detail panel — Contacts/Pipeline already imply this pattern), `DataTable` (sortable headers, sticky header, row selection checkboxes, pagination, empty state, density toggle), `Badge`/`StatusDot` (semantic colors), `Tabs`, `Tooltip`, `DropdownMenu` (keyboard navigable), `Toast` (top-right stack, success/error/info, auto-dismiss), `EmptyState` (icon + title + CTA), `Skeleton`, `Avatar` (with stacking), `KpiCard`, `ConfirmDialog` (replaces `window.confirm` if present, and inline delete buttons).

## Implementation Phases

### Phase 1 — Foundation (design tokens + shell) ~1 week
- Rewrite `index.css`: full token set, dark theme, typography scale, motion/focus rules, remove global transition.
- App shell: collapsible sidebar (icon-only mode, persisted), breadcrumb-style header, theme toggle incl. dark, refined notification popover.
- Login page polish: split-panel layout, product visual, refined form states.
- Build `Button`, `Input`, `Modal`, `Badge`, `Toast`, `EmptyState`, `Skeleton` primitives.

### Phase 2 — Module refactor onto the system ~1–2 weeks
- Refactor all 6 modules to consume `ui/` primitives; normalize type scale and spacing.
- Replace inline confirms/deletes with `ConfirmDialog`; wire all mutations to `Toast`.
- Add per-panel `Skeleton` loading and designed empty states everywhere.

### Phase 3 — Data-heavy UX ~1–2 weeks
- `DataTable` with sorting, pagination, bulk select, column visibility; apply to Contacts, Tasks, Pipeline list view, Admin audit log.
- Real charts (Recharts): pipeline funnel, revenue trend line, win/loss donut, quota gauge, stage-duration bars in Reports.
- Drag-and-drop kanban (`@dnd-kit/core`): drag cards between stages with drop animation and optimistic move + server confirm.
- Saved views/filters per module (persisted per user).

### Phase 4 — Enterprise power features ~1 week
- Cmd+K command palette: global search across contacts/accounts/deals/tasks + quick actions ("New deal", "Go to Admin").
- Keyboard shortcuts (g+c contacts, g+d deals, c create) with a `?` shortcut cheatsheet modal.
- Record detail drawers with activity timeline, inline editing, and related-records panels.
- CSV import wizard UI (column mapping, validation preview) matching the backend import jobs in the enterprise plan.

### Phase 5 — Accessibility, responsiveness, performance ~1 week
- WCAG 2.1 AA pass: aria labels/roles, focus trapping in all overlays, contrast audit of all themes, keyboard nav for kanban.
- Responsive: sidebar → overlay below 1024px; tables → card lists on small screens.
- Memoize scoped selectors in `store.tsx`; virtualize long lists (`@tanstack/react-virtual`); code-split modules with `React.lazy`.
- Visual regression tests (Playwright screenshots) + axe-core accessibility tests in CI.

## New Dependencies

Keep the footprint small and audited: `recharts` (charts), `@dnd-kit/core` + `@dnd-kit/sortable` (kanban DnD), `@tanstack/react-virtual` (list virtualization), `cmdk` (command palette). Everything else is built in-house on Tailwind.

## Definition of Done (frontend)

Every interactive element keyboard-reachable with a visible focus state; no raw `text-[Npx]` values outside the token scale; every mutation surfaces a toast; every async panel has skeleton + empty + error states; dark mode fully themed; Lighthouse accessibility ≥ 95; module bundles code-split.
