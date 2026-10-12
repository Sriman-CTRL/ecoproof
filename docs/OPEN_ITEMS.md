# Open items

Values that are not in the source docs are left null in the seed data and tracked here.

## Emission factors

- [x] CEA v22.0 grid factor (R1): 0.675 t CO2/MWh for FY 2025-26 (from 2025-04-01) and 0.710 for FY 2024-25; the v20.0 0.727 row ends 2024-03-31 and is kept. v22.0 is used for FY 2026-27 bills until CEA publishes v23.0.
- [x] LPG, furnace oil, foundry coke, natural gas and diesel per kg confirmed against IPCC 2006 Tables 1.2/1.4 (R6).
- [ ] Diesel kg/L density source: `diesel_litre` (2.675 kg CO2e/L, India Default GHG Emission Values) is not cross-checked against the IPCC per-kg value; density was not researched.
- [ ] Indian coal: fetch CSIR-CIMFR NCV and carbon factors. Not seeded.
- [ ] CBAM pig iron factors (`pig_iron_cbam_*`): `gas_basis` not stated in Doc 03; left null. Outputs stay "estimate, not verified".

## Tariffs

- [x] TGSPDCL HT-I(A) 11 kV and LT-III rows from the TGERC RST Order FY 2026-27 (R7), valid from 2026-04-01, with page and quoted line.
- [ ] Older tariff rule rows (version `legacy`) still have `valid_from` inferred from the financial year; `night_rebate` has no start date. Kept as they are for older bills.
- [ ] FSA / FCA monthly rate and electricity duty rate NOT FOUND (R7): both are extra to the tariff and not modelled.
- [ ] HT bill printed line-item names NOT FOUND (R7): the sample bill uses key names (`customer_charge`, `low_pf_surcharge`).
- [ ] ToD rates are per kVAh (R7) but the bill gives peak use in kWh; the peak check applies the per-kVAh rate to kWh, which understates the charge by the power factor.
- [ ] LT-III customer-charge bands below 51 HP come from the same R7 table but only the 51-125 HP line is quoted.

## Actions

- [x] Capacitor bank / APFC cost (R2): Rs 20,000 (BEE 2011) to Rs 1,20,000 (UNIDO 2020), shown with its price year; payback recomputed from the TGSPDCL bill saving.
- [x] Foundry measures (R2): `igbt_furnace` (8.2% of furnace kWh x 70-85% furnace share), `clean_charge_and_tapping` (zero cost, not quantified), two compressor measures (saving pending).
- [ ] Compressor measures need the compressor's own kWh (measurement) before a saving can be shown; the 5% compressor share in UNIDO Figure 11 is of total energy, not electricity, so it is not used.
- [ ] Not yet added from R2: induction furnace lid, ladle lining, IE3 motors (absolute kWh savings per case, need a per-tonne or per-unit basis).
- [ ] IGBT saving assumes the unit melts in an SCR induction furnace; no site field records the furnace type yet.

## Solar

- [ ] Solar defaults: area per kWp and yield.
- [ ] Telangana net-metering cap.
- [ ] NREL API key (`NREL_API_KEY`).

## Calculation (packages/calc)

- [ ] Minimum-charge shortfall in rupees: Doc 03 gives the kVAh gap only, no Rs conversion. `checkMinimumCharges` values the gap at the bill's energy rate and returns that as an `assumption` string. Confirm the TGSPDCL billing method.
- [ ] Power factor plausibility range 0.5-1.0 (`checkPowerFactor` throws outside it) is a prototype sanity guard, not from Doc 03. Confirm or move to `tariff_rules`.
- [ ] Footprint label when fuel factors mix CO2 and CO2e bases: Doc 03 is silent. `scope1GasBasis` is null and the label says "gas basis mixed or not stated".

- [ ] Verified-savings significance: `savingsStatus` uses the standard error of cumulative savings = s*sqrt(m) (s = regression standard error, m = reporting months). Doc 03 says 'twice the model's standard error' without defining it.
- [ ] NRA sign convention: `monthlySavings` treats `nraKwh` as owner-declared extra energy from a non-routine change (positive = new machine or shift) added to the adjusted baseline. Doc 03 writes '± NRA' without fixing the sign.
- [ ] Solar `areaPerKwpM2` and `yieldKwhPerKwpYear` are still unsourced; `solarSize` throws when either is missing and never defaults them.
- [ ] Bill period length: `validateBill` treats periodStart and periodEnd as inclusive (1-30 Apr = 720 h) for the sanctioned-load check and overlap test. Confirm against TGSPDCL bill dates.

## Reporting

- [ ] BRSR Core field names.
- [ ] Loan-ready summary PDF is English only: Telugu and Hindi PDF templates (Doc 05 step 4) still to write and review.
- [ ] Loan-ready summary cover: "city" is not stored on `organisations`/`sites`; printed as "not given". Years in operation, Udyam category and GST status now come from the owner profile (S8b).
- [ ] Loan-ready summary: "vendor quotes compared" (Doc 05) needs quote documents; the prototype takes one owner-entered quote.
- [ ] Loan-ready summary: Doc 05 asks for "intensity before and after"; "after" is only printed for bill fixes ("unchanged"). kWh-saving measures need sourced kWh savings first.
- [x] Scheme rules now carry `last_checked_at` (12 Oct 2026, research R8); the loan pack prints it next to the tariff rules.

## Schemes

- [x] `last_checked_at` set for the sourced R8 rows (12 Oct 2026). Rules older than 60 days show a warning per Doc 02. The three legacy unsourced rows are kept inactive (reference rows are never deleted).
- [ ] No profile screen yet: the owner profile (Udyam category, years in operation, GST, cash profits, commencement date, women/SC/ST owned) is seeded for the demo orgs only. A missing field gives "Check with lender / the scheme office", never "likely".
- [ ] ZED readiness card: the design plan asks for the ZED energy and environment items EcoProof's data already covers, ticked. No sourced ZED item list yet, so the card leaves it out.
- [ ] MSE-GIFT: the 890-technology list is not checked, so the matcher says "Check with lender".
- [ ] ADEETIE: Hyderabad cluster inclusion not found (R8); always "Check with the scheme office".
- [ ] SIDBI 4E and GFS publish no numeric rate ("MCLR linked"); two SIDBI pages give conflicting 4E terms (live page used).
- [ ] Telangana MSME Policy 2024 incentives: GHMC area and four named Hyderabad estates are excluded. No site-location field to check this; new or expanding units get "Check with the scheme office".
- [ ] Bank ZED concessions are lender-published with no date; the card says "re-check with the bank before relying on it".
- [ ] Scheme names, reasons and benefit text come from `schemes.json` in English only; on the Telugu screen only the status labels are translated.
- [ ] PM Surya Ghar (household money found, R5) not added until household mode is built.

## CBAM supplier sheet

- [ ] The Commission's .xlsx template could not be opened (R4); tabs follow the Annex IV text of IR 2025/2547 instead.
- [ ] Direct emissions per tonne divide the installation's fuel emissions by all output in the period (production records); no per-process attribution.
- [ ] Precursors: only pig iron (owner-entered tonnes x EU India default 2.53, estimate) is counted; purchased steel has no factor, so the sheet always says it is incomplete.
- [ ] Fuel types other than diesel, LPG, furnace oil and foundry coke (kg or litre) are listed but not counted (no factor mapping).
- [ ] Carbon price paid in India: printed as "none entered" (Doc 05 says none is recognised as of June 2026).
- [ ] CN 7325 8-digit subheadings not found (R4); only the 7325 heading is in the picker. COM(2025) 989 is not yet adopted.
- [ ] Telugu strings under `schemes.*` and `cbam.*` (S8b) are machine-drafted: need native speaker review.

## Languages

- [ ] `apps/web/src/locales/te.json` is machine-drafted: needs native speaker review (Doc 07 gate).
- [ ] `apps/web/src/locales/hi.json` has only placeholder keys; the web app falls back to English for Hindi until it is written and reviewed.

## Bill health and insight card

- [ ] Peak-share flag threshold (20%) is Doc 03 text, stored as `peak_flag_above_pct` in the TGSPDCL HT-I(A) `tod` rules; the TGERC order sets the rates only, not a flag threshold.
- [ ] No diesel price in the data, so the insight card cannot value the diesel driver in rupees; it is named as the driver only when no rupee driver exists.
- [ ] Baseline acceptance limits (CV(RMSE) 15%, NMBE 5%, 9 months) are set in `apps/api/src/services/insights.ts`; move them to a versioned table.
- [x] Capex cost range for `fix_power_factor` now sourced (R2); shown with "2011 / 2020 prices; get a current quote".

## Doc conflicts - see handover review

_Placeholder for the 8 doc conflicts. To be filled from the handover review._

## UI

- [ ] Source sheet (`SourceChip`) shows the whole bill image, not a crop around the value: extraction returns no field coordinates. Add coordinates to the extraction adapter to enable cropping.
- [x] Action ranking: decided: Doc 02/03 order (zero-cost first, then payback, CO2 as tie-breaker, then higher annual Rs). The API's order is the only order; Home, bill health and Plan all open its #1.
- [ ] Telugu strings added in D2 (nav, bills ledger, verify page, health) are machine-drafted: need native speaker review.
- [ ] Landing page (D3): Telugu strings under `landing.*` are machine-drafted, and the Hindi headline `landing.data.title` in `hi.json` is hand-written for that one section only: both need native speaker review.
- [x] Landing page: the "Rs 2 per unit moved" figure (peak +1.50, day -0.50 per kVAh) is confirmed by the TGERC FY 2026-27 order (R7); landing figures now come from `apps/web/src/lib/sampleBill.ts`.
- [ ] Landing first load is about 250 KB transferred on mobile (target 200 KB): the shared app bundle (React, router, query, i18next, all three locale files) is 133 KB gzip, Latin fonts 79 KB, hero screenshot 28 KB. Closing the gap needs lazy locale files and a lighter router or font plan.
- [ ] Telugu strings added in S8a (`savings.*`, `reports.*`, `nav.reports`, `home.heroSaved`) are machine-drafted: need native speaker review.
- [ ] Savings chart bars start at zero, so a 5-6% saving is a small gap between bars and line; the rupee and kWh figures carry the message. Revisit if owners find it hard to read.
- [x] Home for Demo B now shows "Rs saved this month / total so far" from `GET /sites/:siteId/savings` (S8a).
