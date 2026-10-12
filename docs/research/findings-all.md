# EcoProof Research Pack: Findings for all seven tasks

Oct 12, 2026 · @Sai Harshith Raghavapuram

## Summary

All seven tasks are researched: R1, R2, R4, R5 and R6 are complete apart from the gaps listed; R7 and R8 are partial.

| Task             | Status                             | Gaps                                                                                                                                                                                  |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4 CBAM          | Complete except the Excel template | Commission .xlsx template could not be opened (binary; download blocked)                                                                                                              |
| R5 Rooftop solar | Complete except 2026 cost          | 2026 Telangana installed cost NOT FOUND (only the MNRE benchmark exists)                                                                                                              |
| R8 MSME schemes  | Partial                            | ZED share not computable from same-date figures; Telangana energy-audit scheme NOT FOUND; SIDBI publishes no numeric interest rate                                                    |
| R1, R7, R2, R6   | R1, R2, R6 complete; R7 partial    | R1: brief's FY corrected (v22 = FY 2025-26). R7: FSA rate, duty rate, bill line items NOT FOUND. R2: some % savings not stated (absolute kWh given). R6: CIMFR/BTR coal NCV NOT FOUND |

Sources that could not be opened: the Commission "Communication template for installations" .xlsx; a PM Surya Ghar answer on roof area (none exists); the ADEETIE cluster list; the live Udyam counter; the Telangana MSME Policy booklet (scanned images only).

## R4. EU CBAM supplier fields, CN codes, India default

Typical cast-iron foundry parts (CN 7325) are not in CBAM scope today; only cast pipes (7303) and cast fittings (7307) are. India's default for CN 7307 11 is 3.859 tCO2e/t, direct only.

### (1) Operator's emissions report: minimum content for the definitive period

The Excel template could not be opened. No definitive-period .xlsx is listed on the Commission's guidance or registry pages as of 12 Oct 2026. The binding field list is Annex IV of [Implementing Regulation (EU) 2025/2547](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R2547) of 10 Dec 2025. Article 10 requires the report to contain "the information listed in the templates in points 1.1 and 1.2 of Annex IV".

| #     | Section (Annex IV pt 1.1)                        | Main fields                                                                                                                                                                                                             | Also in summary sent to declarant (pt 1.2)?         |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Identification of operator and installation      | operator name; registration no.; full address in English; installation name; CBAM Registry installation ID; UN/LOCODE; geo-coordinates of main emission source                                                          | Y                                                   |
| 2     | Summary of monitoring plan                       | CBAM production processes & routes; non-CBAM processes; top-5 goods by CN code; top-5 fuels; top-5 process-emission materials; CEMS use; zero-rated fuels; measurable heat import/export                                | Partly (routes, heat, zero-rated fuels)             |
| 3–4   | Electricity (indirect)                           | electricity sources and quantities; on-site generation (co-gen / separate / fossil or renewable / exported)                                                                                                             | Y (pt 11)                                           |
| 5–6   | Waste gases; CO2 transfer                        | waste gases imported or exported; CO2 transfer recipient                                                                                                                                                                | Y                                                   |
| 7–8   | Total direct emissions                           | total direct emissions of the period; monitoring months for new installations                                                                                                                                           | Y                                                   |
| 9–12  | Electricity for non-Annex II goods               | total and per-good electricity; supplier installations; EF per source                                                                                                                                                   | Y (pt 6)                                            |
| 13–14 | Production                                       | goods produced per process and quantity; non-CBAM goods                                                                                                                                                                 | Y (pt 3)                                            |
| 15    | Per good                                         | specific direct embedded emissions (tCO2/functional unit); data quality/methods; share from default values; indirect shares (non-Annex II only)                                                                         | Y, plus embedded free allocation and benchmark used |
| 16–17 | Installation totals                              | activity data and calculation factors per source stream; measured sources; data gaps; heat/waste-gas/electricity balance                                                                                                | N                                                   |
| 18–25 | Precursors                                       | quantities own/purchased; CN code, name, country, default value used; actual specific embedded emissions; multi-period/multi-supplier rules                                                                             | Y (pts 12–16)                                       |
| 26–34 | Process attribution                              | electricity per process; attribution method; activity levels; goods per CN code and route                                                                                                                               | N                                                   |
| 35    | Sector parameters (pt 2), Iron or steel products | "The main reducing agent used in precursor production, if known. — Mass % of Mn, Cr, Ni, total of other alloy elements. — Tonnes scrap used for producing 1 t of the product. — % of scrap that is pre-consumer scrap." | Via pt 1.1                                          |

### (2) CN codes

| CN code                     | Description (as in source)                                                                                | In scope now (Y/N)           | Source                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 7303 00                     | "Tubes, pipes and hollow profiles, of cast iron"                                                          | Y                            | [Reg. (EU) 2023/956 consol. 20.10.2025, Annex I](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02023R0956-20251020) |
| 7307 11                     | "Tube or pipe fittings of non-malleable cast iron"                                                        | Y (heading 7307)             | Annex I (heading); description from IR 2025/2621 India table                                                                         |
| 7307 19 10                  | "Tube or pipe fittings of cast iron (excl. of non-malleable)"                                             | Y                            | same                                                                                                                                 |
| 7307 19 90                  | "Cast tube or pipe fittings of steel"                                                                     | Y                            | same                                                                                                                                 |
| 7318 (e.g. 7318 15)         | "Screws, bolts, nuts, coach screws… and similar articles, of iron or steel"                               | Y                            | Annex I                                                                                                                              |
| 7326 (19, 90 92, 90 94)     | "Articles of iron or steel, n.e.s. (excl. cast articles)"; forged/stamped; open-die and closed-die forged | Y                            | Annex I; IR 2025/2621                                                                                                                |
| 7325                        | "7325 – Other cast articles of iron or steel"                                                             | N (proposed from 1 Jan 2028) | [COM(2025) 989, 17.12.2025](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025PC0989)                                   |
| 7325 8-digit subheadings    | NOT FOUND in the sources opened                                                                           | N                            | —                                                                                                                                    |
| 7317 00                     | "Nails, tacks, drawing pins… staples… of iron or steel"                                                   | N (proposed 2028)            | COM(2025) 989                                                                                                                        |
| 8454 20 00 / 8454 30        | "Ingot moulds and ladles…"; "Casting machines… in metallurgy or in metal foundries"                       | N (proposed 2028)            | COM(2025) 989                                                                                                                        |
| 8708 40 / 8708 70 / 8708 80 | gear boxes and parts; road wheels and parts; suspension systems and parts (motor vehicles)                | N (proposed 2028)            | COM(2025) 989                                                                                                                        |

- Foundry relevance: typical cast-iron machine parts fall under 7325, which is not in scope today. Only cast pipes (7303) and cast fittings (7307 11 / 7307 19) are in scope now.
- Quoted line for the 2028 date (COM(2025) 989): "including the extension of scope to downstream products, will apply on 1 January 2028."
- Status: the proposal is not yet adopted and is heading to trilogue as of Oct 2026. That status comes from Mayer Brown (secondary; not opened).

### (3) EU default value for India

```json
{
  "country": "India",
  "cn_code": "7307 11",
  "description": "Tube or pipe fittings of non-malleable cast iron",
  "direct_tco2e_per_t": 3.859,
  "indirect_tco2e_per_t": "N/A",
  "total_tco2e_per_t": 3.859,
  "markup_rule": "total × 1.10 (2026), 1.20 (2027), 1.30 (2028+)",
  "markup_values_original_table": { "2026": 4.245, "2027": 4.631, "2028": 5.017 },
  "production_route_indicator": "none (BM independent of route)",
  "regulation": "Commission Implementing Regulation (EU) 2025/2621 of 16 Dec 2025, as corrected by Implementing Regulation (EU) 2026/1740 of 20 Jul 2026 (OJ 31.7.2026)",
  "table": "Annex I, India, Iron and steel",
  "quoted_row": "7307 11 | Tube or pipe fittings of non-malleable cast iron | 3,859 | N/A | 3,859",
  "quoted_markup_line": "For goods in the cement, iron and steel, aluminium and hydrogen sectors, the mark-up shall be 10 % for the year 2026, 20 % for the year 2027 and 30 % for the year 2028 and onwards.",
  "units_quoted": "(tCO2eq/tonne of good)",
  "source_url": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601740",
  "other_india_rows": {
    "7303 00": 2.84,
    "7307 19 10": 3.859,
    "7307 19 90": 4.32,
    "7318 15": 5.72,
    "7326 90 98": 4.91,
    "7201 pig iron": 2.53
  }
}
```

## R5. Rooftop solar defaults and Telangana net metering

Hyderabad yields about 1,463 kWh/kWp/yr (PVWatts); factories can net-meter up to 80% of contracted demand; PM Surya Ghar pays Rs 30,000/18,000 per kW up to Rs 78,000, households only.

```json
{
  "yield_kwh_per_kwp_yr": {
    "value": 1462.9,
    "settings": "PVWatts API v8.5.0; lat 17.385, lon 78.4867; system_capacity 1 kWdc; module_type 0 (standard); array_type 1 (fixed roof mount); tilt 20°; azimuth 180°; losses 14%; other inputs API defaults (not echoed); weather NSRDB PSM V3 Himawari TMY-2020, cell 17.37N 78.50E, 2.17 km away; AC output",
    "source_url": "https://developer.nlr.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=17.385&lon=78.4867&system_capacity=1&module_type=0&losses=14&azimuth=180&array_type=1&tilt=20",
    "date": "queried 12 Oct 2026",
    "quoted_line": "\"ac_annual\": 1462.883772674314",
    "sensitivity": { "open_rack_tilt20": 1463.3, "roof_tilt_17.385": 1461.0 }
  },
  "area_m2_per_kwp": {
    "value": "10 (MNRE FAQ) vs 12 (SECI FAQ): sources disagree",
    "mnre": {
      "source_url": "https://jbvnl.co.in/SOLAR/MNRE FAQ for consumer.pdf",
      "document": "FAQ: Grid Connected Solar Rooftop System (MNRE; hosted on a DISCOM site)",
      "date": "not shown",
      "page": "3, §1.3",
      "quoted_line": "A 1 kW rooftop system generally requires 10 sq. metres of shadow-free area."
    },
    "seci": {
      "source_url": "https://www.seci.co.in/upload/static/files/FAQ(1).pdf",
      "document": "SECI Frequently Asked Questions",
      "date": "not shown",
      "page": "Section A, Q1",
      "quoted_line": "A 1 kW rooftop system generally requires 12 sq. metres (130 square feet) of flat, shadow-free area (preferably south-facing)."
    },
    "pm_surya_ghar_portal": "NOT FOUND"
  },
  "netmeter_cap": {
    "domestic": "100% of sanctioned load",
    "industrial": "80% of sanctioned load/contracted demand",
    "overall_net_metering_max": "500 kWp (all categories except temporary)",
    "gross_metering_max": "1 MWp",
    "minimum": "1 kWp",
    "dt_feeder_limit": "cumulative RTS ≤ 50% of DT rated capacity; HT: ≤ 50% of feeder max load or substation capacity",
    "settlement": "monthly billing period; excess exported units paid at the lowest tariff in TGDISCOM solar PPAs/PSAs/PUAs under Sec 63 in the preceding FY; adjusted in next bill or paid to bank account",
    "export_unit_rule": "exports measured in kWh; if billing is in kVAh, PF of exported energy assumed unity",
    "tenure": "25 years from grid connection",
    "effective_date": "from date of publication in Telangana Gazette: 15.11.2025",
    "regulation": "TGERC (Rooftop Solar PV Grid Interactive Systems) Regulation, 2025 — Regulation No. 1 of 2025, No: TGERC/Secy/D.No:828/2025 Dt: 15.11.2025",
    "source_url": "https://tgerc.telangana.gov.in/file_upload/uploads/Regulations/Final/tserc/2025/Final%20Solar%20Roof%20top%20Regulation%201%20of%202025%2015112025.pdf",
    "pages": "cap: p.8 cl.4.9; 500 kWp: p.7 cl.4.2; settlement: p.17 cl.8.1.3(a); kWh/PF: p.17 cl.8.1.4; effective: p.2 cl.1.3",
    "quoted_lines": [
      "For residential and Government Consumers: upto a maximum of 100% of consumer's sanctioned load.",
      "For Industrial, Commercial and Other consumers: upto a maximum of 80% of sanctioned load/contracted demand of the consumer.",
      "the excess quantum of electricity units shall be settled at the rate equal to that of lowest tariff rate as per solar PPAs/PSAs/PUAs entered by TGDiscoms under Section 63 of the Electricity Act, in the preceding Financial Year.",
      "This Regulation shall come into force from the date of publication in the Telangana Gazette."
    ]
  },
  "pm_surya_ghar": {
    "cfa": "Rs 30,000/kW for first 2 kW (2 kW = Rs 60,000) + Rs 18,000 for 3rd kW; capped at Rs 78,000 for ≥3 kW: user's figures CONFIRMED",
    "300_units": "CORRECTED: a scheme objective (free/low-cost electricity up to 300 units/month from the household's own RTS), not a free-units entitlement",
    "eligibility": "residential consumers / RWA only; no CFA for commercial or industrial",
    "conditions": "DCR modules mandatory; registered vendor; implementation till 31 March 2027",
    "source_url": "https://pmsuryaghar.gov.in/ (home & FAQ) and Scheme Guidelines 'CFA to Residential Consumers' (consolidated, attached to MNRE OM F.No.318/140/2024-GCRT dated 31 Aug 2026)",
    "pages": "guidelines printed p.3 §2(d), §3(b); p.5 §5(d); p.6 §5(g),(h); p.8 §5(m)",
    "quoted_lines": [
      "Residential Sector (first 2 kWp of RTS capacity or part thereof) Rs 30,000/kWp",
      "Residential Sector (with additional RTS capacity of 1 kWp or part thereof) Rs 18,000/kWp",
      "For residential maximum subsidy of Rs. 78000/-",
      "To help provide free/low-cost electricity to 1 crore households up to 300 units of electricity per month by installation of rooftop solar.",
      "No CFA will be provided to non-residential segments of consumers (including government segment, commercial and industrial segment etc.).",
      "The implementation period of the scheme shall be till 31st March, 2027."
    ],
    "amendment_check": "2nd amendment (OM 31 Aug 2026) only extends Phase-II claim deadline to 30 Nov 2026; CFA rates unchanged"
  },
  "cost_inr_per_kw": {
    "telangana_2026_installed_cost": "NOT FOUND",
    "mnre_benchmark": "Rs 50,000/kW for first 2 kW; Rs 45,000 for additional kW (w.e.f. 13 Feb 2024; used to set CFA)",
    "source": "PMSG CFA Guidelines, printed p.6 §5(g)",
    "quoted_line": "The benchmark cost for 1 kW system is fixed at ₹ 50,000/kW for the first 2 kW of RTS capacity and ₹ 45,000 for the additional kW with effect from 13th February, 2024."
  }
}
```

## R8. MSME schemes: ZED, SIDBI, Telangana

All three ZED guesses are confirmed (fees, joining reward, subsidy %); bank concessions depend on the certification level; no Telangana energy-audit subsidy was found.

| scheme         | item                                                 | value                                                                                                                                                  | eligibility / condition                                                                                                                                                  | source URL                                                                                                                                                            | date                                                  | quoted line                                                                                                                                     |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ZED            | Certification fee                                    | Bronze Rs 10,000 / Silver Rs 40,000 / Gold Rs 90,000 (confirmed)                                                                                       | includes verification, assessment, certification, monitoring, taxes                                                                                                      | [ZED Guidelines 2022](https://zed.msme.gov.in/uploads/Guideline_Book.pdf) (§3.4.4, p.15)                                                                              | Guidelines 2022                                       | "Certification Level 1: : Rs. 10,000/- a. BRONZE Certification Level 2: : Rs. 40,000/- b. SILVER Certification Level 3: : Rs. 90,000/- c. GOLD" |
| ZED            | Joining reward                                       | Rs 10,000; makes Bronze effectively free (confirmed)                                                                                                   | once only; valid 1 year after pledge; for Silver/Gold deducted first, then subsidy applies                                                                               | [ZED subsidy page](https://zed.msme.gov.in/subsidy-on-cost-of-certification)                                                                                          | date not shown                                        | "if an MSME uses the reward for applying for Bronze Certification, the effective cost to MSME becomes zero"                                     |
| ZED            | Subsidy by size                                      | Micro 80% / Small 60% / Medium 50% (confirmed)                                                                                                         | +10% for women/SC/ST owned or NER/Himalayan/LWE/Island/aspirational districts; +5% if in SFURTI or MSE-CDP                                                               | same                                                                                                                                                                  | date not shown                                        | "i. Micro Enterprises: 80% ii. Small Enterprises: 60% iii. Medium Enterprises: 50%"                                                             |
| ZED            | Validity / surveillance                              | 3 years; surveillance at 18 months: Silver Rs 10,000, Gold Rs 20,000 (same subsidy %)                                                                  | Silver and Gold only                                                                                                                                                     | Guideline\_Book.pdf p.19, p.23                                                                                                                                        | 2022                                                  | "The certificate provided will be valid for a period of 3 years."                                                                               |
| ZED bank       | SBI                                                  | Bronze 5 bps + 5%; Silver 15 bps + 15%; Gold 25 bps + 25% (processing/upfront fee)                                                                     | by level                                                                                                                                                                 | [ZED bank incentives](https://loginzed.msme.gov.in/Incentive/Details?it=Financial&ct=Bronze) (and &ct=Silver, &ct=Gold)                                               | date not shown                                        | "5% concession in processing charges/upfront fees 5 bps interest concession" (Bronze)                                                           |
| ZED bank       | SIDBI                                                | Bronze 5 bps + 5%; Silver 15 bps + 15%; Gold 25 bps + 25%                                                                                              | by level                                                                                                                                                                 | same                                                                                                                                                                  | date not shown                                        | "5 bps in Interest rate and 5% in Processing/ upfront fees" (Bronze)                                                                            |
| ZED bank       | Bank of Maharashtra                                  | 25% processing fee + Bronze 25 bps / Silver 35 bps / Gold 50 bps                                                                                       | by level                                                                                                                                                                 | same                                                                                                                                                                  | date not shown                                        | "25% concession in processing fees, 25 bps concession in rate of interest" (Bronze)                                                             |
| ZED bank       | Bank of Baroda                                       | 25% processing charges; or 25% + 25 bps ROI                                                                                                            | ROI concession only if ROI not below BRLLR/MCLR+SP; same at all levels                                                                                                   | same                                                                                                                                                                  | date not shown                                        | "25% concession in Processing Charges and ROI concession of 25 bps (Subject to, applicable ROI is not below than BRLLR / MCLR+SP)"              |
| ZED            | Certified units                                      | Bronze 750,928; Silver 9,910; Gold 5,825; registered/pledged 1,057,273                                                                                 | live dashboard; share NOT computed (no same-date Udyam total; last dated Udyam figure 4,77,53,885 is "as of 27/07/2024")                                                 | [zed.msme.gov.in](https://zed.msme.gov.in/); [Udyam counter](https://udyamregistration.gov.in/Government-India/Ministry-MSME-registration.htm)                        | date not shown / 27-07-2024                           | "750928 BRONZE CERTIFIED 9910 SILVER CERTIFIED 5825 GOLD CERTIFIED"                                                                             |
| SIDBI          | 4E (End to End Energy Efficiency), current live page | up to Rs 15 cr; 100% finance with 25% FD security, or max 75% under promoter-contribution model; repayment up to 84 months incl. ≤12 months moratorium | manufacturing or services MSMEs; ≥3 years of operations and cash profits; must establish EE/GHG reduction; E&S compliance                                                | [SIDBI green finance](https://www.sidbi.in/green-finance) (4E tab)                                                                                                    | date not shown                                        | "MSMEs having minimum 3 years of operations and cash profits."                                                                                  |
| SIDBI          | 4E interest rate                                     | "MCLR Linked"; numeric range NOT FOUND                                                                                                                 | —                                                                                                                                                                        | same                                                                                                                                                                  | date not shown                                        | "MCLR Linked attractive rate of Interest."                                                                                                      |
| SIDBI          | 4E, older document (conflicts with live page)        | Rs 10–150 lakh; up to 90%; ≥3 years; cash profit last 2 years; rating C1–C8; Detailed Energy Audit by BEE-certified auditor; DPR vetted by SIDBI EEC   | superseded? use the live page                                                                                                                                            | [SIDBI 4E older document](https://development.sidbi.in/files/product/3.%20Financing%20Schemes%20for%20Sustainable%20Development.pdf)                                  | date not shown                                        | "Proposal should be in the range of C1-C8."                                                                                                     |
| SIDBI          | Green Finance Scheme (GFS)                           | up to Rs 50 cr, max 75% of project cost; repayment up to 10 years incl. ≤18 months moratorium; MCLR-linked; CGTMSE/PRSF cover possible                 | EE, RE, CBG, water, waste, e-mobility projects                                                                                                                           | [SIDBI green finance](https://www.sidbi.in/green-finance)                                                                                                             | date not shown                                        | "Financing upto Rs. 50 crore subject to maximum of 75% of the total project cost."                                                              |
| MoMSME / SIDBI | MSE-GIFT (under RAMP)                                | 2% p.a. interest subvention, max 5 years, term loans up to Rs 2 cr; Risk Sharing Facility                                                              | Udyam micro and small units only; machine must be on the 890-technology list; no defaults; cannot use CGTMSE and GIFT guarantee together; apply via participating lender | [SIDBI MSE-GIFT FAQ](https://www.sidbi.in/assets/front/pdf/FAQ-GIFT.pdf) (p.1)                                                                                        | date not shown                                        | "offering a 2% interest subvention per annum for a maximum of 5 years on term loans up to INR 2 crores"                                         |
| BEE / MoP      | ADEETIE                                              | 5% subvention (micro and small), 3% (medium); FY 2025-26 to 2027-28; funds investment-grade audits and DPRs                                            | foundry is one of 14 sectors; must show 10% energy savings; 60 clusters, Hyderabad inclusion NOT FOUND                                                                   | [BEE ADEETIE](https://adeetie.beeindia.gov.in/adeetie-scheme)                                                                                                         | date not shown                                        | "5% interest subvention for Micro and Small Enterprises"                                                                                        |
| Telangana      | Energy-audit / EE-equipment subsidy                  | NOT FOUND                                                                                                                                              | —                                                                                                                                                                        | industries.telangana.gov.in                                                                                                                                           | —                                                     | —                                                                                                                                               |
| Telangana      | Cleaner Production Subsidy (MSME Policy 2024)        | 25%, max Rs 5 lakh                                                                                                                                     | new MSMEs commencing 18/09/2024–31/03/2029 or substantial expansion; TGPCB certificate needed; claim within 6 months of commercial production                            | [Telangana MSME Policy 2024 operational guidelines](https://industries.telangana.gov.in/Library/Incentives%20guidelines-Final%20Version.pdf) (§2.1.11 p.8; §4.9 p.20) | G.O.Ms.No.16 dt 18/09/2024; guidelines date not shown | "Cleaner Production Subsidy : 25% subsidy on Specific Cleaner Production Measures limited to Rs.5.00 Lakhs."                                    |
| Telangana      | Quality / ZED certification reimbursement            | 50%, max Rs 2 lakh per certificate (SC/ST/PwD 100%, max Rs 3 lakh); cap counts all sources                                                             | same eligibility; GHMC area excluded except industrial estates/parks; Sanathnagar, Azamabad, Chandulal Baradari and Kattedan estates fully excluded                      | same (§4.8 p.19; §1.2 p.6)                                                                                                                                            | same                                                  | "the total subsidy from all sources is limited to Rs.2.00 Lakhs/certificate."                                                                   |

## R1. CEA grid emission factor, version 22.0

Use 0.675 tCO2/MWh. Version 22.0 (August 2026) covers FY 2025-26, not FY 2024-25 as the brief assumed; FY 2024-25 is 0.710 in the same version.

```json
{
  "version": "v22.0",
  "fy": "2025-26",
  "value_t_per_mwh": 0.675,
  "gas_basis": "CO2",
  "table": "Table S (headline); ten-year series in Annexure-I",
  "page": "Table S: PDF p.6 (printed p.1); Annexure-I: PDF p.27 (printed p.22)",
  "quoted_line": "Table S: Weighted average emission factor, simple operating margin (OM), build margin (BM) and combined margin (CM) of the Indian Grid for FY 2025-26 (adjusted for cross-border electricity transfers) (including RES & Captive power injection into grid), in tCO2/MWh — Average OM BM CM 0.675 0.963 0.446 0.705",
  "source_url": "https://cea.nic.in/api/cdm-report-version/view-pdf/en/82",
  "document": "CO2 Baseline Database for the Indian Power Sector, User Guide Version 22.0, August 2026, CEA",
  "includes_renewables": true,
  "other_years": { "2024-25": 0.71, "2023-24": 0.727, "2022-23": 0.716 },
  "other_years_quoted": "2022-23* 1108.11 1320.18 203.55 1547.80 0.716 | 2023-24 1203.36 1408.45 225.83 1654.54 0.727 | 2024-25 1235.96 1461.85 255.01 1740.54 0.710 | 2025-26 1189.29 1424.19 310.58 1761.28 0.675",
  "other_margins_fy2025_26": { "OM": 0.963, "BM": 0.446, "CM": 0.705 }
}
```

- **Correction to the brief:** v22.0 adds FY 2025-26 data. Its revision history says it was "Added data for FY 2025-26" with "Actual captive data incorporation for the year 2024-25", so the FY 2024-25 value was revised in this version.
- **Gas basis:** CO2 only. Every factor is stated in tCO2/MWh, and the guide mentions no CH4 or N2O.
- **Renewables:** included. The guide says the weighted average "also includes generation from Renewable sources and grid connected captive stations."
- **Units:** per MWh of net generation into the grid. The guide does not mention transmission and distribution losses.
- **Link fix:** the URL in the brief (cea.nic.in/wp-content/…/User\_Guide\_\_Version\_22.0.pdf) now redirects to a login page. The working link is the API URL above.
- **Internal inconsistency:** FY 2025-26 total CO2 is 1189.04 Mt on p.13 but 1189.29 Mt in Annexure-I. Both give 0.675 after rounding.

## R7. TGSPDCL tariff rates, FY 2026-27

Replace the ₹400/kVA placeholder with **₹500/kVA/month** (HT-I(A) 11 kV, energy ₹7.65/kVAh). The ToD guess is confirmed. Billing demand (higher of MD or 80% CMD) and minimum energy (50 kVAh per kVA) are confirmed.

Source for every row: [TGERC Retail Supply Tariff Order FY 2026-27](https://tgerc.telangana.gov.in/file_upload/uploads/Tariff%20Orders/Current%20Year%20Orders/2026/RST%20Order%20FY%202026-27.pdf) (O.P. Nos. 79 & 80 of 2025, signed 30.03.2026). Page = order's printed page.

| category                               | item                               | value                                                                                              | unit                                                                       | effective from | page                                                  | quoted line                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HT-I(A) 11 kV                          | Energy charge (normal, 10 pm–6 am) | 7.65                                                                                               | Rs/kVAh                                                                    | 01.04.2026     | 269 (§4.16.4)                                         | "HT - I(A): Industry General 11 kV kVA 500 7.65"                                                                                                                                              |
| HT-I(A) 11 kV                          | Demand charge                      | 500                                                                                                | Rs/kVA/month of billing demand                                             | 01.04.2026     | 269                                                   | "\*Demand charge is calculated at Rs. /kVA/month of the Billing Demand"                                                                                                                       |
| HT-I(A) 11 kV                          | ToD peak 6–10 am & 6–10 pm         | +1.50 (= 9.15)                                                                                     | Rs/kVAh                                                                    | 01.04.2026     | 269 (§4.16.3–4.16.5)                                  | "A time-of-day tariff of Rs. 1.50 per kVAh in addition to the normal energy charges at respective voltages is applicable during peak hours of 06:00 am to 10:00 am and 06:00 pm to 10:00 pm." |
| HT-I(A) 11 kV                          | ToD day rebate 10 am–6 pm          | −0.50 (= 7.15)                                                                                     | Rs/kVAh                                                                    | 01.04.2026     | 269                                                   | "An incentive of Rs.0.50 per kVAh to the normal energy charges at respective voltages is applicable during the daytime i.e., from 10:00 am to 06:00 pm."                                      |
| HT-I(A) 11 kV, CMD ≤150 kVA (optional) | Demand / energy                    | 100 / 8.00                                                                                         | Rs/kVA/month / Rs/kVAh                                                     | 01.04.2026     | 270 (§4.16.6–4.16.8)                                  | "11 kV kVA 100 8.00"                                                                                                                                                                          |
| HT-I(A)                                | Billing demand                     | max(recorded MD, 80% of CMD)                                                                       | kVA                                                                        | 01.04.2026     | 282 (§4.28.1)                                         | "The billing demand shall be the maximum demand recorded during the month or 80% of the contracted demand, whichever is higher."                                                              |
| HT (all)                               | Maximum demand definition          | 2 × largest kVAh in any 30 min (CMD > 4,000 kVA: 4 × largest 15-min kVAh)                          | kVA                                                                        | 01.04.2026     | 281 (§4.27.4)                                         | "twice the largest number of kilo-volt-ampere hours (kVAh) delivered at the point of supply to the consumer during any consecutive 30 minutes in the month"                                   |
| HT-I(A)                                | Minimum energy charge              | max(actual, 50 kVAh per kVA of billing demand)                                                     | kVAh/kVA/month                                                             | 01.04.2026     | 282 (§4.28.2)                                         | "Energy charges will be billed on the basis of actual energy consumption or 50 kVAh per kVA of billing demand, whichever is higher."                                                          |
| HT (all)                               | Excess demand penalty              | RMD 100–120%: 2× demand charge on excess; 120–200%: also 1.15× energy on full energy; >200%: 1.20× | multiplier                                                                 | 01.04.2026     | 281 (§4.27.7)                                         | "Above 120% and up to 200% 2 times normal charge 1.15 times normal charge"                                                                                                                    |
| HT (all)                               | Power factor                       | no LPF surcharge (kVAh billing); keep 0.95 lag–0.95 lead; leading kVArh is unblocked for HT        | —                                                                          | 01.04.2026     | 282 (§4.27.10); 296 (App. A item 12); 229 (§3.29.212) | "For all consumer categories where kVAh billing is done, no Low Power Factor surcharge shall be levied."                                                                                      |
| HT 11 kV                               | Customer charge                    | 2,000                                                                                              | Rs/month                                                                   | 01.04.2026     | 288                                                   | "HT Consumer at 11 kV 2,000"                                                                                                                                                                  |
| HT (all)                               | Delayed payment surcharge          | 5 paise/Rs 100/day or Rs 550, whichever is higher                                                  | —                                                                          | 01.04.2026     | 282 (§4.27.8)                                         | "5 paise/Rs.100/day or Rs.550 whichever is higher"                                                                                                                                            |
| LT-III Industry (≤75 kW/100 HP)        | Energy charge                      | 7.70                                                                                               | Rs/kVAh if contracted load ≥10 kW/13 HP; Rs/kWh below                      | 01.04.2026     | 250 (§4.4.3); 259 (§4.12.10c)                         | "Energy charges shall be billed on kVAh basis, for all consumers with contracted load of 10 kW/13 HP and above."                                                                              |
| LT-III                                 | Fixed charge                       | 100                                                                                                | Rs/kW/month on higher of contracted load or recorded demand (1 kVA = 1 kW) | 01.04.2026     | 250; 259 (§4.12.8)                                    | "The fixed charges shall be computed based on the contracted Load or actual Recorded Demand whichever is higher."                                                                             |
| LT-III                                 | Demand over 75 kVA                 | billed at HT-I (11 kV) demand charge                                                               | —                                                                          | 01.04.2026     | 259–260 (§4.12.10d)                                   | "such recorded demand shall be billed at the demand charge prescribed under HT - I (11 kV supply) with notice."                                                                               |
| LT-III                                 | ToD                                | not applicable (ToD list covers HT categories only)                                                | —                                                                          | 01.04.2026     | 245 (§3.32.1)                                         | "The following Time of Day (TOD) Tariffs are applicable for categories viz., HT - I(A) Industry General;…"                                                                                    |
| LT-III                                 | Capacitor surcharge                | 25% of monthly bill if capacitors absent/defunct (loads <13 HP, kWh-billed); no LPF surcharge      | % of bill                                                                  | 01.04.2026     | 267 (§4.15.3); 296 (App. A item 13)                   | "such consumer shall be liable to pay capacitor surcharge at 25% of the monthly bill amount"                                                                                                  |
| LT-III                                 | Minimum charges                    | NOT FOUND for LT-III (only other LT sub-categories state one)                                      | —                                                                          | —              | —                                                     | —                                                                                                                                                                                             |
| LT-III                                 | Customer charge                    | up to 20 HP: 100; 21–50 HP: 350; 51–125 HP: 1,200                                                  | Rs/month                                                                   | 01.04.2026     | 266                                                   | "LT - III: Industry 51 - 125 HP 1,200"                                                                                                                                                        |
| All                                    | FSA / FCA                          | extra, per TGERC Regulation No. 2 of 2023; current monthly rate NOT FOUND                          | —                                                                          | 01.04.2026     | 246 (§4.1.2)                                          | "Fuel Surcharge Adjustment (FSA)/Fuel Cost Adjustment (FCA) will be extra as per Regulation No.2 of 2023 as amended from time to time."                                                       |
| All                                    | Electricity duty                   | extra, per Telangana Electricity Duty Act, 1939; rate NOT FOUND in the order                       | —                                                                          | —              | 246 (§4.1.2)                                          | "The Tariffs are exclusive of the Electricity duty payable as per the provisions of the Telangana Electricity Duty Act, 1939"                                                                 |
| HT bill                                | Printed line items                 | NOT FOUND (no bill format in TGERC/TGSPDCL documents opened)                                       | —                                                                          | —              | —                                                     | —                                                                                                                                                                                             |

- **Reactive power catch:** TGERC has unblocked leading kVArh for kVAh billing. For HT it "shall continue" (§3.29.212); the LT exemption ran "upto 30th June 2026" (§3.29.211). Over-compensating with a fixed capacitor bank now raises kVAh, so the "Fix power factor" advice should recommend an automatic (APFC) panel tuned near unity, not a fixed bank.

## R2. Foundry energy-saving measures and capacitor bank cost

The capacitor price for "Fix power factor": BEE's 2011 foundry manual puts a 100 kVAr bank with APFC at ₹15,000–20,000; a BEE DPR vendor quote is ₹125/kVAr (capacitors only). Induction furnaces use 70–85% of a foundry's electricity.

Sources: [UNIDO/BEE/CII Technology Compendium, Belgaum Foundry Cluster (Sept 2020)](https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf); [BEE Manual on Energy Conservation Measures in Foundry Cluster, Batala-Jalandhar-Ludhiana (March 2011)](https://www.beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-646558505c8e64b3_1776139721.pdf); [BEE SME DPR: PF improvement by capacitor banks, BJL foundry cluster](https://sameeeksha.org/pdf/dpr/Batala_Jalandhar_Ludhiana_foundry_cluster/PF_improvement_by_installation_of_capacitor_banks_Batala_Jlndr_Ludh_Fdry_Cluster.pdf).

```json
[
  {
    "id": "if_lid_mechanism",
    "equipment": "induction furnace",
    "measure": "Install lid mechanism on induction furnace",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "saving_absolute": "heat loss 24.45 → 11.16 kWh per heat; 83,727 kWh/yr",
    "cost_inr_low": 350000,
    "cost_inr_high": 350000,
    "cost_basis": "one unit, 21 heats/day, 300 days/yr",
    "cost_year": 2020,
    "payback_stated": "6 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "65–66 (Table 19)",
    "quoted_line": "The annual monetary saving for this project is INR 5.30 lakhs, with an investment of INR 3.50 lakhs, and a payback period of 6 months."
  },
  {
    "id": "if_scr_to_igbt",
    "equipment": "induction furnace",
    "measure": "Replace SCR-based induction furnace with IGBT furnace",
    "saving_pct_low": 8.2,
    "saving_pct_high": 8.2,
    "saving_note": "computed from the source's SEC 656 → 602.1 kWh/t",
    "cost_inr_low": 2775000,
    "cost_inr_high": 2775000,
    "cost_basis": "per 500 kg furnace, 13.5 t/day",
    "cost_year": 2020,
    "payback_stated": "25 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "70–71 (Table 22)",
    "quoted_line": "Specific Energy Consumption kWh/Tonne 656 602.1"
  },
  {
    "id": "if_clean_charge",
    "equipment": "induction furnace",
    "measure": "Remove sand, dirt, oil and rust from charge; control tapping temperature",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "saving_absolute": "every 3% slag adds 6% power; every 70 °C overheating costs 27 kWh/t",
    "cost_inr_low": null,
    "cost_inr_high": null,
    "cost_basis": null,
    "cost_year": null,
    "payback_stated": "",
    "is_zero_cost": true,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "51",
    "quoted_line": "Every 3% slag would consume 6% additional power"
  },
  {
    "id": "pf_apfc_bank",
    "equipment": "power factor",
    "measure": "Capacitor bank with automatic power factor correction (APFC) panel",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "cost_inr_low": 15000,
    "cost_inr_high": 20000,
    "cost_basis": "per 100 kVAr capacitor bank with APFC",
    "cost_year": 2011,
    "payback_stated": "6 months (based on Punjab PF rebate)",
    "is_zero_cost": false,
    "source_title": "Manual on Energy Conservation Measures in Foundry Cluster, Batala-Jalandhar-Ludhiana (BEE, March 2011)",
    "source_url": "https://www.beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-646558505c8e64b3_1776139721.pdf",
    "page": "50 (§3.4.3.4)",
    "quoted_line": "Cost of a100 kvar capacitor bank with APFC with a rate of Rs. 15000 – 20000."
  },
  {
    "id": "pf_capacitor_dpr_vendor",
    "equipment": "power factor",
    "measure": "Add 83 kVAr capacitors to existing APFC (PF 0.96 → 0.99, 550 kW load)",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "cost_inr_low": 16675,
    "cost_inr_high": 16675,
    "cost_basis": "83 kVAr total installed (₹10,375 equipment @ ₹125/kVAr vendor quote + ₹1,300 taxes + ₹5,000 misc)",
    "cost_year": null,
    "payback_stated": "6 months (based on Punjab PF rebate)",
    "is_zero_cost": false,
    "price_type": "vendor quote",
    "source_title": "DPR: Power Factor Improvement by Installation of Capacitor Banks, BJL Foundry Cluster (BEE SME Programme; year not printed)",
    "source_url": "https://sameeeksha.org/pdf/dpr/Batala_Jalandhar_Ludhiana_foundry_cluster/PF_improvement_by_installation_of_capacitor_banks_Batala_Jlndr_Ludh_Fdry_Cluster.pdf",
    "page": "13 (§4.1, Table 4.1); 8 (Table 2.1)",
    "quoted_line": "Cost of the equipment is about ` 10375 (@ ` 125/kVAR) which includes the cost of the capacitors only as per the quotation provided by the vendors at Annexure 6."
  },
  {
    "id": "pf_kvar_compensator",
    "equipment": "power factor",
    "measure": "kVAr compensator and APFC at load end (500 kVA CMD, PF 0.85)",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "cost_inr_low": 120000,
    "cost_inr_high": 120000,
    "cost_basis": "one foundry, 500 kVA contract demand",
    "cost_year": 2020,
    "payback_stated": "13 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "93–94",
    "quoted_line": "The expected monetary savings to be achieved by installation of kVAr compensator is INR 1.1 lakhs, with an investment of INR 1.2 lakhs, and a payback period of 13 months."
  },
  {
    "id": "ca_screw_compressor",
    "equipment": "compressed air",
    "measure": "Replace reciprocating compressors with screw compressor, ring main and receiver (7.2 → 6.8 bar)",
    "saving_pct_low": 10,
    "saving_pct_high": 15,
    "cost_inr_low": 600000,
    "cost_inr_high": 750000,
    "cost_basis": "206 cfm at 7 bar; upper value includes air dryer",
    "cost_year": 2020,
    "payback_stated": "17–18 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "83–84 (Table 28)",
    "quoted_line": "Reduction in set pressure and arresting leakages gives energy savings of up to 10-15% from the present consumption."
  },
  {
    "id": "ca_compressor_vfd",
    "equipment": "compressed air",
    "measure": "VFD with closed-loop pressure control on screw compressor",
    "saving_pct_low": 25,
    "saving_pct_high": 85,
    "saving_note": "case: 8.28 → 6.23 kW",
    "cost_inr_low": 115000,
    "cost_inr_high": 115000,
    "cost_basis": "one screw compressor (case study)",
    "cost_year": 2020,
    "payback_stated": "30 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "96–97",
    "quoted_line": "Typical energy savings by installing VFD in a screw compressor will be in the range of 25% to 85%, based on the unloading percentage and unloading power."
  },
  {
    "id": "motors_ie3",
    "equipment": "motors",
    "measure": "Replace old rewound motors with IE3 motors (via EESL programme)",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "saving_absolute": "4,907 kWh/yr for 3 motors",
    "cost_inr_low": 44502,
    "cost_inr_high": 44502,
    "cost_basis": "3 motors, incl. transport and EESL PMC",
    "cost_year": 2020,
    "payback_stated": "18 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "80 (Table 27)",
    "quoted_line": "The expected energy savings to be achieved by replacing three old motors with IE3 motors is 4,907 units annually."
  },
  {
    "id": "ladle_lining",
    "equipment": "induction furnace",
    "measure": "Modify ladle lining to cut heat loss",
    "saving_pct_low": null,
    "saving_pct_high": null,
    "saving_absolute": "15 kWh per MT; 117,000 kWh/yr",
    "cost_inr_low": 613000,
    "cost_inr_high": 613000,
    "cost_basis": "one foundry, 312 days/yr",
    "cost_year": 2020,
    "payback_stated": "9 months",
    "is_zero_cost": false,
    "source_title": "Technology Compendium – Belgaum Foundry Cluster (UNIDO, Sept 2020)",
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "113–114",
    "quoted_line": "saving per MT of production kWh/MT 15"
  }
]
```

```json
[
  {
    "equipment": "induction furnace (share of electricity)",
    "enduse_share_pct": null,
    "enduse_share_pct_low": 70,
    "enduse_share_pct_high": 85,
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "40",
    "quoted_line": "In such foundry units, induction furnace is the major electricity consuming equipment; it consumes about 70-85% of total electrical energy consumption."
  },
  {
    "equipment": "melting (share of total energy, all fuels)",
    "enduse_share_pct": 75,
    "source_url": "https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf",
    "page": "41 (Figure 11)",
    "quoted_line": "Melting 75% Mould and core preparation 10% Sand preparation 6% Compressor 5% Lighting 2% Others 2%"
  },
  {
    "equipment": "mould and core preparation",
    "enduse_share_pct": 10,
    "source_url": "same",
    "page": "41 (Figure 11)",
    "quoted_line": "Mould and core preparation 10%"
  },
  {
    "equipment": "sand preparation",
    "enduse_share_pct": 6,
    "source_url": "same",
    "page": "41 (Figure 11)",
    "quoted_line": "Sand preparation 6%"
  },
  {
    "equipment": "compressor",
    "enduse_share_pct": 5,
    "source_url": "same",
    "page": "41 (Figure 11)",
    "quoted_line": "Compressor 5%"
  },
  {
    "equipment": "lighting",
    "enduse_share_pct": 2,
    "source_url": "same",
    "page": "41 (Figure 11)",
    "quoted_line": "Lighting 2%"
  },
  {
    "equipment": "others",
    "enduse_share_pct": 2,
    "source_url": "same",
    "page": "41 (Figure 11)",
    "quoted_line": "Others 2%"
  }
]
```

- **Capacitor paybacks do not transfer to Telangana.** Both BEE paybacks come from a Punjab power-factor rebate. TGSPDCL has no PF rebate and bills in kVAh (R7), so the saving comes from lower kVAh and billing demand. The app must recompute payback with the R7 tariff.
- **Figure 11 shares are total energy across all fuels,** not electricity only. Use the 70–85% electricity figure for induction-furnace foundries.
- **Not opened:** the Down To Earth Kolhapur article (secondary) and the Howrah compendium.

## R6. IPCC fuel factors

All five factors match the IPCC 2006 defaults exactly. Indian non-coking coal: CEA uses 95.8 gCO2/MJ (NCV basis) with a 0.98 oxidation factor, taken from India's Initial National Communication.

Source: [2006 IPCC Guidelines, Vol. 2 Energy, Ch. 1](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf), Table 1.2 (p.1.18) and Table 1.4 (pp.1.23–1.24). Computed kg CO2/kg = NCV (TJ/Gg) × CO2 factor (kg/TJ) ÷ 10^6.

| fuel                              | NCV (TJ/Gg)                              | CO2 (kg/TJ)                                                    | computed kg CO2/kg         | matches (Y/N)  | page                                           | quoted row                                                                                                         |
| --------------------------------- | ---------------------------------------- | -------------------------------------------------------------- | -------------------------- | -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| LPG                               | 47.3                                     | 63,100                                                         | 2.985                      | Y              | 1.18; 1.23                                     | "Liquefied Petroleum Gases 47.3 44.8 52.2" / "Liquefied Petroleum Gases 17.2 1 63 100 61 600 65 600"               |
| Residual fuel oil (furnace oil)   | 40.4                                     | 77,400                                                         | 3.127                      | Y              | 1.18; 1.23                                     | "Residual Fuel Oil 40.4 39.8 41.7" / "Residual Fuel Oil 21.1 1 77 400 75 500 78 800"                               |
| Coke oven coke                    | 28.2                                     | 107,000                                                        | 3.017                      | Y              | 1.18; 1.23                                     | "Coke Oven Coke and Lignite Coke 28.2 25.1 30.2" / "Coke oven coke and lignite Coke 29.2 1 107 000 95 700 119 000" |
| Natural gas                       | 48.0                                     | 56,100                                                         | 2.693                      | Y (CO2 factor) | 1.18; 1.24                                     | "Natural Gas 48.0 46.5 50.4" / "Natural Gas 15.3 1 56 100 54 300 58 300"                                           |
| Gas/diesel oil                    | 43.0                                     | 74,100                                                         | 3.186                      | Y              | 1.18; 1.23                                     | "Gas/Diesel Oil 43.0 41.4 43.3" / "Gas/Diesel Oil 20.2 1 74 100 72 600 74 800"                                     |
| Indian coal (CEA, India-specific) | NOT FOUND (CEA works on GCV per station) | 95,800 NCV basis; 90,600 effective on GCV after oxidation 0.98 | not computable without NCV | n/a            | CEA User Guide v22.0, Appendix B, printed p.27 | "EF based on NCV gCO 2 /MJ 95.8 89.5 106.2 54.3 75.5 72.6 69.3 0.0"                                                |

- **India-specific source:** CEA v22.0 says "The emission factors for Indian coal and lignite were based on the values provided in India's Initial National Communication under the UNFCCC (Ministry of Environment & Forests, 2004)." ([CEA User Guide v22.0](https://cea.nic.in/api/cdm-report-version/view-pdf/en/82), p.11)
- **Not found:** CSIR-CIMFR coal NCV and India's latest BUR/BTR coal values. No primary copy was opened; search returned only secondary or conference material.
- **Catch:** CEA's gas (54.3) and diesel (72.6) factors equal the IPCC lower 95% bounds, not the defaults (56.1, 74.1). For fuels burned in the factory, the app should use the IPCC defaults above; for grid electricity, use R1.

## Legal and loophole checks

The biggest catch: CBAM ignores grid-electricity emissions for iron and steel, so the app's electricity footprint cannot fill the CBAM sheet.

1. **CBAM counts only direct emissions for iron and steel.** Annex II of Reg. 2023/956 is the "List of goods for which only direct emissions are to be taken into account" and it includes all of chapter 72/73 iron and steel. For an induction-furnace foundry, most of the footprint is grid electricity, and that is not part of the CBAM embedded emissions. The CBAM sheet must not reuse the app's CEA-based electricity footprint; its numbers come from direct combustion/process emissions plus precursors (pig iron, crude steel, scrap share).
2. **Most foundry castings (7325) are outside CBAM until at least 2028,** and only if COM(2025) 989 is adopted. Showing a CBAM sheet for a 7325 product today could mislead. CN classification is the importer's or customs' decision, so the app should ask for the code rather than assign it.
3. **Actual values are only usable if an EU-accredited verifier checks them.** Guidance No. 2 says actual values "are eligible to be used instead of default values only if they are verified by an accredited verifier". Unverified data cannot lower the importer's bill; the importer falls back to defaults with the 10/20/30% mark-up. The "estimate, not verified" label is necessary, but the wording should not suggest it satisfies CBAM.
4. **Defaults use the total column only.** IR 2026/1740 recital 10 says direct/indirect defaults are "only… for information" and mark-ups are applied in the Registry on the total. The report must also be in English (Art. 10(4), IR 2025/2547).
5. **Small EU buyers may be exempt.** The de minimis rule (Art. 2a, Annex VII) exempts importers under "50 tonnes of net mass" per year across all CBAM goods, so some buyers may not need supplier data at all.
6. **PM Surya Ghar cannot be used for factories.** It is residential/RWA only, requires DCR modules and a portal-registered vendor, and ends 31 Mar 2027. "300 free units" is an objective, not an entitlement.
7. **TGERC rules limit factory solar sizing:**
   - Industrial systems are capped at 80% of contracted demand and 500 kWp under net metering.
   - Surplus is bought only at the lowest solar PPA rate, so oversizing loses money.
   - Exports are counted in kWh at unity PF while HT bills are in kVAh; the savings model must handle this.
   - Units with pending arrears are ineligible.
   - The 50% transformer/feeder caps can block approval.
   - Systems above 56 kWp need CEIG inspection.
8. **Bank ZED concessions are lender-published, vary by level and carry no date.** Re-check before showing them in a loan summary.
9. **Telangana incentives exclude existing units and four named Hyderabad estates** (Sanathnagar, Azamabad, Chandulal Baradari, Kattedan). Check where the target foundries are before promising any state subsidy. The Rs 2 lakh certification cap also blocks stacking with the central ZED subsidy beyond that amount.
10. **SIDBI 4E terms conflict between two SIDBI pages.** Use the live sidbi.in values.
11. **NREL's API now answers at developer.nlr.gov;** developer.nrel.gov failed to fetch. Update the app's endpoint.

12) **Leading kVArh is now billed (R7).** A fixed capacitor bank that over-corrects raises the kVAh bill; recommend an APFC panel held near unity.
13) **Tariff ≠ placeholder (R7).** The HT-I(A) 11 kV demand charge is ₹500/kVA/month, not ₹400; minimum billing (80% of CMD, 50 kVAh/kVA) penalises oversized contract demand.

## Sources

- [Regulation (EU) 2023/956 consolidated 20.10.2025](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02023R0956-20251020)
- [IR (EU) 2025/2547, Annex IV](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R2547)
- [IR (EU) 2025/2621 default values](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R2621)
- [IR (EU) 2026/1740 correcting act](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601740)
- [COM(2025) 989 downstream extension](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025PC0989)
- [CBAM legislation and guidance page](https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en)
- [Guidance No. 2 (14 Aug 2026)](https://taxation-customs.ec.europa.eu/document/download/91e1056c-4524-4705-aaa7-e25c1439a87a_en?filename=Guidance%20No.%202%20-%20Quick%20guide%20for%20non-EU%20operators%20on%20CBAM%20implementation.pdf)
- [Guidance No. 5d iron and steel](https://taxation-customs.ec.europa.eu/document/download/3eb64513-8255-4c71-875a-bd0a8c7ff772_en?filename=Guidance%20No.%205d%20-%20Sector-specific%20guidance%20document%20on%20iron%20and%20steel.pdf)
- [Mayer Brown on trilogue (secondary, not opened)](https://www.mayerbrown.com/ja/insights/publications/2026/10/eus-cbam-downstream-extension-and-anti-circumvention-amendments-the-road-to-trilogue)
- [PVWatts v8 API query](https://developer.nlr.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=17.385&lon=78.4867&system_capacity=1&module_type=0&losses=14&azimuth=180&array_type=1&tilt=20)
- [MNRE FAQ (hosted by JBVNL)](https://jbvnl.co.in/SOLAR/MNRE%20FAQ%20for%20consumer.pdf)
- [SECI FAQ](<https://www.seci.co.in/upload/static/files/FAQ(1).pdf>)
- [TGERC Regulation 1 of 2025](https://tgerc.telangana.gov.in/file_upload/uploads/Regulations/Final/tserc/2025/Final%20Solar%20Roof%20top%20Regulation%201%20of%202025%2015112025.pdf)
- [PM Surya Ghar portal](https://pmsuryaghar.gov.in/)
- [ZED Guidelines 2022](https://zed.msme.gov.in/uploads/Guideline_Book.pdf)
- [ZED subsidy page](https://zed.msme.gov.in/subsidy-on-cost-of-certification)
- [ZED bank incentives](https://loginzed.msme.gov.in/Incentive/Details?it=Financial&ct=Bronze)
- [Udyam registration counter](https://udyamregistration.gov.in/Government-India/Ministry-MSME-registration.htm)
- [SIDBI green finance](https://www.sidbi.in/green-finance)
- [SIDBI 4E older document](https://development.sidbi.in/files/product/3.%20Financing%20Schemes%20for%20Sustainable%20Development.pdf)
- [SIDBI MSE-GIFT FAQ](https://www.sidbi.in/assets/front/pdf/FAQ-GIFT.pdf)
- [BEE ADEETIE](https://adeetie.beeindia.gov.in/adeetie-scheme)
- [Telangana MSME Policy 2024 operational guidelines](https://industries.telangana.gov.in/Library/Incentives%20guidelines-Final%20Version.pdf)
- [Telangana MSME schemes handbook](https://industries.telangana.gov.in/Library/Total%20%20Book%20-%20MSME%20-%20Grand%20Final%20-%2007_10_2024.pdf)

* [CEA CO2 Baseline Database User Guide v22.0 (Aug 2026)](https://cea.nic.in/api/cdm-report-version/view-pdf/en/82)
* [TGERC Retail Supply Tariff Order FY 2026-27 (30.03.2026)](https://tgerc.telangana.gov.in/file_upload/uploads/Tariff%20Orders/Current%20Year%20Orders/2026/RST%20Order%20FY%202026-27.pdf)
* [UNIDO Technology Compendium, Belgaum Foundry Cluster (Sept 2020)](https://decarbonization.unido.org/wp-content/uploads/Technology-Compendium-Belgaum-Foundry-Cluster_resized.pdf)
* [BEE Manual on Energy Conservation Measures, BJL Foundry Cluster (March 2011)](https://www.beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-646558505c8e64b3_1776139721.pdf)
* [BEE SME DPR: PF improvement by capacitor banks, BJL foundry cluster](https://sameeeksha.org/pdf/dpr/Batala_Jalandhar_Ludhiana_foundry_cluster/PF_improvement_by_installation_of_capacitor_banks_Batala_Jlndr_Ludh_Fdry_Cluster.pdf)
* [2006 IPCC Guidelines Vol. 2 Ch. 1](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf)
