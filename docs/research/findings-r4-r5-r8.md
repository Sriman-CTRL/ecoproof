# EcoProof Research Pack: R4, R5, R8 Findings

Oct 12, 2026 · @Sai Harshith Raghavapuram

## Summary

R4 and R5 are complete except two gaps; R8 is partial; R1, R7, R2 and R6 are not yet done.

| Task             | Status                             | Gaps                                                                                                                               |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R4 CBAM          | Complete except the Excel template | Commission .xlsx template could not be opened (binary; download blocked)                                                           |
| R5 Rooftop solar | Complete except 2026 cost          | 2026 Telangana installed cost NOT FOUND (only the MNRE benchmark exists)                                                           |
| R8 MSME schemes  | Partial                            | ZED share not computable from same-date figures; Telangana energy-audit scheme NOT FOUND; SIDBI publishes no numeric interest rate |
| R1, R7, R2, R6   | Not started                        | Stopped for length; next round                                                                                                     |

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

Open question: R1, R7, R2 and R6 are still to be researched.

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
