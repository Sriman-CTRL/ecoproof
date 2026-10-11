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

## Reporting

- [ ] BRSR Core field names.

## Schemes

- [ ] `last_checked_at` for all schemes (currently null). Rules older than 60 days show a warning per Doc 02.

## Doc conflicts - see handover review

_Placeholder for the 8 doc conflicts. To be filled from the handover review._
