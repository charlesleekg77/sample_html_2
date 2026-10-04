# AGENTS.md — Tengile MalaMala Collection static site

## What this is
A static, multi-page luxury safari website (HTML5 + CSS3 + vanilla JS). No build
step, no framework, no dependencies. Open any `.html` directly or serve the folder.

## Files
- `index.html` — home page (authored by hand)
- `about.html`, `accommodation.html`, `experiences.html`, `conservation.html`,
  `partner-hub.html`, `stories.html`, `journals.html`, `gallery.html`,
  `faq.html`, `contact.html`, `plan-your-stay.html`
- `style.css` — the entire design system (CSS variables, components, responsive)
- `main.js` — all interactivity (IIFE, no modules)

## Conventions
- Every page shares an identical header, slide-out drawer, footer and enquiry
  modal. When editing one page's shared chrome, update all pages.
- Header is `ENQUIRE` (left) / centered serif wordmark / `MENU`–`CLOSE` toggle (right).
- Design tokens live in `:root` in `style.css`: `--alabaster #f8f5f0`,
  `--ink #1a1a1a`, `--forest #242d23`, `--olive #5c6e21`. Use variables, not literals.
- Typography: Cormorant Garamond (headings) + Inter (body), loaded from Google Fonts.
- Images are hot-linked from Unsplash with `?auto=format&fit=crop&w=…&q=80`.
  Keep the `w` sizes sensible; there is no local image pipeline.

## JS behaviour map (`main.js`)
Drawer + focus trap + ESC, sticky/hide-on-scroll header, IntersectionObserver
reveals, accordion (`data-accordion`), tabs (`data-tabs`), slider (`data-slider`),
multi-step form (`data-steps`), simple forms (`data-contact`, `data-enquiry-quick`),
enquiry modal (`data-open-enquiry`), lightbox (`data-lightbox`), amenity filters
(`data-filter-group`), hero parallax (`data-parallax`), auto `aria-current`.

## Testing
Serve locally, e.g. `python3 -m http.server 12000`, then click through the drawer,
tabs, slider, filters, accordion, lightbox, modal and the 3-step enquiry form.
