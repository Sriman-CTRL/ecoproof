# EcoProof: UI and website design plan

Written 12 Oct 2026 for Sriman. Plan only, nothing is implemented yet. The build thread ("MSME carbon platform build plan") owns the build order and turns section 10 into Claude Code prompts.

Baseline: Doc 06 (UX rules), Doc 02 (screens and features), Doc 04 (engagement and guardrails), Doc 05 (reports and wording), Doc 07 (stack: React, Vite, Tailwind, i18next, installable PWA). Every number in this file is either from those docs, from the Demo A results already built, or marked **(design target)** where it is my own choice.

**Updated 12 Oct 2026** to merge the retention plan (`05-engagement-rewards-plan.md`, section 10) and Sriman's three decisions on it: "Verified" only as "Verified by your bills"; no EcoProof document is ever called a certificate (ZED is the certificate we guide owners to); no points or coins of any kind. Changed: section 1, signature components, Home, `/health`, `/savings`, `/schemes`, the new `/progress` route and wall board, landing sections 5 and 6, all of section 6, wording rules, conflicts and build sessions.

---

## 1. The blunt version

Most hackathon apps look AI-generated for the same five reasons: a purple or teal gradient hero, glassy cards, three identical "feature" cards with icons, stock copy like "Empower your sustainability journey", and default shadcn components. Judges have seen hundreds of them.

EcoProof has something those apps don't: **a real object at the centre, the electricity bill**, and real rupee numbers (₹60,000 a month lost to power factor, EMI ₹20,276). The design should look like it was made by someone who has read a TGSPDCL HT bill, not by someone who has read a design trend article.

**Design idea in one line: "the bill, decoded, in a passbook."** Warm paper background like a printed bill, deep ledger green, big rupee figures in tabular digits, tear-off "bill stub" cards for findings, a rubber-stamp "Verified by your bills" mark, and every number tappable back to the line on the bill it came from.

"Addictive" here means **a monthly money ritual** (Doc 04), not compulsion. Owners are deciding on loans worth lakhs. Anything that feels like a game trick (fake urgency, streak shaming, countdowns) kills trust, and Doc 04 forbids it. The pull comes from a **progress path** that always shows "you are here, this is next", rupees found and captured, government money the owner can claim (ZED, PM Surya Ghar), and milestones that are real business outcomes. No points, coins, draws or streaks.

---

## 2. Visual identity

### 2.1 Colour tokens

Green because it's carbon tracking, but a **ledger/banknote green**, not neon eco-green. A copper accent nods to foundries (molten metal) and doubles as the "money at stake / please check" colour.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F7F5EF` | App background (warm, like bill paper) |
| `surface` | `#FFFFFF` | Cards |
| `line` | `#E3E0D6` | Borders, dividers, perforations |
| `ink` | `#1A1F1C` | Main text |
| `ink-muted` | `#5B635E` | Secondary text |
| `green-50` | `#EEF6F0` | Saved / positive tint backgrounds |
| `green-100` | `#D5EADB` | Progress track |
| `green-200` | `#A9D3B5` | Text on dark green, chart fills |
| `green-600` | `#237A4B` | Icons, chart lines |
| `green-700` | `#1B6440` | **Primary button**, links, "saved" figures |
| `green-900` | `#0E3524` | Header bar, landing hero, footer |
| `copper-50` | `#FDF3E3` | "Money at stake" and "Please check" tint |
| `copper-500` | `#F2B25C` | Highlight on dark green (hero numbers) |
| `copper-700` | `#B45309` | "Please check" borders, at-stake figures |
| `copper-800` | `#8A4A0B` | Text on copper-50 |
| `loss` | `#B42318` | Loss and error text (always with the word "loss" or the error) |

Contrast I checked (WCAG AA needs 4.5:1 for body text): white on green-700 7.1, ink on paper 15.3, ink-muted on paper 5.7, copper-700 on white 5.0, copper-700 on paper 4.6 (use it for large text or borders only on paper), loss on white 6.6, green-200 on green-900 8.2, copper-500 on green-900 7.3. All pass.

Rules:
- Colour is never the only signal (Doc 06): every green figure says "saved", every red one says "loss", every copper border says "Please check".
- No gradients except one: the landing hero may use a flat green-900 with a subtle paper-grain texture (an inline SVG noise, under 2 KB). No glassmorphism, no glow.
- **No dark mode for v1.** Owners read this on a shop floor or outdoors; a light, high-contrast theme reads better in sun. Put dark mode on the roadmap.

### 2.2 Typography (all free, all support Telugu and Hindi)

| Role | Font | Why |
|---|---|---|
| Headings and big numbers | **Anek Latin** (variable), with **Anek Telugu** and **Anek Devanagari** | Designed in India by Ek Type as one family across scripts, so Telugu and English headings look like siblings. Distinctive, not the Inter/Poppins look every AI app has. Google Fonts, OFL licence. |
| Body text and form fields | **Noto Sans**, **Noto Sans Telugu**, **Noto Sans Devanagari** | Very readable at small sizes, complete script coverage, tabular figures. |

- Self-host with `@fontsource` packages (free npm). Load only the script for the chosen language, Latin subset always. If an Anek package is missing on npm, fall back to Noto Sans for headings and tell the build thread.
- All money and units use `font-variant-numeric: tabular-nums` so columns of rupees line up like a ledger.
- Type scale (design target, mobile): hero number 40/44 px Anek SemiBold; screen title 24/30; card title 18/24; body 16/24; small 14/20. Never below 14 px. Layouts must survive 130% text size (Doc 06), so no fixed heights on text containers.
- Rupee display rule (Doc 06): `₹1,01,435` big, then in words underneath for amounts over ₹1 lakh ("about ₹1 lakh a month"). The existing `src/lib/format.ts` already does Indian grouping and lakh/crore words; reuse it.

### 2.3 Icons, illustration, imagery

- **Icons: Phosphor Icons** (`@phosphor-icons/react`, MIT). Regular weight in the UI, Duotone for the few big empty-state icons. Avoid Lucide's default look, which is what most generated apps ship. Icons always with a word (Doc 06).
- **No stock "green leaf / wind turbine / globe in hands" images. No AI-generated illustrations.**
- The main imagery is **the product's own artefacts**: the synthetic sample bill (already rendered in S3, `bill-2026-10-photo.png`), real screenshots of Demo A, and the loan-ready PDF. Each carries the "Sample data (synthetic)" label.
- Optional, if a teammate has time on the 12th: 2–3 phone photos of a real Balanagar or Jeedimetla industrial street or an electricity meter (their own photos, no people's faces without permission). One real photo beats ten stock ones.

### 2.4 Shape, depth, motion

- Corners: 12 px cards, 10 px buttons, 999 px chips. One shadow level only (`0 1px 2px rgb(0 0 0 / 0.06)`) plus 1 px `line` borders. Flat and printed-feeling.
- Spacing: 4 px grid; screen side padding 16 px; 12 px between cards.
- Motion (design target): 150–250 ms ease-out, CSS only. Three meaningful animations, nothing decorative:
  1. **Number count-up** when a rupee figure first appears (600 ms, once per session).
  2. **Month tile fills** on the year strip when a bill is confirmed.
  3. **Stamp press** when "Too early to confirm" becomes "Verified by your bills" or a path stage is reached (scale 1.15 → 1, slight rotation).
- All of it off when `prefers-reduced-motion` is set. No confetti, no parallax, no auto-playing carousels.

### 2.5 Signature components (what makes it look designed, not generated)

| Component | What it looks like | Doc rule it serves |
|---|---|---|
| **Rupee hero** | Big tabular ₹ figure, words underneath, then units, then CO₂ in smaller muted text | Rupees first, kWh second, CO₂ third (Doc 06 principle 1) |
| **Source chip** | Every number has a dotted underline. Tap opens a bottom sheet with the crop of the bill around that value, the line name ("Maximum demand, from your Oct 2026 bill") and the quality tag ("from your bill" / "you entered") | Show the source (Doc 06 principle 4) |
| **Bill stub card** | A card with a perforated tear edge on the left (CSS radial-gradient notches), the ₹ per month on the stub, the one-line fix on the body | Bill health findings (Doc 06, INS-1) |
| **Jargon chip** | kVAh, power factor, maximum demand shown with a small "?" chip; tap gives one line ("Power factor: how much of the power you pay for does useful work. Below 0.95 the DISCOM charges extra.") | Jargon rule (Doc 06) |
| **Year strip** | 12 small tiles, one per month, like the consumption-history bar graph printed on Indian bills. Filled tile = confirmed bill. Shows "8 of 12 months" and unlocks the baseline at 9 | CAP-5 backfill, "Baseline ready" milestone |
| **Stamp badge** | Double-border, slightly rotated rubber-stamp text: "VERIFIED BY YOUR BILLS" in green, "TOO EARLY TO CONFIRM" in muted grey, "ESTIMATE, NOT VERIFIED" in copper | Doc 05 wording rules |
| **EMI vs saving bar** | Two horizontal bars on the same scale: EMI and monthly saving, with the gap labelled "₹39,724 left in your pocket every month" | FIN-3, the judges' money moment |
| **Progress path** | 5 stops on a horizontal line (Measured → Baseline set → Saving → Finance-ready → Buyer-ready), current stop filled with "You are here", one "Next:" line under it. Drawn like a route on a cluster map, not a game level | Retention plan 3.1, Doc 04 milestones |
| **Headroom meter** | One bar: "₹ found" full length, "₹ captured" filled in green, the rest in copper-50 labelled "still on the table" | Retention plan 3.2 |
| **Money found counter** | A small ledger line: "Money found for you: ₹10,000 (ZED joining reward)", with "Likely eligible; confirm with the scheme office" under it | Retention plan 5.2, Doc 05 wording |
| **Explainer line** | Under each finding, a "What is power factor?" link that opens 2–3 lines about their own bill, in their language | Retention plan 7 |
| **Data quality ring** | Small ring with % measured; below 70% it turns copper with "Check data" | Doc 03 data quality score |
| **Sticky primary bar** | One full-width button, 52 px tall, pinned at the bottom with safe-area padding | One screen, one job; 48 px minimum, thumb reach (Doc 06) |

---

## 3. Layout and navigation (in-app)

- Mobile-first at 390 px (already the S5 rule). On desktop (≥1024 px), the app sits in a centred 480 px column on the paper background, except the confirm screen and loan pack, which go two-column (bill image left, fields right).
- **Header (56 px, green-900):** EcoProof wordmark, business name (wraps, as fixed in S5), "Sample data" chip, language switch (EN / తె / हि as text buttons, not a flag).
- **Bottom tab bar (64 px, white, 4 tabs, icon + word):** Home · Bills · Plan · Reports. Settings and Sharing sit behind the business-name menu in the header. Tabs hide on the capture flow (upload → confirm → result) so the owner focuses on one job.
- The single primary button sits above the tab bar in the sticky bar. Secondary actions are plain text links.

---

## 4. Screen-by-screen plan

Status column: **Built** = exists after S5/S6 and needs a restyle only; **S7/S8/S9** = coming in that build session (design it to this spec from the start); **New** = not in the build plan yet.

| Route | Status | Shows first | Primary button | Design notes and engagement hook |
|---|---|---|---|---|
| `/` landing | New | See section 5 | "See a sample foundry" | Public website, code-split from the app |
| `/start` | Built | Two large cards: "Sri Lakshmi Castings: before" and "Same unit, 6 months later", each with a mini rupee hero and year strip preview | (tap a card) | Make the cards look like two bill envelopes. "Sample data (synthetic)" label stays |
| `/consent` | Built | One-screen notice in 4 short blocks with icons: what we store, why, who sees it, how to delete | "I agree" | Big "Your data is shared with nobody until you share it" line in a green-50 box (Doc 06 trust rule) |
| `/home` | Built | **Rupee hero**: Demo B shows "₹ saved this month / total so far" (Doc 06). Demo A has nothing saved yet, so it shows "₹1,01,435 a month at stake, found in your bill" (the S6 total) | The path's "Next:" step (for Demo A: "Fix power factor") | Order below the hero: **progress path** with one "Next:" line, **headroom meter**, INS-2 insight sentence, year strip, month list as a ledger table. The path's next step and the primary button are the same thing, so the owner never sees two different "next" suggestions. Empty state per Doc 06: sample foundry's results + "Forward your latest electricity bill to see yours in 2 minutes" |
| `/bills/new` | Built | Big camera tile "Take photo of bill", smaller "Choose file", hint "Or forward it on WhatsApp (coming soon)" | "Take photo" | While reading: show the uploaded photo with a scanning line moving down it and the words "Reading your bill…" (real progress, not a fake spinner). Error: "Photo is blurry. Retake in good light." |
| `/bills/:id/confirm` | Built | Bill image with each extracted value highlighted where it sits on the bill; fields list beside/below | "Confirm all" | Only low-confidence fields get the copper "Please check" border; the rest show a small green tick (Doc 06: pre-accepted unless tapped). Jargon chips on kVAh, PF, MD |
| `/results/:id` | Built | Rupee hero for the month, then units, then t CO₂ + intensity per tonne | "See bill health" | First-time only: "First footprint" milestone stamp (Doc 04). "Why this number?" becomes a bottom sheet with the factor, version, source and status stamp |
| `/health` | Built (S6) | Total "₹1,01,435 a month at stake", then one bill stub card per finding, biggest first | **"Start the top fix"** (Doc 06; S6 built "See your action plan", change it in D2, decided 12 Oct) | Each card has a "What is power factor?" explainer line (retention plan 7). Passed checks in a grey "Checked and OK" list. Peak card keeps the live "units you could move" input |
| `/actions` | Built (S6) | Top 3 actions as ledger rows: ₹ a year, cost or "cost pending: get a quote", payback | "Open the top action" | Status pills: Not started / Planned / In progress / Done. "See all (n)" below |
| `/actions/:code` | Built (S6) | Saving range, cost range, payback, then the **EMI vs saving bar** | "Plan this action" | Small print "Summary for the lender's own assessment". "Cash-positive from month 1" as a green stamp only when true |
| `/loan-pack` | S7 | Headline box: saving vs EMI (Doc 06 / Doc 05) | "Share with a lender" | Preview of the PDF's first page as a paper sheet. Share sheet: recipient, expiry "30 days" shown in words, then the link. Mentions the unit's ZED level when it has one (retention plan 4.1) |
| `/wall-board` | New, print layout | A3 sheet: "This unit has saved ₹X on electricity since [month], measured from its own bills. Scan to check." plus the `/verify` QR | "Print" | Same snapshot as the progress statement. Never titled "certificate"; no green adjectives, no ZED or government logos. Only after S7's QR exists |
| `/verify/:reportId` | S7 (public) | Big result: "This document is genuine" with green stamp, or "This file does not match" in red | "Check a PDF file" | Shows only report ID, issue date, business name, headline figures (Doc 05). Lenders and judges see this on their own phone after scanning the QR, so make it the most polished public page after the landing |
| `/savings` | S8 | Baseline vs actual chart for months after the action, ₹ saved total | "Share progress" | Months before significance labelled "Too early to confirm", turning to a "VERIFIED BY YOUR BILLS" stamp (VER-1). One line under the chart: "Checked against your own electricity bills by EcoProof's method; not a third-party verification." This is the Demo B payoff screen |
| `/schemes` | S8 | List of matches: "Likely eligible; confirm with the scheme office" / "Check with lender" / "Not eligible" with the reason and last-checked date | "Open the top match" | **ZED readiness card first**: "Your unit is likely eligible for the ₹10,000 ZED joining reward, which covers Bronze. Confirm with the scheme office", with the ZED energy and environment items EcoProof's data already covers ticked. **Money found counter** at the top. ZED named, no ZED logo. Never the bare word "Eligible" (Doc 05). Rules older than 60 days show a warning (Doc 02) |
| `/reports` | S8 | List of reports with last generated date (Doc 06) | "Generate" | CBAM sheet row carries the "ESTIMATE, NOT VERIFIED" stamp |
| `/progress` | New (replaces `/milestones`) | The 5-stage path large, each stage listing its Doc 04 milestones with dates, and what each stage unlocks | The current "Next:" step | Reached by tapping the path on Home. Share card on "First ₹10,000 saved" and "₹1 lakh saved". "Top 3 in cluster" is a side badge, not a stage |
| `/sharing` | New, light | "Nobody can see your data" or the list of viewers, links and expiry dates | "Approve" / "Revoke" | For the demo: one sample lender view row on Demo B ("Viewed 2 times"), labelled sample |
| `/settings` | New, light | Language, team, consent, delete data (Doc 06) | none | Plain list. "Delete my data" in loss red with a confirm step |
| Household `/household/*` | S9 | Bill upload → solar plan (size, subsidy, saving) → after-installation savings (Doc 06) | per screen | Same components, warmer copy, no production or Udyam questions (HH-1) |

States every screen needs (design target): loading skeleton shaped like the final cards (not a spinner), empty state that teaches (Doc 06), error that says what happened and what to do, offline banner "No network. Your photo will send when you're back online."

---

## 5. Public website (landing page)

**Goal:** a judge or a foundry owner understands what EcoProof does in 10 seconds and tries the demo in one tap. Same Vite app, route `/`, lazy-loaded so the owner app stays light.

**Copy rules:** lead with rupees, concrete nouns (bill, power factor, capacitor bank, lender), no "empower / revolutionise / seamless / AI-powered journey". No fake customer logos, no fake testimonials, no "10,000+ MSMEs trust us" counters. Anything from Demo A is labelled "worked example" or "sample unit".

| # | Section | Content | Design |
|---|---|---|---|
| 1 | **Hero** | Headline: "Your electricity bill already shows where the money goes. EcoProof reads it for you." Sub: "Energy and carbon pre-assessment for MSMEs. In rupees, in Telugu, Hindi or English." Buttons: "See a sample foundry" (primary, goes to `/start`) and "How it works" | Green-900 with paper grain. Right side: a real phone screenshot of `/health` showing "₹60,000 a month lost to power factor", tagged "Worked example (Doc 03)". On mobile the phone sits below the text |
| 2 | **The bill, decoded** | The synthetic bill image with 3 callouts pointing at the real lines: power factor, maximum demand vs contracted demand, peak-hour units. Each callout: what it means and what it costs | Paper background; this section is the signature of the site |
| 3 | **How it works** | Four steps of the Doc 04 loop: Forward your bill → Check the values → See ₹ at stake and the fix → Track savings your bills prove, every month | A horizontal timeline, numbered, with small real UI crops, not icons in circles |
| 4 | **Try the money maths** | Interactive EMI vs saving widget, prefilled with the worked example: loan ₹10,00,000, 8%, 60 months → EMI ₹20,276 vs saving ₹60,000 a month. The visitor can change the numbers | Uses `@ecoproof/calc` `emi` so the result matches the app exactly. Small print "Summary for the lender's own assessment" |
| 5 | **Proof, not claims** | Savings are counted only after the bills prove them ("Too early to confirm" → "Verified by your bills", using EcoProof's method, not a third-party check); every report has a QR that anyone can scan to check it was not altered | The stamp badges and a real QR from S7 that opens a working `/verify` page. Judges can scan it from the screen |
| 6 | **Who it's for** | Metal-engineering MSMEs first (foundries, forging, fasteners) in Hyderabad clusters; households second (rooftop solar and PM Surya Ghar subsidy). For lenders: loan-ready summary. For EU buyers: CBAM supplier sheet, "estimate, not verified". One line on real certificates: "We guide you to MSME ZED; Bronze is effectively free with the ₹10,000 joining reward, and some banks cut rates for ZED units" | Three plain columns with a one-line "what you get" each. ZED named, no ZED logo |
| 7 | **Your data, your call** | DPDP consent, nothing shared until you share, every viewer logged, delete anytime. Shown in Telugu and Hindi too, side by side | Language samples in Anek Telugu / Devanagari: the visual proof it's built for India |
| 8 | **Footer** | SDG 13 Climate Action, team and CBIT Hyderabad, "Prototype for [ideathon name]", wording disclaimer: "Energy and carbon pre-assessment. Not an energy audit." | Green-900 |

Performance target for the landing (design target): first screen under 200 KB on mobile, images as WebP with width variants, the hero phone screenshot under 80 KB.

---

## 6. Engagement design ("addictive" the honest way)

Source: Doc 04 plus the retention plan (`05-engagement-rewards-plan.md`). Everything maps to one of their mechanics. Tags: **[13th]** build for the demo, **[PITCH]** a mock or slide only, **[ROADMAP]** later.

### 6.1 The progress path (the centre of retention) [13th]

Owners stay when they see a path, not a dashboard. Home shows 5 stages with "You are here" and exactly one "Next:" step:

| Stage | Reached when (Doc 04 milestone) | Unlocks |
|---|---|---|
| 1 Measured | First footprint | Bill health, first ₹ at stake |
| 2 Baseline set | Baseline ready (9 months of bills) | Savings tracking |
| 3 Saving | First action done + first ₹10,000 saved | Share card, progress statement |
| 4 Finance-ready | Loan pack sent | Lender view tracker |
| 5 Buyer-ready | Buyer approved + ₹1 lakh saved | Buyer data room, quarterly progress statement |

Design: a thin green-700 line with 5 round stops; reached stops filled with a small stamp tick, the current one larger with "You are here"; future stops outlined with one line saying what unlocks them. Stage names never use green adjectives or "certified". "Top 3 in cluster" is a side badge (opt-in), not a stage.

### 6.2 Mechanics and where they live

| Mechanic | What the owner sees | Where | Tag |
|---|---|---|---|
| **Monthly ritual** | "This month" card with 4 ticks: Bill received → Values confirmed → Bill checked → Next action chosen. All 4 ticked fills the month tile on the year strip | Home | 13th |
| **Headroom meter** | "₹1,01,435 a month found. You've started fixes worth ₹X. ₹Y still on the table." Uses the S6 findings and actions marked done | Home | 13th |
| **Money as reward** | "₹ at stake found" and "₹ saved, verified by your bills" totals. Count-up once per session | Home | 13th |
| **Money found for you** | Government money the owner can likely claim: ₹10,000 ZED joining reward (covers Bronze); for households, PM Surya Ghar subsidy up to ₹78,000 for 3 kW and above. Always "Likely eligible; confirm with the scheme office" | `/schemes`, Home line | 13th |
| **ZED readiness card** | The real certificate banks reward (rate and fee concessions at several banks). EcoProof walks them there; it never issues a certificate itself | `/schemes`, loan pack | 13th |
| **Learning in context** | One explainer line per finding; later a bill decoder with "You know 7 of 10 things on your bill" (only goes up) | `/health`, confirm screen | 13th (lines), PITCH (decoder) |
| **Stored value** | Year strip: "8 of 12 months. 1 more to unlock your savings baseline." | Home, `/bills` | 13th |
| **Shareable win** | Square card on ₹10,000 and ₹1 lakh saved: business name, figure, "Verified by your bills", EcoProof mark, for WhatsApp status | `/progress` | ROADMAP for demo unless ahead |
| **Factory wall board** | A3 print with QR to `/verify`, worded as what was measured, never "certificate" | `/wall-board` | 13th only if S7 QR exists |
| **Steer to high impact** | Plan ranked by rupees, never by ease; only the top action has a filled button | `/actions` | Built |
| **Others pull them back** | "Your lender viewed the pack 2 times"; buyer-request cards | `/sharing`, Home | PITCH |
| **Cluster unlock** | "Hyderabad foundries on EcoProof: 6 of 10. At 10, everyone sees their real rank." One-tap WhatsApp invite, no reward attached | Home card | PITCH (sample data, labelled) |
| **Peer comparison** | "You use X units per tonne. The best 20% of foundries like yours use under Y", saying whether it's cluster peers (10+) or BEE's range | Home | PITCH |
| **Green Progress Score** | Next to ₹ saved, never alone (ENG-1) | Home (Demo B) | PITCH |
| **Partner offers, lender perks, expert hour** | Labelled "Partner offer", outside the ranked list | — | ROADMAP |

### 6.3 Guardrails (copy into CLAUDE.md for the UI sessions)

From Doc 04, the CCPA dark-patterns and greenwashing guidelines, and ASCI, via the retention plan:
- No streak counters that can be lost, no "You'll lose your progress!", no countdown timers, no fake urgency, no nagging beyond the 4-messages-a-month cap. A "12 months tracked" counter is fine because it never goes backwards.
- **No points or coins of any kind** (Sriman's decision, 12 Oct). Rupees are the points. No wallets, no lucky draws, spin wheels or scratch cards.
- **No EcoProof document is called a certificate.** ZED is the certificate we guide owners to. No ZED or government logos.
- "Verified" only as **"Verified by your bills"**, with the method note on the progress statement and savings screen.
- No generic green labels ("green factory", "eco-friendly", "carbon neutral", "sustainable unit") and no tree or car equivalences without a sourced factor.
- Partner offers are labelled "Partner offer" and never appear inside the ranked action list.
- No inflated savings; every figure follows Doc 03 and shows its data quality.
- No public rank without opt-in; bottom positions visible only to the unit itself.

---

## 7. Language and microcopy

- Every string through i18next (already the S5 rule). Telugu text often runs longer than English, so buttons wrap to two lines instead of truncating, and no text sits in a fixed-width box.
- In Telugu and Hindi, kWh is written as "units", as on the bill (Doc 06).
- Voice of the copy: short, direct, rupees first. "You are paying ₹60,000 a month extra for low power factor." not "Optimise your power factor for sustainability gains."
- Fixed phrases (Doc 05), enforced in en.json and te.json: "Energy and carbon pre-assessment", "Summary for the lender's own assessment", "Estimate, not verified", "Too early to confirm", "Likely eligible; confirm with the scheme office". Never: audit, approved, sanctioned, eligible (alone), certified, compliant, **certificate** (for any EcoProof document), **green certified, eco-friendly, carbon neutral, sustainable unit, green factory**. "Verified" appears only as "Verified by your bills". No "= 50 trees" style equivalences unless a sourced factor exists (none does today).
- Telugu stays marked "machine-drafted: needs native speaker review" until a Telugu-reading teammate checks it. That's the easiest teammate task today: give them screenshots of each screen in Telugu.

---

## 8. Accessibility and performance checklist

From Doc 06 unless marked otherwise:
- Home usable within 3 seconds on a low-end Android over a 3G-quality connection. Check with Chrome DevTools "Slow 4G" + 4x CPU throttle and Lighthouse mobile **(design target: Lighthouse performance 85+, accessibility 95+)**.
- Buttons at least 48 px tall (we use 52 px for primary); primary at the bottom.
- Test at 130% text size and at 360 px width.
- Icons always with words; colour always with a word.
- Photo uploads compressed under 300 KB before sending (already in S5).
- PWA: installable, app shell cached, photos queue offline (Doc 06/07). For the 13th, the manifest and icons are enough; offline queue is roadmap if time is short.
- Focus rings visible (2 px green-700 outline), labels on every input, `lang` attribute switches with the language.

---

## 9. Doc conflicts and choices you should know about

I did not silently pick sides on these:

1. **"Addictive" vs Doc 04 guardrails.** You asked for addictive; Doc 04 bans streak shaming, fake urgency and countdowns. I followed Doc 04 and the retention plan: progress path, rupees, real government money and the monthly ritual. These users are signing loans; trust is the retention.
2. **Where the monthly loop lives.** Doc 06 says it runs in WhatsApp and the web app is for deciding. WhatsApp is roadmap for the 13th, so the web app carries the whole loop in the demo. The landing page says "Forward your bill on WhatsApp (coming soon)".
3. **Home's first number.** Doc 06 says Home shows "₹ saved this month and in total"; S5 built it with the latest bill total. Demo A has no savings yet, so I propose "₹ at stake found" for Demo A and "₹ saved" for Demo B. **Decided by you on 12 Oct: yes.**
4. **Bill health primary button.** Doc 06 says "Start the top fix"; S6 built "See your action plan". I recommend Doc 06's wording, linking straight to the top action. **Decided by you on 12 Oct: yes.**
5. **"Zero-cost" badge on power factor.** Doc 02 INS-1 calls bill findings zero-cost actions, but the Doc 03 fix is a capacitor bank, which costs money (handover review conflict g). The PF card must not carry a "Zero-cost" badge; use "Low cost, quote needed" until R2 brings a price. **Decided by you on 12 Oct: yes.**
6. **Progress statement frequency.** Doc 02 says yearly, Doc 05 and Doc 04 say quarterly and yearly (conflict b). The UI label says "Progress statement" without a frequency until you decide.
7. **Leaderboard and score in the demo.** They are pitch-only in the solo build plan. If shown, they need at least 10 units (Doc 04), so the demo can only use clearly labelled synthetic peers.
8. **"Verified" in Doc 05 vs ASCI.** Doc 05 uses "Verified" for savings that passed the significance test; ASCI reads "verified" as third-party. **Decided by you on 12 Oct:** only "Verified by your bills", plus the method note.

---

## 10. Build sessions (for the build thread to turn into prompts)

These slot into the existing S7–S10 schedule; the build thread decides the exact order. My recommendation on priority, bluntly: **D1, D2, D3 and D4a before the 13th; D4b goes with S8's scheme screen; D4c only if you're ahead.** Never let design work push out the S7 loan PDF or the S8 savings chart, which are the demo's proof.

| # | Goal | Model / mode | Clear | Must for the 13th? |
|---|---|---|---|---|
| **D1** | Design foundation: Tailwind theme tokens (section 2.1), fonts via @fontsource with per-language loading, type scale, Phosphor icons, and the shared component kit in `apps/web/src/components/` (Button, StickyPrimaryBar, Card, BillStubCard, RupeeHero, SourceChip + BottomSheet, JargonChip, StampBadge, YearStrip, EmiVsSavingBar, DataQualityRing, Skeleton, EmptyState, ErrorNote). Replace the current `ui.tsx` pieces in place. Add a `/dev/kit` route that shows every component in EN and TE | Opus, plan mode (it makes design decisions), then Sonnet to execute | /clear before | Yes, ideally before S7 so new screens use it |
| **D2** | Restyle the built screens (`/start`, `/consent`, `/home`, `/bills/new`, confirm, `/results`, `/health`, `/actions`, `/actions/:code`) with the D1 kit, add header + bottom tab bar, and apply section 4's notes and the conflict choices you approve. No API or calc changes | Sonnet, normal | /clear before | Yes |
| **D3** | Landing page at `/` (section 5), code-split, using real screenshots from the Playwright `screens.ts` run and the live EMI widget from `@ecoproof/calc`. Language switch included | Sonnet, normal | /clear before | Yes, it's the first thing judges see |
| **D4a** | Progress path + headroom meter on Home, `/progress` page, monthly ritual card, explainer lines on finding cards. One small API endpoint `GET /sites/:id/progress` returning stage, milestones with dates, next step, ₹ found and ₹ captured, all computed from existing data | Opus plan → Sonnet | /clear before | **Yes** (retention plan says build this first) |
| **D4b** | ZED readiness card and money found counter on `/schemes`. Fold into S8's scheme matcher session rather than a separate one | Sonnet, normal | with S8 | Yes, if S8 runs |
| **D4c** | Factory wall board print layout, WhatsApp-status share card (`html-to-image`), cluster unlock mock with labelled sample data | Sonnet, normal | /clear before | Only if ahead; otherwise the 14th |
| **D5** | Visual QA: run `screens.ts` at 360 px and 390 px, in EN and TE, at 130% text size; read the PNGs; fix overflow; run Lighthouse mobile and fix the top 3 issues | Sonnet, normal | /clear before | Yes, last thing before freeze |

Acceptance checks for every design session (copy into each prompt):
- One primary button per screen, at the bottom, at least 48 px.
- Every rupee figure uses `formatInr`; rupees appear before units and CO₂.
- Every number from a bill opens its source sheet.
- No banned words (section 7 list), "Verified" only as "Verified by your bills", no EcoProof document called a certificate, no points or coins.
- Screens read correctly in Telugu without truncation.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass; commit and push.

---

## 11. Anti-"AI-generated" checklist (review every screen against this)

Don't:
- Purple, teal or rainbow gradients; glassmorphism; glowing blobs.
- Default shadcn / Inter / Lucide look with no changes.
- Three identical feature cards with an icon in a circle.
- Generic stock photos (leaves, turbines, globes in hands), AI illustrations, emoji as icons.
- Vague copy ("empower", "seamless", "revolutionise", "AI-powered").
- Fake social proof: logos, testimonials, user counters.
- Points, coins, spin wheels, scratch cards, lucky draws.
- Government or ZED logos (they imply endorsement).
- Decorative animation that doesn't mean anything.

Do:
- Show the real bill and real screens with real (sample) rupee figures.
- Use the tear-off stub, stamp and ledger motifs consistently, and nowhere else.
- Use Telugu on the page where it matters, as proof this is built for Hyderabad owners.
- Keep every number traceable and every label honest.
