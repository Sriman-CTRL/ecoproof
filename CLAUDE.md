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
- Show rupees first, kWh second, CO2 third. Indian number grouping (1,00,000) via `Intl.NumberFormat('en-IN')` (`apps/web/src/lib/format.ts`).
- Grid factor is CO2-only: label totals "t CO2 (grid) + t CO2e (fuels)".

## Prototype deviations from Doc 07

- No worker or Redis: jobs run inline via `apps/api/src/jobs` (BullMQ worker later). No `apps/worker`.
- Demo login instead of phone OTP.
- English + Telugu strings only for demo screens (Hindi file is a placeholder).
- Prisma bypasses Supabase RLS, so the API MUST filter by `org_id` on every query.
- Deferred tables: purchases, buyer_requests, notifications, share_views, report_snapshots (reports holds snapshot_json).

## Data rules

- Only sample, or consented and anonymised, bills on the Gemini free tier.
- Never commit bills, `.env` or `apps/api/.env`. Never print env values.
- Reference rows (factors, tariff_rules, schemes, benchmarks, action_library) are upserted by natural key and never deleted: results store factor IDs. Check IDs are unchanged after re-seeding (`apps/api/prisma/dump-factor-ids.ts`).
- Schema additions not in Doc 07 are marked `/// ADDITION:` in `apps/api/prisma/schema.prisma`.

## Commands

`pnpm dev | build | test | lint | typecheck | format`
`pnpm --filter @ecoproof/api exec prisma migrate dev` and `pnpm --filter @ecoproof/api run db:seed`

## Glossary

kWh: energy unit. kVAh: apparent energy (HT is billed in kVAh). PF: power factor = kWh / kVAh. MD: maximum demand (kVA). CD: contracted demand. ToD: time-of-day tariff. HT-I(A): HT industrial tariff category. LT-III: LT industrial category. DISCOM: power distribution company. TGSPDCL: Telangana Southern DISCOM. CEA: Central Electricity Authority. CBAM: EU Carbon Border Adjustment Mechanism. SEE: specific embedded emissions. CN code: EU combined nomenclature code. HSN: GST goods code. BRSR Core: SEBI sustainability reporting core indicators. Udyam: MSME registration. ZED: Zero Defect Zero Effect certification. DPDP: Digital Personal Data Protection Act. NRA: non-routine adjustment. CV(RMSE): baseline fit error. NMBE: normalised mean bias error. EMI: loan instalment.

## Workflow

- Small sessions; point to exact files and doc sections.
- Run `pnpm typecheck && pnpm test` before every commit.
