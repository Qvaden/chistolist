---
name: better-ui
description: Polishes surfaces and icons with exact values for border radius, optical alignment, shadows and icon states.
---

# UI polish

This skill holds the visual polish for surfaces and icons, with the exact value each detail takes. It applies once the underlying interaction is sound, and a polish finding never outranks a broken interaction.

## Outer radius equals inner radius plus padding

Where nested surfaces share a visible, even inset, the outer radius is the inner radius plus the padding plus any border width. Past `24px` of padding, or where the padding is deliberately asymmetric, treat the layers as separate surfaces and keep each one's radius token.

## Align optically where geometry looks off

Where geometric centering looks off, nudge by eye. Give a button `2px` less padding on its icon side, shift a play triangle toward its point and fix asymmetric glyphs in the SVG itself.

## Shadows for elevation, borders for structure

Where a border exists only to create depth, replace it with layered transparent `box-shadow` values. Keep borders on dividers, separators, table cells and selected states. Keep them on form inputs too, whose boundary needs 3:1 non-text contrast.
Forced-colors mode removes every `box-shadow`. Keep `border: 1px solid transparent` under a shadow ring so that mode still draws an edge.

## Outline images in pure black or white

Give content images a `1px` outline inset by `1px`. Use `oklch(0 0 0 / 0.1)` in light mode and `oklch(1 0 0 / 0.1)` in dark. Never use a palette near-black, a tinted neutral or the accent color, because the tint shows as a colored fringe on the image edge.

## Hover effects only on hover-capable pointers

Put hover-only styling behind `@media (hover: hover)`. On touch, `:hover` latches after a tap and reads as a stuck selected state. Where a control draws its own pressed state, set `-webkit-tap-highlight-color: transparent` so the default gray flash does not double it.

## Contain scroll inside overlays

Give scrollable dialogs, drawers, menus and side panels `overscroll-behavior: contain`, so scrolling past their end never scrolls the page behind.
