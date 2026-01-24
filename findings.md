# Findings

## Repo State
- SvelteKit app with large single-page component at `src/routes/[lang]/+page.svelte`.
- Tailwind is not currently configured; no Tailwind dependencies or config files found.

## Lighthouse Issues Referenced by User
- Layout shift attributed to footer element.
- Forced reflow potentially from `getBoundingClientRect()` in provider dropdown.
- LCP render delay dominated by element render delay, not TTFB.
- Select element missing associated label (likely the sort select).
- Touch target sizing/spacing issues.
- Missing main landmark.
- Heading order not descending.

## Relevant Code Locations
- Footer markup: `src/routes/[lang]/+page.svelte` near bottom.
- Sort select without label: `src/routes/[lang]/+page.svelte` in results header.
- Provider dropdown positioning: `src/routes/[lang]/+page.svelte` in `toggleProviderDropdown`.
- Extensive custom CSS in `<style>` block within the page component.

## Planned Changes (In Progress)
- Add Tailwind setup via config files and global CSS import.
- Replace provider dropdown portal positioning with local absolute positioning to avoid forced reflow.
- Add main landmark, labels, min-height stabilizers, and touch-target sizing via Tailwind utilities.

## Changes Applied
- Added Tailwind config files (`tailwind.config.cjs`, `postcss.config.cjs`) and `src/app.css` with Tailwind directives.
- Imported `src/app.css` in `src/routes/+layout.svelte` to activate Tailwind utilities.
- Updated `src/routes/[lang]/+page.svelte` with Tailwind classes for touch targets and CLS stabilizers, added `<main>`, removed dropdown portal positioning, and adjusted heading level.
- Added `sortLabel` translations for labeling the sort select.
