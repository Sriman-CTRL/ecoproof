# Open items

Values that are not in the source docs are left null in the seed data and tracked here.

## Emission factors

- [ ] CEA v22.0 grid factor (FY 2024-25): replace `grid_electricity_india` (currently v20.0, 0.727 t CO2/MWh).
- [ ] Verify LPG, furnace oil, foundry coke and natural gas factors against IPCC tables (status `verify`).
- [ ] Indian coal: fetch CSIR-CIMFR NCV and carbon factors. Not seeded.
- [ ] CBAM pig iron factors (`pig_iron_cbam_*`): `gas_basis` not stated in Doc 03; left null. Outputs stay "estimate, not verified".

## Tariffs

- [ ] TGSPDCL exact `valid_from` dates. Current dates are inferred from the financial year (see `basis_note`); `night_rebate` has no start date.

## Actions

- [ ] Capacitor bank cost (`fix_power_factor` cost_low / cost_high are null).
- [ ] 4-6 foundry capex measures: source from a BEE SME foundry cluster manual.

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
- [ ] Loan-ready summary cover: "years in operation" and "city" are not stored on `organisations`/`sites`; printed as "not given".
- [ ] Loan-ready summary: "vendor quotes compared" (Doc 05) needs quote documents; the prototype takes one owner-entered quote.
- [ ] Loan-ready summary: Doc 05 asks for "intensity before and after"; "after" is only printed for bill fixes ("unchanged"). kWh-saving measures need sourced kWh savings first.
- [ ] Scheme `last_checked_at` is null, so the report prints tariff rule lines only (Doc 05 asks for the date rules were last checked).

## Schemes

- [ ] `last_checked_at` for all schemes (currently null). Rules older than 60 days show a warning per Doc 02.

## Languages

- [ ] `apps/web/src/locales/te.json` is machine-drafted: needs native speaker review (Doc 07 gate).
- [ ] `apps/web/src/locales/hi.json` has only placeholder keys; the web app falls back to English for Hindi until it is written and reviewed.

## Bill health and insight card

- [ ] Peak-share flag threshold (20%) is Doc 03 text, now stored as `peak_flag_above_pct` in the TGSPDCL HT-I(A) `tod` rule; confirm against the tariff order.
- [ ] No diesel price in the data, so the insight card cannot value the diesel driver in rupees; it is named as the driver only when no rupee driver exists.
- [ ] Baseline acceptance limits (CV(RMSE) 15%, NMBE 5%, 9 months) are set in `apps/api/src/services/insights.ts`; move them to a versioned table.
- [ ] Capex cost range for `fix_power_factor` (capacitor bank) is null: shown as "cost pending: get a quote".

## Doc conflicts - see handover review

_Placeholder for the 8 doc conflicts. To be filled from the handover review._

## UI

- [ ] Source sheet (`SourceChip`) shows the whole bill image, not a crop around the value: extraction returns no field coordinates. Add coordinates to the extraction adapter to enable cropping.
- [ ] Home for Demo B should show "Rs saved this month / total so far" (Doc 06), but no endpoint returns savings yet, so it shows the latest bill total. Wire it to the savings ledger in S8.
- [ ] Action ranking: the API puts zero-cost actions first (rankNote), while design plan 6.2 says "ranked by rupees, never by ease". Home and bill health open the action worth most rupees a year (Fix power factor for Demo A); the Plan list keeps the API order, so its "Open the top action" opens the first zero-cost action. Decide one rule.
- [ ] Telugu strings added in D2 (nav, bills ledger, verify page, health) are machine-drafted: need native speaker review.
