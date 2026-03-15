# Theme Implementation Guide

## Overview

Four production-ready themes are available in this directory. Each is a standalone Astro 5 site with its own design system, components, and interactive features.

| Theme | Directory | Business Type | Key Feature |
|-------|-----------|---------------|-------------|
| Portfolio | `portfolio/` | Design studio / agency | Portfolio grid with case study pages |
| Ecommerce | `ecommerce/` | Online shop | Full cart + checkout flow |
| Service | `service/` | Hairdresser / salon | 4-step booking wizard |
| Restaurant | `restaurant/` | Restaurant | Takeaway order builder |

---

## Theme Structure

Each theme follows the same folder layout:

```
themes/<name>/
  src/
    styles/
      theme.css        ← Design tokens (colors, fonts, spacing)
      global.css       ← Utilities, buttons, reveal animations
    layouts/
      ThemeLayout.astro ← HTML shell + fonts + reveal script
    components/
      Nav.astro
      Footer.astro
    pages/
      index.astro
      ...
    data/
      *.json           ← Static content (products, portfolio items, etc.)
    scripts/
      *.js             ← localStorage modules (cart, booking, order)
```

---

## Installing a Theme for a Client

### Step 1: Copy theme files

```bash
cp -r themes/<theme-name>/. programs/lavprishjemmeside/local-mirror/
```

This copies all `src/`, `public/`, and config into the Astro project root.

### Step 2: Set the active theme in the database

```sql
UPDATE clients
SET active_theme = '<theme-name>'
WHERE client_slug = '<client-slug>';
```

### Step 3: Customize the design tokens

Edit `src/styles/theme.css` in the deployed mirror. Change the CSS custom properties under `:root` to match the client's brand:

```css
:root {
  --color-primary: #YOUR_BRAND_COLOR;
  --color-accent: #YOUR_ACCENT_COLOR;
  --font-heading: 'YourHeadingFont', serif;
  --font-body: 'YourBodyFont', sans-serif;
}
```

Update the Google Fonts import in `ThemeLayout.astro` to match the new font choices.

### Step 4: Replace placeholder content

| File | What to update |
|------|----------------|
| `src/data/*.json` | Products, menu items, portfolio cases, staff, services |
| `src/components/Nav.astro` | Business name, logo, nav links |
| `src/components/Footer.astro` | Contact info, address, social links |
| `src/pages/index.astro` | Hero copy, about section, CTA text |
| `src/pages/about.astro` | Business story, team members |
| `src/pages/contact.astro` | Address, phone, email, opening hours |

### Step 5: Replace Pexels images

All themes use public Pexels URLs. Replace these in the JSON data files and `.astro` page files with the client's own images uploaded via the Media admin panel:

```
GET /api/media → returns uploaded image URLs
```

Update the `image` field in product/portfolio/menu JSON files.

### Step 6: Build and deploy

```bash
npm run build
```

The output in `dist/` is a static site. Deploy via cPanel file manager or the automated deploy pipeline.

---

## Design Token Reference

All four themes share the same CSS variable naming convention. Only the values differ.

### Colors

| Token | Purpose |
|-------|---------|
| `--color-primary` | Main brand color (buttons, headings, nav) |
| `--color-primary-light` | Tinted version for backgrounds |
| `--color-accent` | Highlight color (badges, prices, links) |
| `--color-accent-light` | Tinted accent for section backgrounds |
| `--color-bg-page` | Page background (white or near-white) |
| `--color-bg-warm` | Warm off-white for alternating sections |
| `--color-bg-dark` | Dark background for hero / footer sections |
| `--color-text-primary` | Main body text |
| `--color-text-secondary` | Muted / secondary text |
| `--color-text-on-dark` | Text color on dark backgrounds |
| `--color-border` | Borders and dividers |

### Typography

| Token | Purpose |
|-------|---------|
| `--font-heading` | Headings (h1–h4) |
| `--font-body` | Body text, UI elements |

### Spacing and Radii

| Token | Value | Purpose |
|-------|-------|---------|
| `--radius-sm` | 4px | Small elements (tags, badges) |
| `--radius-md` | 8px | Form inputs, buttons |
| `--radius-lg` | 12px | Images, small cards |
| `--radius-xl` | 16px | Medium cards |
| `--radius-2xl` | 24px | Large cards, overlapping images |
| `--radius-card` | 12px | Standard card radius |
| `--radius-full` | 9999px | Pills, fully rounded |

---

## Interactive Features

### Ecommerce: Cart (localStorage)

Key: `verde_cart`

```json
{
  "items": [
    { "id": "p001", "name": "Product", "price": 29900, "quantity": 2, "image": "..." }
  ],
  "updated_at": "2025-01-01T12:00:00Z"
}
```

The cart badge in `Nav.astro` listens for a `cart:updated` CustomEvent. Trigger this event after any cart modification to keep the badge in sync.

To wire up to a real payment provider: replace the checkout form submission handler in `src/pages/shop/checkout.astro` with an API call to your payment processor (Flatpay, Stripe, etc.).

### Service: Booking Wizard (localStorage)

Key: `salon_bookings`

```json
[
  {
    "id": "BK-ABC123",
    "serviceId": "s1",
    "date": "2025-03-20",
    "time": "10:00",
    "staffId": "staff1",
    "customer": { "fname": "...", "lname": "...", "email": "...", "phone": "..." },
    "status": "confirmed",
    "created_at": "2025-01-01T12:00:00Z"
  }
]
```

To wire up to a real backend: replace the `saveBooking()` call in step 4 of the wizard with a `POST /api/bookings` request. The slot availability check (`isSlotTaken()`) should be replaced with a server-side query.

### Restaurant: Takeaway Orders (localStorage)

Key: `brasa_order` (active basket) and `brasa_orders` (order history)

```json
{
  "id": "BRS-12345",
  "customer": { "name": "...", "phone": "...", "email": "..." },
  "items": [{ "id": "m1", "name": "...", "price": 24900, "quantity": 1 }],
  "deliveryType": "pickup",
  "subtotal": 24900,
  "deliveryFee": 0,
  "total": 24900,
  "payment": "card",
  "eta": "30-45 min",
  "status": "received"
}
```

To wire up to a real backend: replace the order submission handler in `src/pages/takeaway/index.astro` with a `POST /api/orders` request. Set up a webhook or admin dashboard to receive and manage incoming orders.

---

## Scroll Reveal Animations

All themes use the `[data-reveal]` system. Add the attribute to any element to opt-in:

```html
<div data-reveal>Animates in on scroll</div>
```

For staggered children, add a CSS custom property for delay:

```html
<div data-reveal style="--reveal-delay: 80ms">...</div>
<div data-reveal style="--reveal-delay: 160ms">...</div>
```

The IntersectionObserver script is embedded in each `ThemeLayout.astro`. It sets `data-reveal="visible"` when the element enters the viewport, triggering the transition defined in `global.css`:

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 520ms ease var(--reveal-delay, 0ms),
              transform 520ms ease var(--reveal-delay, 0ms);
}
[data-reveal="visible"] {
  opacity: 1;
  transform: none;
}
```

---

## Price Formatting

All prices are stored as integers in øre (Danish cents). Use the `formatPrice()` function to display them:

```js
function formatPrice(ore) {
  return (ore / 100).toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
  });
}
// formatPrice(24900) → "249 kr."
```

---

## Adding a New Theme

1. Copy an existing theme folder and rename it
2. Update `src/styles/theme.css` with the new color and font tokens
3. Update Google Fonts import in `ThemeLayout.astro`
4. Replace content in `src/data/` JSON files
5. Adjust page layouts and sections as needed
6. Add the theme slug to the `clients` table and test

---

## Supported Browsers

All themes use only modern CSS (custom properties, grid, clamp) and vanilla JS (no polyfills). Minimum supported browser versions: Chrome 90+, Firefox 90+, Safari 14+, Edge 90+.
