# "Add your unit's data" page: design and anti-manipulation checks (proposal)

Research note, 13 Oct 2026, for Sriman's approval. **Nothing here is built yet.** Once approved it becomes build step **D9** (after D7 "Get help" and D8 "Business check").
Builds on `scopes-bills-capture.md` (which bills, how to read them) and `08-login-and-business-check.md` (D8: Udyam/GSTIN badge, one consumer number per business), and does not repeat them. **UNCONFIRMED** marks anything not checked against a primary source. **OUR CHOICE** marks a design number that no source gives.

## 1. The page in one line

After login, a new owner without data lands on **"Add your unit's data"** instead of the sample foundry. It is a 5-step page; every number it collects ends on the existing confirm screen. Every number carries a label showing where it came from. Once confirmed, nobody can change a number without leaving a trace: not the owner, and not EcoProof.

"Manipulation" has two sides, and the page handles both:
- **Owner side:** a fake or edited bill, made-up production, or a "better" later bill to inflate savings.
- **Our side:** EcoProof (or anyone with database access) quietly changing a number after a statement is issued.

## 2. Where it sits

```
Login (demo one-click today; phone OTP later, see 08)
  ├─ "See the sample foundry" → Demo A (unchanged)
  └─ "Add my unit's data" → /start/data  (NEW)
        1 Business      → D8 business check (Udyam, GSTIN, electricity consumer number)
        2 Electricity   → bills, newest first
        3 Fuels         → diesel now; coke / furnace oil / LPG as in scopes-bills-capture.md
        4 Production    → tonnes of good castings per month
        5 Review + lock → confirm each month, then lock and seal
  → Home, with the footprint from the first locked bill
```

- **First result early:** the footprint shows after **one** locked bill.
- **Savings proof later:** the savings baseline needs more months. The design plan already says "The baseline unlocks at 9 months" with a 12-month strip (04-ui-design-plan.md), so reuse the existing YearStrip ("8 of 12 months").
- **Save and come back:** the page saves each step, so the owner can stop and return.

## 3. Step by step: what we ask and how we take it

| Step | What we ask | How it comes in (best first) | Label on the number |
|---|---|---|---|
| 1 Business | Udyam no., GSTIN, electricity consumer (service) number | Typed, then D8's checks. The consumer number is tied to one business | Self-declared / Matched to documents (D8) |
| 2 Electricity | Last 12 monthly bills, one at a time (3 is enough to start) | (a) PDF downloaded from the DISCOM site → text layer read, no AI. (b) Photo → Gemini → confirm. (c) Typed by hand | "From DISCOM PDF" / "Read from photo" / "Typed by owner" |
| 3 Fuels | Diesel litres per month (others per scopes note) | Invoice photo or PDF → Gemini; GST e-invoice QR when present (signed by the IRP, see 08) | "From invoice" / "From signed e-invoice" / "Typed by owner" |
| 4 Production | Tonnes of good castings per month | Typed. Optional evidence: monthly sales invoice total in tonnes | "Typed by owner" / "Matched to sales invoices" |
| 5 Review | Each month side by side with its document | Confirm screen (exists today) | Month locked + sealed |

**Why the DISCOM PDF is the best route.** It is the document the DISCOM itself produces, and a text-layer read has no AI guessing. TGSPDCL bills can be downloaded by consumer number (third-party guide in scopes-bills-capture.md). **UNCONFIRMED:** whether TGSPDCL's PDF has a text layer. Test one real bill before building route (a).

## 4. Anti-manipulation features

### A. Check every bill on its own (free, offline; the main new work)

| # | Check | Why it catches tampering | Source | Status |
|---|---|---|---|---|
| A1 | **Recompute the bill from the tariff.** Energy charge = kVAh × ₹7.65. Demand charge = billing demand × ₹500, where billing demand = higher of the recorded MD or 80% of contracted demand. If our total differs from the printed total beyond a small tolerance, flag "The bill's numbers don't add up" | Someone who edits the kWh/kVAh on a bill rarely re-does every rupee line. "Totals that fail to reflect the individual line items are common in fakes" (Resistant AI) | TGERC RST Order FY 2026-27, para 4.27.5, p.281: "The billing demand shall be the maximum demand recorded during the month or 80% of the contracted demand whichever is higher". Rates already live from S8c | NEW. Tolerance (e.g. 1%) is **OUR CHOICE**; FSA/ED lines are excluded until sourced |
| A2 | kWh ≤ kVAh; power factor = kWh ÷ kVAh, and between 0.5 and 1.0 | Edited energy figures break the physics | Doc 03 validation rules | Built |
| A3 | **Load factor ≤ 1:** kVAh ≤ MD × 24 × days in the bill period | A unit cannot use more energy than its peak demand allows over the month | TGERC para 4.27.4: MD = twice the largest kVAh in any 30 minutes. The inequality is our arithmetic, not a quoted rule | NEW |
| A4 | **PDF file check:** flag if the PDF's "Creator/Producer" names an editor (Word, Photoshop, an online PDF editor), if the file was made before the bill date, or if a "PDF" is really one flat image | Real provider PDFs are text-based. "Creator field shows editing software" and "Embedded image layers" are warning signs (Resistant AI) | Resistant AI guide | NEW. A flag, not a block: the owner can still go on, but the month is labelled "Needs a second look" |
| A5 | Same file twice → blocked (SHA-256 of the bytes, per business) | Re-uploading an old bill as a new month | S4 | Built |

### B. Check bills against each other

| # | Check | Source | Status |
|---|---|---|---|
| B1 | **One consumer number = one business.** Every bill must carry the consumer number from Step 1 | D8 (08-login-and-business-check.md) | In D8 |
| B2 | **No gaps, no overlaps:** bill periods must follow each other. A missing month is shown as a gap, never silently filled | Overlap rule: Doc 03. "Gaps in activity data" without explanation is a common deficiency verifiers flag (GloCert guide) | Overlap built; gap display NEW |
| B3 | **Meter readings continue:** this month's opening reading = last month's closing reading (× multiplying factor) | Our arithmetic. **UNCONFIRMED** that the TGSPDCL HT bill prints opening/closing readings and the multiplying factor: check a real bill | NEW, only if the bill prints them |
| B4 | **Sudden swing alert:** a month whose kWh per tonne moves far from the unit's own 12-month pattern is flagged for the owner to explain | "implausible usage swings" (Resistant AI). The threshold is **OUR CHOICE** | NEW |

### C. Check against the real world

| # | Check | Source | Status |
|---|---|---|---|
| C1 | **kWh per tonne sanity band.** Compare the unit's kWh per tonne with the industry norm and flag values far outside it | CII norm for induction melting: "620 kWh/ton" of liquid metal; four Indian cast-iron foundries measured 700, 720, 750 and 740 kWh/ton (Arasu & Jeffrey, *Energy Consumption Studies in Cast Iron Foundries*, 57th IFC 2009). Per tonne of good castings is higher (yield loss), so the band is **OUR CHOICE** and is shown as "unusual, please check", never as an accusation | NEW |
| C2 | **Production cross-check.** Optional: the owner's tonnes vs the tonnes on that month's sales invoices | "Cross-check GHG data against financial records" (GloCert guide) | NEW, optional |

### D. Lock and trail: what stops *us* from changing numbers

| # | Feature | Source | Status |
|---|---|---|---|
| D1 | **Lock on confirm.** A confirmed month is read-only. A correction creates a new version with a reason ("bill re-issued by DISCOM", "typing mistake"); the old version stays visible | Verifiers expect a "data log recording when data was received, from whom, and any processing performed" and a "Change log" (GloCert guide) | NEW (versioned months) |
| D2 | **Append-only history** per month: who, when, old value, new value, reason. No delete in the API | Same | NEW |
| D3 | **Every number traces to its file:** tap a month to see the original bill and its SHA-256. A reviewer should be able to "trace any reported emission figure back to its source activity data" (GloCert) | GloCert guide | Partly built (document id per month); NEW UI |
| D4 | **The statement seals the inputs, not only the PDF.** The carbon statement and loan summary list each month's file hash, so a later change to a month cannot match an issued statement | S7 seal + D6a statement | Small NEW change |
| D5 | **Public method:** the /carbon-method page shows every factor and formula, so anyone can recompute | D6b | Built |

### E. Honest labels on every output

Each month and each statement shows a **data strength** level: "From DISCOM PDF, checks passed" > "Read from photo, owner confirmed" > "Typed by owner" > "Needs a second look". The statement prints the mix (e.g. "10 of 12 months from DISCOM PDFs").

- **Why lenders care:** PCAF (the carbon-accounting standard banks use for loan books) scores data from 1 (best) to 5. As summarised by Keslio, "Score 2 covers unverified company emissions or primary energy data with matching emission factors" and "Score 1 uses verified company emissions". Our bill-based data is primary energy data. **UNCONFIRMED** (secondary source): the exact PCAF table wording; check PCAF Part A, Table 5.2-1, before quoting it to judges.
- **Wording:** no "verified" in our own text except "Verified by your bills" under the S8a rule.

### F. What we deliberately do NOT do (and why)

| Idea | Why not |
|---|---|
| Photo "forensics" (error level analysis, AI fake detectors) | Unreliable and easy to argue with. Even the C2PA provenance standard "fail[s] to achieve [its] claimed security goals" (Golaszewski et al., arXiv 2604.24890, Apr 2026). The math checks in A and B are stronger and explainable |
| Camera-only capture ("document liveness") | Liveness checks confirm "not a photo, scanned document, or deepfake" (Mitek glossary), but they need paid SDKs. A live photo of a printed fake still passes, and owners mostly have PDFs or WhatsApp photos. Roadmap |
| Fetch the bill from the DISCOM ourselves | No official TGSPDCL API found; scraping is not allowed (scopes note). BBPS bill fetch returns the bill amount and due date but no units (example response, dev.to guide), and only authorised BBPS participants can call it. Paid aggregators sell an electricity-bill lookup returning "full name, address, due date, bill amount etc." (Surepass; units and Telangana coverage UNCONFIRMED, price not stated). **Roadmap:** use it to match the bill amount and name, after EcoProof is a registered company |
| Smart-meter data | Availability for Hyderabad HT units UNCONFIRMED (scopes note). Roadmap |

## 5. What it costs

Everything in sections A to E is free: our own code, no outside service. Paid items (bill lookup API, liveness SDK) and DigiLocker (needs a registered company) are roadmap only, matching the zero-budget rule.

## 6. Pitch line

"Every number in EcoProof comes from a bill the DISCOM issued. We recompute that bill from the official tariff, check it against the last one, and lock it with a seal. If the owner edits a bill, the maths stops adding up. If we change a number, it no longer matches the seal."

## 7. Open questions before building

1. Does the TGSPDCL HT bill PDF have a text layer, and does it print opening/closing readings and the multiplying factor? (Check one real bill.)
2. Tolerance for A1 and thresholds for B4/C1: OUR CHOICE until a real bill set is tested.
3. Household version: the same page with the LT-I bill (slabs already priced in S9b), with no production step.

## Sources
- TGERC Retail Supply Tariff Order FY 2026-27, paras 4.27.4–4.27.5, p.281: local copy `research/sources/TGERC-RST-Order-FY2026-27.pdf`
- Resistant AI, "How to spot fake utility bills": https://resistant.ai/blog/how-to-spot-fake-utility-bills
- GloCert, "GHG verification readiness checklist / evidence pack": https://www.glocertinternational.com/resources/guides/ghg-verification-readiness-checklist-evidence-pack/
- Arasu & Jeffrey, "Energy Consumption Studies in Cast Iron Foundries", Trans. 57th IFC 2009: https://www.foundryinfo-india.org/tech_section/pdf/57ifctp12.pdf
- Keslio, PCAF data quality score (secondary): https://www.keslio.com/glossary/pcaf-data-quality-score
- Golaszewski et al., "Verifying Provenance of Digital Media: Why the C2PA Specifications Fall Short", arXiv 2604.24890: https://arxiv.org/abs/2604.24890
- Mitek, "Document liveness": https://www.miteksystems.com/glossary/document-liveness
- BBPS bill fetch example: https://dev.to/munisekhar_udavapati/bbps-bill-fetch-api-a-complete-guide-3m8f ; NPCI BBPS product deck: https://www.npci.org.in/PDF/npci/bbp/notified-documents/BBPS_Product_Presentation.pdf
- Surepass electricity bill API: https://surepass.io/?p=15144
- Internal: scopes-bills-capture.md, 08-login-and-business-check.md, 04-ui-design-plan.md (baseline unlocks at 9 months)
