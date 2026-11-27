---
name: find-animation-opportunities
description: Find high-conviction opportunities for useful interface motion while rejecting animation that adds noise or slows users down.
---

# Finding Animation Opportunities

- Keep press feedback (`transform: scale(0.97)`) at `100–160ms` with `ease-out` on all tappable controls.
- Reject heavy animations on high-frequency navigation (`100+/day`); reserve gentle stagger/entrances for first-run empty states and occasional overlays (`@starting-style` / `prefers-reduced-motion` respected).
