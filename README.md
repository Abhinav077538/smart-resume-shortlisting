# Smart Resume Shortlisting

A browser-only recruiting workspace that turns a job description and a batch of resume PDFs into an explainable ranked shortlist. The current implementation preserves the supplied shortlist engine while adding a responsive recruiter-focused interface.

## Features

- Job description analysis through PDF extraction or pasted text
- Resume batch processing for selectable-text PDFs
- Keyword matching across required and preferred signals
- Semantic matching using concept coverage and normalized TF-IDF similarity
- Hybrid candidate ranking with a requirement gate
- Top-candidate explanations and evidence groups
- Candidate comparison using the original explanation function
- Search, sorting, required-gap filtering, and responsive candidate details
- Recruiter-friendly dark interface with accessible navigation and mobile layouts

## Architecture

The app is a static React + TypeScript + Vite application. `src/lib/ranking.ts` is the UI-independent scoring core extracted from the supplied `shortlist.html`; `src/lib/pdf.ts` keeps the original client-side PDF extraction and timeout behavior. `src/App.tsx` owns browser navigation, local analysis state, upload interactions, result presentation, comparison, and detail drawers. No backend, database, external model call, or secret is required.

## Scoring

The source-faithful engine computes:

```text
base = 0.40 × keyword + 0.35 × semantic + 0.15 × experience + 0.10 × impact
final = base × (0.35 + 0.65 × requiredSkillFit)
```

Keyword scoring uses the original weighted signals and required-skill coverage. Semantic scoring combines the original concept coverage score with normalized TF-IDF cosine similarity against the job description. Experience parses years, caps them at three, and scales them by relevance. Impact counts the exact source evidence markers. Scores are rounded to one decimal place and candidates are sorted by final score descending.

## Tech Stack

- React and React DOM
- TypeScript
- Vite
- Lucide React icons
- PDF.js loaded in the browser for selectable-text PDF extraction
- Vercel-compatible static output

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run the regression check and production build together:

```bash
npm run check
```

The regression test compares the extracted engine with an independent legacy mirror of the supplied source using deterministic fixtures. The original source is preserved at `tests/shortlist-source.html`.

## Environment Variables

None are required. The application is browser-only and does not include API keys, credentials, or committed `.env` files.

## Deployment

The project is prepared for Vercel:

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Vite
- SPA rewrite: `vercel.json` routes application paths to `index.html`

Deploy from the repository root with the Vercel CLI or import the GitHub repository in the Vercel dashboard. No environment variables are needed.

## Project Structure

- `src/App.tsx` — application shell, navigation, analysis flow, result pages, and interactions
- `src/lib/ranking.ts` — preserved ranking, scoring, explanation, and comparison logic
- `src/lib/pdf.ts` — browser PDF text extraction
- `src/styles.css` — responsive visual system
- `public/manus-routes.json` — page route manifest
- `scripts/regression.ts` — source-versus-extracted ranking check
- `tests/shortlist-source.html` — untouched source fixture
- `tests/fixture.json` — deterministic regression inputs
- `plan.md` — implementation and design notes
