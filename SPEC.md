# Wishlist — MVP specification and implementation handoff

Status: Planning approved; product implementation has not started.
Last updated: 2026-10-20.
Project: /home/uzski/Development/projects/wishlist
Owner: Sean Motanya.

## Product purpose

A personal, visual shopping wishlist. Start with clothing and sneakers, but support other products such as phones without forcing every category into a clothing-specific model.

The core promise: describe something you want, confirm the exact version, and save it to a clean visual list with an accurate product image.

The engineering challenge is product and variant identification. Finding an attractive image is insufficient if it depicts the wrong model, colorway, generation, or configuration.

Sean's example interests include white Nike Shox, Cortez, and Air Max 97. Treat these as separate example searches, not as a single product name. Do not choose particular models or colorways on his behalf.

## Decisions from the planning conversation

- Use TanStack Start with React, TypeScript, Vite, and Cloudflare Workers.
- Use the existing Serper account for discovery. Sean has a key; it has not been supplied or configured in this conversation. Do not assume a key is present, and do not expose credentials in client code or logs.
- Use D1 with Drizzle for persistent application data; R2 for uploads and permitted saved/processed image copies.
- Offer guest use with browser persistence, followed by Google sign-in for backup and cross-device access. Signup is not required to try the core flow.
- Support all three addition methods: typed product name, pasted product URL, and user-supplied image.
- Product variant confirmation and image correction are core MVP behavior.
- Use the selected Sentry, Better Auth, Drizzle, Form, Shadcn, and Query integrations. Do not add another database, auth provider, or RPC layer without a concrete requirement.
- Keep infrastructure inexpensive. Do not introduce paid services just because they have a free trial.
- This document captures the plan; it does not authorize deployment or imply that integrations already work.

## MVP user flows

### 1. Add by product name

1. User types a name or description and explicitly submits.
2. Search real product listings through Serper, returning a compact set of distinct candidates with images and source labels.
3. If the query identifies only a family, let the user select the model.
4. Discover and present relevant variants, using refined search and source-page data where available.
5. User confirms the specific colorway/configuration. Skip redundant selection steps when the input and retrieved evidence are already specific.
6. Preselect the strongest image of that confirmed variant and offer alternate images or upload.
7. User saves the item to the list, with optional personal preferences or notes.

Do not silently select the first colorway or imply search results enumerate every possible variant. Label options as discovered matches. If an exact match cannot be established, let the user refine the query, paste a link, upload an image, or save an unresolved wish.

Preserve input and selected candidates when a lookup fails. Retrying must not duplicate saved items or unnecessarily repeat successful provider calls.

### 2. Add by link

- Accept a product URL and extract structured product data first, including Product/ProductGroup, variants, identifiers, image, and offers when supplied.
- Fall back to Open Graph metadata when structured product data is absent.
- Preserve URL parameters that identify the selected variant. Do not strip them as generic tracking parameters without understanding their role.
- A generic Open Graph image does not establish the chosen colorway. Show the extracted preview for confirmation and permit correction.
- Use normal server-side fetching first. Add a bounded Cloudflare Browser Run fallback only where JavaScript-dependent pages justify it.
- If extraction fails or the page blocks access, retain the URL and allow manual title/image entry. Do not make arbitrary retailer support a prerequisite for saving an item.

### 3. Add an image manually

- Accept an uploaded image with editable title and optional brand, variant attributes, source link, and notes.
- Allow saving without a source URL or product identifier.
- Do not claim that an upload identifies a verified product. Automated recognition is optional future work.
- Validate file size and supported image types, and provide retry/replacement controls without losing entered details.

### 4. Manage the list

- Display a coherent image-led list/grid, with exact item names and selected variant details.
- Support editing details, replacing the image, removing an item, and marking it purchased/unpurchased.
- Offer a recoverable removal action, such as undo or confirmation.
- Support unresolved wishes that can be completed later.
- Start with one personal list. Multiple lists, sharing, and collaboration are not initial requirements.

### 5. Guest use and accounts

- Save guest items, drafts, and uploaded image blobs in IndexedDB. Reserve localStorage for small preferences.
- Explain that guest data is saved on this browser, not backed up or available on other devices. Handle unavailable storage, quota errors, and failed writes visibly.
- Guest search still calls our server; the browser never receives the Serper secret.
- Offer Google sign-in through Better Auth to back up and sync the list.
- Import guest data using stable IDs and an idempotent import process. Preserve local data until server confirmation; an interrupted sign-in or upload must be recoverable.
- Server-side session and ownership checks protect every private read/write. A client navigation guard alone is insufficient.
- Avoid passwords and email delivery requirements for the initial Google-only account flow.

## Product identity and variants

Keep four concepts separate:

| Concept | Meaning |
| --- | --- |
| Product | Brand/model or product family |
| Variant | A particular colorway/configuration of that product |
| Offer | A retailer's listing, URL, currency, observed price and availability |
| Wishlist item | A person's desired item, selected image, preferences, notes and purchase status |

Use flexible attribute names/values so categories can differ. Sneakers may have colorway, style code, size, and size system. Phones may have color, storage, generation, and region. Some attributes change the image; others do not.

Personal preferences can be stored without claiming that an in-stock offer exists. Keep inferred attributes distinct from source-provided and user-confirmed values. Unknown values should remain unknown.

Capture manufacturer style codes, SKUs scoped to their source, GTINs, and provider IDs where actually supplied. Do not merge products based on name similarity alone. Provider IDs are external references, not permanent internal primary keys.

A minimal logical model should cover:

- Account/session records managed through Better Auth.
- Personal list and list items, including unresolved items and purchase state.
- Product/variant references and flexible attributes, where identity is established.
- Source offers and when their details were observed.
- Image assets, provenance, original/processed relationships, and selected image.
- Lookup/cache records with query, locale, provider, timestamps, and expiry.

Do not build a universal product catalog or complex deduplication system before the core flow works.

## Search and extraction architecture

Use a small internal provider boundary for product discovery, image lookup, and source extraction. The UI consumes normalized candidates rather than provider-specific JSON. Keep provider data and source provenance available for debugging without logging credentials or private user data.

Initial pipeline:

1. Validate submitted query/URL and check an appropriately scoped cache.
2. Run a Serper Shopping lookup for product discovery.
3. Group only clearly equivalent results; expose distinct models to the user.
4. On model selection, refine searches for the requested colorway/configuration.
5. Fetch the chosen source page to obtain more precise variant details and full image candidates where possible.
6. Use a targeted image search only when listing images are insufficient. Prefer exact model/style identifiers when known.
7. Return candidates and evidence for confirmation; persist the user's selection.

Serper provides Shopping and image results, but a complete structured variant endpoint has not been confirmed. Validate its actual output before committing to extraction details. A product ID in a search response does not prove complete variant coverage or image correctness.

Make search country/language explicit and include them in cache keys. Discovery in another market does not imply delivery to Kenya or local availability. This MVP is a wishlist, not a local inventory or price-comparison guarantee.

AI is optional for query normalization or extracting candidate attributes from retrieved material. It must not invent colorways, identifiers, offers, or image URLs. Core saving should not require an LLM service.

For server-side URL fetching, restrict protocols, reject private/internal destinations and unsafe redirects, and cap response size, fetch time, and redirects. Treat retrieved HTML as untrusted data. Apply authorization and limits to uploads and search endpoints.

## Image accuracy and presentation

- Correct product and variant take priority over visual polish.
- Prefer an isolated, sharp product image from the confirmed variant's source.
- Present items with consistent framing, padding, and sizing without cropping away important product details.
- Allow users to replace the image or choose another angle.
- Keep the original when producing a processed image.
- Background removal is desirable but remains an implementation decision: evaluate browser processing versus a bounded server/API option for cost, licensing, and mobile performance.
- Never generate or recolor a product image to represent an unverified variant.
- Retain source page/image provenance. Copy, cache, and transform third-party images only as permitted by the applicable terms. A search API response does not grant image reuse rights.
- Image-processing failure must not prevent saving the original.

## Infrastructure

| Layer | Choice |
| --- | --- |
| Full-stack app | TanStack Start, React, TypeScript |
| Build and hosting | Vite + Cloudflare Vite plugin, Workers |
| Client server-state management | TanStack Query |
| Forms and validation | TanStack Form plus shared validation schemas |
| UI primitives | Shadcn, custom project styling; prefer Phosphor icons |
| Persistent relational data | Cloudflare D1 + Drizzle |
| Image objects | Cloudflare R2 |
| Guest data | IndexedDB |
| Auth | Better Auth with Google |
| Monitoring | Sentry with integration appropriate to the Workers runtime |
| Product/image discovery | Existing Serper account |
| Dynamic extraction fallback | Browser Run, only if needed |

Use Start server functions/server routes for the initial backend. No separate Hono service is currently necessary. Add durable background processing only if real image/extraction jobs require it; do not depend on an untracked fire-and-forget task for a saved asset.

## Cost and usage policy

- Target a small-MVP core Cloudflare budget around $0–5/month within included allowances; this is an estimate, not an unlimited-service promise.
- D1 and R2 have included allowances. Extra processing, browser use, provider calls, and usage above allowances can add costs.
- Serper advertises a 2,500-query free trial, not a confirmed recurring monthly allowance. Sean's actual account balance/plan must be checked separately.
- Its published starter offer at planning time is $50 for 50,000 queries with six-month credit validity. Verify actual endpoint credit consumption and current terms before estimating per-item costs.
- An item can require multiple provider calls. Submit explicitly, avoid keystroke searches, reuse allowed cached results, and request alternate images only on demand.
- Add server-side anonymous/account rate limits, a provider usage ledger or equivalent, and an application spending limit. Do not expose an unlimited anonymous proxy to a paid API.
- When credits are exhausted or the provider fails, keep existing lists usable and allow manual/link additions where extraction is available.

## Visual direction

Sean wants a modern, polished, visually distinctive product tailored to his aesthetic. No specific screen reference has been supplied yet.

Use typography, spacing, hierarchy, restraint, and product photography as the foundation. Avoid generic dashboard styling, repetitive icon cards, decorative clutter, or adopting a component library's default look as the final identity. Use Phosphor icons sparingly.

Build interfaces directly in code and prepare a live Codex browser preview for Sean to inspect. Use relevant installed design skills when implementation begins. If a concrete reference is later provided, match it closely and preserve approved areas during iteration.

## MVP boundaries

Included: three item-add methods, product/model disambiguation, discovered variant selection, image selection/replacement, guest persistence, editable wishlist, purchase state, and Google backup/sync.

Deferred unless explicitly requested: checkout, payments, price-drop alerts, scraping entire retailer catalogs, automatic exhaustive colorway inventories, outfit building, social feeds, sharing/collaboration, affiliate integrations, visual recognition, and an AI shopping assistant.

Do not treat deferred features as prerequisites for the assigned core flow.

## Current scaffold and known gaps

Observed during setup:

- Project scaffolded with TanStack CLI 0.72.0; React, Vite, Cloudflare, ESLint, Sentry, Better Auth, Drizzle, Form, Shadcn, Query.
- Initial scripts contained literal HTML entities in shell commands. These were repaired.
- Current build script is `vite build`; preview/start uses `vite preview`. Removed Node-specific build output copying from the Cloudflare build script.
- Removed obsolete package.json `pnpm.onlyBuiltDependencies`; package build choices live in pnpm-workspace.yaml.
- unrs-resolver is currently explicitly denied build execution. Do not assume it was approved or change all build permissions globally to fix an unrelated issue.
- Retried the failed Shadcn command successfully. Button, Select, Input, Textarea, Slider, Switch, and Label files are present.
- The development server reported ready at http://localhost:3000/. That confirms server startup only, not successful page rendering or UI/API behavior. The process may need restarting in a new chat.
- Sentry DSN was absent. Server instrumentation currently uses a Node preload; monitoring across the actual Workers runtime still needs review and configuration.
- Drizzle currently uses `drizzle-orm/better-sqlite3` and DATABASE_URL. It is not wired to D1.
- wrangler.jsonc has the Cloudflare plugin's starter configuration, but no D1/R2 bindings yet.
- Better Auth is scaffolded with email/password enabled and no persistent database wiring. Google configuration and the intended account flow are not implemented.
- Homepage remains the TanStack starter screen. There is no wishlist UI or Serper integration.
- Git initialization was declined in the setup summary. Verify current Git state before assuming this directory has its own repository.
- Sean reported completing the interactive Intent step. On the later documentation pass, AGENTS.md existed, but `pnpm exec intent list` returned `@tanstack/intent is not installed`. Do not assume the local installation is healthy. Follow AGENTS.md and report the gap rather than downloading a replacement automatically.
- No tests, builds, or autonomous UI QA were executed as part of this handoff. The server was started, but the app was not clicked through.

## Working agreement for the next chat

- First read this document, AGENTS.md, any CLAUDE.md, and relevant project files. Preserve unrelated work.
- Follow the repository's Intent skill discovery instructions. Load appropriate installed library/design skills when available.
- Sean explicitly prohibits executing tests and autonomous UI testing. Write useful business-logic tests where appropriate, but leave execution to him. Reading code and preparing a live preview are allowed.
- Do not click through the implemented flow to perform QA. State verification boundaries honestly.
- Complete normal loading, empty, error, retry, cancellation, persistence, duplicate-submission, and recovery behavior within the assigned feature.
- Keep communication concise and focused on architecture, meaningful tradeoffs, and decisions.
- Prefer a branch in the existing checkout; do not create a worktree by default. Implementation assignments authorize commits/push/PR, but never merge or deploy without Sean's explicit instruction.

## Suggested implementation sequence

1. Confirm this spec's scope and inspect the generated scaffold. Resolve local Intent setup as needed.
2. Correct the Cloudflare foundation: D1 driver and local bindings, migrations, R2, Workers-compatible monitoring, and environment-variable documentation. Do not provision/deploy remote resources without authorization.
3. Deliver a small, polished local wishlist screen with guest persistence and manual image addition as a usable vertical slice.
4. Add the central Serper discovery and variant-confirmation flow, preserving real evidence and correction controls.
5. Add link extraction and optional image cleanup, with graceful fallbacks.
6. Add Google authentication and recoverable guest import to D1/R2.
7. Prepare the preview and a concise checklist for Sean's testing. Report missing integrations and unverified behavior explicitly.

The sequence is a proposal, not completed work. Product implementation should begin when Sean assigns it in the project chat.

## Primary references checked during planning

- TanStack Start stable announcement: https://tanstack.com/blog/tanstack-start-1-0
- Cloudflare TanStack Start guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Serper capabilities and pricing: https://serper.dev/
- Drizzle D1: https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1
- Better Auth TanStack integration: https://better-auth.com/docs/integrations/tanstack
- Better Auth Google: https://better-auth.com/docs/authentication/google
- Product variant structured data: https://developers.google.com/search/docs/appearance/structured-data/product-variants
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Browser Run pricing: https://developers.cloudflare.com/browser-run/pricing/

Capabilities and pricing can change. Recheck relevant primary docs when implementing.
