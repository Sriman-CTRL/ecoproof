# EcoProof

EcoProof is a hackathon prototype of an MSME Carbon & Savings Platform (SDG 13). It reads electricity bills and fuel data, turns them into an energy and carbon pre-assessment, finds zero-cost bill savings, and produces a loan-ready summary for the lender's own assessment. First user: Hyderabad foundries (TGSPDCL, HT-I(A)). Household mode is second.

Packages: `@ecoproof/web` (Vite+React), `@ecoproof/api` (Express+Zod+Prisma), `@ecoproof/calc` (pure maths), `@ecoproof/shared` (Zod schemas, types).

## Doc map (docs/text/) - read only the section you need

| File                   | Answers                                  |
| ---------------------- | ---------------------------------------- |
| 00-platform-design     | Legal, cost, platform scope              |
| 00-gap-research-report | Market and gap research                  |
| 01-target-segment      | Who the users are                        |
| 02-feature-spec        | Features and IDs (ONB, INS, VER, ADM...) |
| 03-calculation-logic   | Formulas, factors, tariff checks, scores |
| 04-engagement          | Nudges, household mode, partner views    |
| 05-reports             | Report contents and templates            |
| 06-ux-design           | Screens, language, accessibility         |
| 07-tech-stack          | Stack, data model, flows, security       |

Precedence if docs overlap: numbers/formulas -> 03; features -> 02; tech -> 07; legal/cost -> 00-platform-design.
Open gaps live in `docs/OPEN_ITEMS.md`. Never invent a number, factor, tariff, rate, cost, date or URL: leave it null and add it there.

## The 8 calculation rules (Doc 03)

1. Activity-based, never spend-based: use kWh, kVAh, litres, kg, tonnes; rupees only for money.
2. Versioned factors: each factor stores value, unit, source, version, valid-from; each result stores factor row IDs.
3. Recalculation is explicit: past results stay as published; recalculated series shown side by side, labelled.
4. Location-based Scope 2: national CEA grid factor; self-used rooftop solar counts as zero.
5. Ranges, not false precision: action savings are low-high; verified savings carry an uncertainty band.
6. Owner confirms inputs: no extracted value is used until confirmed or it passes validation rules.
7. Per-unit intensity is the main metric (kWh or kg CO2 per tonne of output).
8. Estimates are labelled: any default value (e.g. CBAM precursor) is tagged "estimate" everywhere.

`packages/calc` is pure: inputs and factors are passed in; it returns values + factor_ids + formula_version. No I/O, no Prisma.

## Wording

- Say "energy and carbon pre-assessment", never "energy audit".
- Say "loan-ready summary for the lender's own assessment", never "approved" or "sanctioned".
- CBAM outputs say "estimate, not verified".
- Rupees and CO2 side by side, equal weight; kWh is the supporting detail (decision 12 Oct 2026). Indian number grouping (1,00,000) via `Intl.NumberFormat('en-IN')` (`apps/web/src/lib/format.ts`).
- Grid factor is CO2-only: label totals "t CO2 (grid) + t CO2e (fuels)".

## Prototype deviations from Doc 07

- No worker or Redis: jobs run inline via `apps/api/src/jobs` (BullMQ worker later). No `apps/worker`.
- Demo login instead of phone OTP.
- English + Telugu strings only for demo screens (Hindi file is a placeholder).
- Prisma bypasses Supabase RLS, so the API MUST filter by `org_id` on every query.
- Deferred tables: purchases, buyer_requests, notifications. Report snapshots live in `report_snapshots`; share views in `share_views`.

## UI rules

Design plan: `docs/design/04-ui-design-plan.md`. Component kit: `apps/web/src/components/kit/` (preview at `/dev/kit` in dev).

Guardrails (plan 6.3):

- No streak counters that can be lost, no "You'll lose your progress!", no countdown timers, no fake urgency, no nagging beyond the 4-messages-a-month cap. A "12 months tracked" counter is fine because it never goes backwards.
- No points or coins of any kind. Rupees are the points. No wallets, lucky draws, spin wheels or scratch cards.
- No EcoProof document is called a certificate. ZED is the certificate we guide owners to. No ZED or government logos.
- "Verified" only as "Verified by your bills", with the method note on the progress statement and savings screen.
- No generic green labels and no tree or car equivalences without a sourced factor.
- Partner offers are labelled "Partner offer" and never appear inside the ranked action list.
- No inflated savings; every figure follows Doc 03 and shows its data quality.
- No public rank without opt-in; bottom positions visible only to the unit itself.

Fixed phrases (plan 7): "Energy and carbon pre-assessment", "Summary for the lender's own assessment", "Estimate, not verified", "Too early to confirm", "Likely eligible; confirm with the scheme office".

Banned words (whole word, any case; list in `packages/shared/src/wording.ts`, enforced by `apps/web/src/locales/locales.test.ts` and the API report tests): audit, approved, sanctioned, eligible, certified, compliant, certificate, verified, green certified, eco-friendly, carbon neutral, sustainable unit, green factory.

Allowed exact phrases (stripped before the banned-word scan): "Verified by your bills", "Estimate, not verified", "Likely eligible; confirm with the scheme office", "Not eligible" (Doc 02 FIN-1, always followed by the reason), "Verified data must be confirmed by an accredited verifier" (Doc 05 CBAM status line), "Not an energy audit", "ZED certification", "ZED certificate".

Verbatim source quotes are exempt: a stored `quoted_line` shown inside quote marks with its source (e.g. the TGERC "sanctioned load" line) is skipped by the banned-word scan (`findBanned(text, quotedLines)`). EcoProof's own words still count.

## Data rules

- Only sample, or consented and anonymised, bills on the Gemini free tier.
- Never commit bills, `.env` or `apps/api/.env`. Never print env values.
- Reference rows (factors, tariff_rules, schemes, benchmarks, action_library) are upserted by natural key and never deleted: results store factor IDs. Check IDs are unchanged after re-seeding (`apps/api/prisma/dump-factor-ids.ts`).
- Schema additions not in Doc 07 are marked `/// ADDITION:` in `apps/api/prisma/schema.prisma`.
- Demo numbers (SYNTHETIC, `apps/api/prisma/demo/assumptions.json`): TGERC FY 2026-27 HT-I(A) 11 kV rates Rs 7.65/kVAh, Rs 500/kVA, Rs 2,000 customer charge; CEA v22.0 grid 0.675 t CO2/MWh. Demo A Oct 2026: PF Rs 61,200 + contracted demand Rs 50,000 = Rs 1,11,200 a month at stake. Web copy reads sample figures from `apps/web/src/lib/sampleBill.ts`, never hard-coded rupees.

## Deploy (free tier)

- Web: Vercel Hobby, https://ecoproof-gray.vercel.app (root dir `apps/web`, `apps/web/vercel.json` SPA rewrite). `VITE_API_URL` = the API URL at build time.
- API: Render free, Docker (`Dockerfile`, `render.yaml`), Singapore, https://ecoproof-api.onrender.com. Env names in `render.yaml`; secrets set in the Render dashboard. `DOCUMENT_READER=fake` on the public site. `DATABASE_URL` uses the transaction pooler with `pgbouncer=true&connection_limit=3`.
- `calc` and `shared` build to `dist` for production only (`ecoproof-dist` export condition); dev, tests and Vercel use `src`.
- Migrations run from your machine (`prisma migrate deploy`), never on deploy. No public reset endpoint.
- Before a pitch: `PUBLIC_WEB_URL=https://ecoproof-gray.vercel.app pnpm --filter @ecoproof/api db:demo:reset`, then `pnpm smoke https://ecoproof-api.onrender.com https://ecoproof-gray.vercel.app` (wakes the API).
- Pushing to `main` redeploys both.

## Commands

`pnpm dev | build | test | lint | typecheck | format | smoke <apiUrl> <webUrl>`
`pnpm --filter @ecoproof/api exec prisma migrate dev` and `pnpm --filter @ecoproof/api run db:seed`

## Glossary

kWh: energy unit. kVAh: apparent energy (HT is billed in kVAh). PF: power factor = kWh / kVAh. MD: maximum demand (kVA). CD: contracted demand. ToD: time-of-day tariff. HT-I(A): HT industrial tariff category. LT-III: LT industrial category. DISCOM: power distribution company. TGSPDCL: Telangana Southern DISCOM. CEA: Central Electricity Authority. CBAM: EU Carbon Border Adjustment Mechanism. SEE: specific embedded emissions. CN code: EU combined nomenclature code. HSN: GST goods code. BRSR Core: SEBI sustainability reporting core indicators. Udyam: MSME registration. ZED: Zero Defect Zero Effect certification. DPDP: Digital Personal Data Protection Act. NRA: non-routine adjustment. CV(RMSE): baseline fit error. NMBE: normalised mean bias error. EMI: loan instalment.

## Workflow

- Small sessions; point to exact files and doc sections.
- Run `pnpm typecheck && pnpm test` before every commit.
