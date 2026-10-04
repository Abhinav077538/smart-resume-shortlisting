# Smart Resume Shortlisting implementation plan

## Scope
Smart Resume Shortlisting is a premium, dark-first recruiting intelligence interface rebuilt from `tests/shortlist-source.html`. The browser-only ranking engine is extracted without changing its calculations, weights, thresholds, ordering, explanations, or PDF-reading behavior. The UI is a responsive React/Vite shell with client-side navigation and a transparent distinction between current PDF/text functionality and unsupported backend automation.

## Design direction
- **Design movement:** editorial enterprise software / quiet luxury dashboard.
- **Core principles:** evidence before ornament; high signal density; calm hierarchy; precise, tactile controls.
- **Color philosophy:** ink-black foundations keep attention on candidate evidence; blue-violet is reserved for active navigation and focus; mint is the ownable success/accent color inherited from the source engine, used sparingly for scores and confirmed actions; warm amber marks review states.
- **Layout paradigm:** a persistent left rail anchors the workspace while content is organized as a vertical reading path: context → action → ranked evidence. On mobile, the rail becomes a drawer and tables become stacked evidence cards.
- **Signature elements:** a compact Smart Resume Shortlisting prism mark; thin “signal” rules that connect sections; numeric score blocks with monospaced labels.
- **Interaction philosophy:** direct manipulation with visible consequences. Search, sort, compare, and detail views only change presentation—not the source ranking output.
- **Animation:** short, low-amplitude transitions for drawers, cards, and sorting; no perpetual motion, glow, or decorative parallax.
- **Typography system:** Inter for interface copy, Space Grotesk for display headings, and JetBrains Mono for scores, labels, and methodology.
- **Brand essence:** an evidence-backed shortlist workspace for recruiters who need to move from resumes to a defensible decision; precise, composed, credible.
- **Brand voice:** clear, restrained, operational. Example lines: “Find the right candidate.” and “Every score has a trail.”
- **Wordmark & logo:** uppercase Smart Resume Shortlisting wordmark paired with a three-line prism mark representing keyword, semantic, and experience signals.
- **Signature brand color:** signal mint `#9CE6C9`, the visual cue for verified evidence and active score states.

## Architecture
- `src/lib/ranking.ts`: verbatim behavior port of the source ranking engine, typed only around its existing values.
- `src/lib/pdf.ts`: source-faithful PDF extraction and timeout handling using the existing PDF.js CDN runtime.
- `src/data/demo.ts`: presentation labels, methodology metadata, and neutral empty-state copy; no invented candidate results.
- `src/components/`: shell, sidebar, upload cards, score cards, data table, comparison, detail drawer, and reusable primitives.
- `src/pages/`: dashboard, analysis, candidates/results, how-it-works, and settings-like product notes.
- `src/App.tsx`: route state, source data state, rendering orchestration, and interaction state.
- `src/styles.css`: responsive visual system and accessibility states.
- `tests/shortlist-source.html`: untouched source fixture for regression auditing.
- `scripts/regression.ts`: runs the extracted engine against deterministic fixture inputs and compares output with a legacy mirror of the source functions.
- `public/manus-routes.json`: complete page route manifest.

## Runtime and delivery
The site is static and browser-only. PDF extraction remains client-side. `npm run dev` serves port 3000; `npm run build` emits `dist/`; `npm run test:regression` validates engine parity. No server, database, fabricated AI service, or secret is required.
