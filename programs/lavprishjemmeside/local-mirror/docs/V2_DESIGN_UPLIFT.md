# V2 Admin Design Uplift Specification

> Phase 2 implementation record. Describes the design decisions, tokens, and component patterns introduced in the V2 admin shell uplift.

---

## Scope

Three files were uplifted as part of Phase 2:

1. `src/layouts/AdminLayout.astro` — shared admin shell
2. `src/pages/admin/dashboard.astro` — primary admin landing page
3. `src/pages/admin/master.astro` — master-only operator console

No schema, API, env, or workflow contracts were changed. No outside-folder dependencies were introduced.

---

## Design Tokens

All admin surfaces now share a consistent set of inline-style tokens:

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#f8f9fc` | Body / content area |
| Card / surface | `#fff` | Cards, panels, forms |
| Dark sidebar | `#0f1117` | Sidebar navigation |
| Stat / mini cell | `#f9fafb` | Stat cells, note areas |
| Terminal | `#090c10` | Claude Code output |

### Borders
| Token | Value |
|-------|-------|
| Default border | `#e5e7eb` |
| Dark surface border | `#1f2937` |
| Focus ring | `rgba(59,130,246,0.12)` |

### Text
| Token | Value | Role |
|-------|-------|------|
| Primary | `#111827` | Headings, values |
| Secondary | `#374151` | Body, strong |
| Muted | `#6b7280` | Labels, secondary |
| Placeholder | `#9ca3af` | Timestamps, domains |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| Blue primary | `#3b82f6` / `#2563eb` | Actions, active states, links |
| Green | `#22c55e` / `#16a34a` | Success, health-online, publish confirm |
| Amber | `#f59e0b` / `#92400e` | Warning, publish button |
| Red | `#ef4444` / `#b91c1c` | Error, danger actions |
| Sidebar Master | `#a78bfa` | Master Hub nav link only |

### Spacing
All spacing follows an 8px base unit. Common values: `0.5rem (8px)`, `0.75rem (12px)`, `0.875rem (14px)`, `1rem (16px)`, `1.25rem (20px)`, `1.5rem (24px)`.

### Border radius
| Context | Value |
|---------|-------|
| Cards, panels | `0.75rem` |
| Inputs, selects | `0.5rem` |
| Buttons | `0.5rem` |
| Pill badges | `999px` |
| Mini stat cells | `0.5rem` |

---

## AdminLayout.astro

### Sidebar
- Width: `15rem`, fixed position, full-height, `overflow-y: auto`
- Background: `#0f1117`
- Logo area: `1.25rem` padding, white wordmark text
- Section labels: `0.6875rem`, `#4b5563`, `letter-spacing: 0.14em`, `text-transform: uppercase`
- Nav items: `padding: 0.5rem 0.875rem`, border-radius `0.5rem`, full-width flex row with SVG icon + label
- Hover state: `background: rgba(255,255,255,0.06)`
- Active state: `background: rgba(255,255,255,0.09)` + `2.5px solid #3b82f6` left border indicator via `::before` pseudo-element positioned absolutely at `top: 25%, height: 50%`
- Master Hub nav item: `color: #a78bfa` (distinct from other items)
- Footer: user avatar (initial letter in `#374151` circle), email in `#9ca3af`, logout with red hover

### Top bar (header)
- `position: sticky; top: 0; z-index: 20`
- Background `#fff`, bottom border `#e5e7eb`
- Height `3.25rem`, padding `0 1.5rem`
- Left: mobile hamburger (hidden on desktop), page title from `document.title`
- Right: role badge (`MASTER` in `#a78bfa` for master users), separator, user email, avatar initial

### Mobile behavior
- Sidebar default: `transform: translateX(-100%)`
- `.open` class: `transform: translateX(0)`
- Dark overlay `div#mobile-overlay` covers content, click to dismiss
- Hamburger button visible only at `< 1024px`
- Main content `margin-left: 0` on mobile, `15rem` on desktop

### JavaScript
- `initSidebar()`: sets active nav item by matching `window.location.pathname`, populates header title and user info from JWT
- `toggleSidebar()` / overlay click: slide-in / slide-out

---

## dashboard.astro

### Version strip
- Full-width dark bar (`#0f1117`), padding `0.875rem 1.5rem`
- Horizontal metadata layout: build ID, release pill, short commit, committed-at, update channel
- "Kopiér build-id" copy button, `#4b5563` text, amber on hover
- Conditional update-help text when git ref diverges from build

### Stats row
- `grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr))`
- Stat card: white, `0.75rem` radius, `1rem` padding
- Value: `1.75rem`, `700` weight, `#111827`
- Label: `0.75rem`, `#9ca3af`

### Three-column overview grid
- Columns: Pages, Design, Indhold & SEO
- Each column: white card, section heading with inline SVG icon
- Content rows: status dot (`0.5rem` circle, green/gray) + link + action link
- Responsive: collapses to single column at `max-width: 900px`

### Publish button
- Default: amber `#f59e0b`, white text
- Success: green `#16a34a` for 2.5 seconds

### Rollout banner
- Dynamically styled via `style.cssText` assignment for three states: update available (blue), rollout pending (amber), unavailable (amber-dark)

### Visibility pattern
- All show/hide done via `element.style.display = ''` / `'none'`
- No CSS `hidden` class dependency (avoids Tailwind purge issues)

---

## master.astro

### Header
- Page title "Master Hub" + "lavprishjemmeside.dk" pill badge with green status dot

### Tab bar
- Shared `.tab-bar` with `.tab-btn` elements
- Active tab: `border-bottom: 2px solid #3b82f6; color: #2563eb`
- Tab icons: inline SVG (grid, sparkline chart, terminal icons)
- Tab switching: `switchTab()` function uses `classList.add/remove('active')` and `element.style.display`

### Sites tab
- Two-column grid at `≥ 900px`, single column on mobile
- Site card: health dot + build pill + update badge, 4-column mini-stat row (pages, components, media, DB MB), note area, footer with AI token/cost totals and admin link
- Rollout banner: dynamic `style.cssText` for three color states

### AI Usage tab
- Per-site cards with 14-day mini bar chart (`ai-chart-bar` elements, height proportional to token max)
- Hover: bar darkens from `#93c5fd` to `#3b82f6`

### Claude Code tab
- Three-step card layout with tinted gradient backgrounds (blue/green/amber)
- Step labels: uppercase, `0.6875rem`, colored per step
- Model, timeout, auth-status row
- Monospace textarea prompt
- Terminal output: `#090c10` background, colored spans per event type (stdout green, stderr amber, limit reached light-blue)
- Kill button only appears when a run is active

### Buttons
- `.btn` base class: flex, gap, padding, radius, weight, transition
- Variants: `.btn-primary` (blue), `.btn-danger` (red), `.btn-ghost` (white/border), `.btn-ghost-blue` (white/blue-border)

### Visibility pattern
- `.hidden-el { display: none !important }` for initial hide
- JS uses `element.style.display = ''` / `'none'` (overrides `!important` fine for JS; `!important` prevents accidental CSS re-show)
- Helper functions: `showEl(el)` / `hideEl(el)`

---

## CSS Strategy

All admin styles use scoped `<style>` blocks (Astro page-level) or inline `style=""` attributes. This approach:

- Avoids Tailwind v4 JIT purge issues with dynamically assembled class names
- Keeps admin styles self-contained and predictable
- Allows overriding with JS `element.style` without specificity conflicts
- Prevents public-site CSS variables from leaking into admin context

---

## Contracts Not Changed

This phase changed only HTML/CSS/JavaScript presentation. The following contracts remain unchanged:

- Database schema — no migrations
- API routes — no new or changed endpoints
- Environment variables — no changes
- Workflow / install sequences — no changes
- Outside-folder dependencies — none introduced
