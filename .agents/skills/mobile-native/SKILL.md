---
name: mobile-native
description: Make a web app feel native on a phone with CSS and meta-tag fixes for touch, viewport, scroll, safe areas, inputs, and PWA polish on real hardware.
---

# Feeling Native On Mobile

- Gate hover styles behind `@media (hover: hover) and (pointer: fine)` so touch devices never get stuck hover states.
- Set `-webkit-tap-highlight-color: transparent`, `-webkit-text-size-adjust: 100%`, and `overscroll-behavior: none` on `html`, with `overscroll-behavior: contain` on inner scrollers.
- Use `touch-action: manipulation` and `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none` on buttons, tabs, and chips.
- Ensure `input, textarea, select` use `font-size: 16px` under `@media (pointer: coarse)` to prevent iOS Safari zoom without disabling `user-scalable`.
- Include `viewport-fit=cover, interactive-widget=resizes-content` in the viewport meta tag.
