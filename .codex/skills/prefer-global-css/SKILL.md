---
name: prefer-global-css
description: Prefer a project's global.css design tokens, theme variables, and generated utility conventions before adding local styles. Use for frontend UI implementation, styling, layout, theming, or component changes where a global stylesheet may define reusable colors, spacing, typography, radii, or shared CSS rules.
---

# Prefer Global CSS

Before changing UI styles, locate the stylesheet loaded by the app (commonly `src/styles/global.css`) and inspect its theme variables, `@theme` mappings, base styles, and existing conventions.

- Reuse global semantic tokens and their utility classes for color, typography, borders, radii, and spacing.
- Prefer values already exposed by `global.css`; for example, use `rounded-lg` when it maps to the project's `--radius-lg` token rather than adding an equivalent arbitrary radius.
- Extend `global.css` when a missing token is reusable across the interface. Keep a genuinely one-off, user-specified value local.
- Do not duplicate global variables or introduce hardcoded visual values when a matching global token exists.
- After editing, verify the chosen utility or variable resolves through the active global stylesheet.
