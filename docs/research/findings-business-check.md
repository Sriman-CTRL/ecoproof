# Login and legitimate business details (research, 13 Oct 2026)

Question (Sriman): how should EcoProof handle login, and can it pull business details from Udyam, DigiLocker etc. so the data is legitimate and can't be manipulated?

## The short answer

Three different things get proven, by three different sources:

| What | Proven by | Status for us |
|---|---|---|
| Who is typing | Login (phone OTP / Google / email) | Keep demo login for round 2. Real login needs paid SMS or a registered company (below). |
| The business is real | Udyam record (Ministry of MSME) | Truly tamper-proof only via DigiLocker or a paid KYB API, both need a registered company. Buildable now: upload + cross-checks ("Matched to documents"). |
| The carbon is real | The unit's own bills | Already built (bill checks, SHA-256 dedupe, sealed statement). Add: one electricity service number per business. |

The big finding: **a downloaded Udyam certificate PDF is not tamper-proof.** It is printed from the portal and says "This is computer generated statement, no signature required" (seen on public Udyam certificate copies, e.g. [act.edu.in sample](https://act.edu.in/wp-content/uploads/2025/07/MSME-CERTIFICATES-PROOF.pdf)). Anyone can edit the PDF. So an upload alone can only be "matched", never "verified". Tamper-proof needs the record fetched from the source (DigiLocker or the Udyam data through a licensed API).

## 1. DigiLocker (the "model apps" route)

- **Udyam certificates are in DigiLocker.** Letter from Office of DC (MSME), Policy Division, dated 01.01.2025, to RBI and state industries secretaries: DigiLocker and the Udyam portal are linked by API, and "the URC available in "electronic form" in DigiLocker is requested to be considered as a registration document", "at par with the physical Udyam Certificate". Source: [udyamregistration.gov.in/docs/Acceptance_URC_Doucment_DigiLocker.pdf](https://udyamregistration.gov.in/docs/Acceptance_URC_Doucment_DigiLocker.pdf)
- **To pull documents from a user's DigiLocker you must be an approved "Requester" organisation.** Partners SOP ([API Setu Partners SOP](https://cf-media.api-setu.in/resources/Partners-SOP.pdf)):
  - Eligible: organisations registered under MCA, MSME, Startup India, Societies Act, Companies Act, partnership, trust; types include private companies, partnership firms, proprietorship firms.
  - Needs: a functional website describing its online services, official-domain email IDs, demonstrable experience providing online services, a digital signature; nodal officer Aadhaar OTP; "CIN, GSTIN, PAN, and Udyam Aadhaar numbers are verified"; use-case review by a Business Development Manager, then a committee (meets weekly), then CEO approval. After go-live: quarterly usage reports and an audit report.
  - No approval timeline is stated.
- **Requester terms** ([DigiLocker Terms of Use, Requester, June 2025](https://cf-media.api-setu.in/resources/DigiLocker-Terms-of-User-Requester-june-2025.pdf)): register with the organisation's official email domain (Cl. 2); explicit, informed user consent before accessing any document (Cl. 4(c)); must not cache or store documents beyond the permitted duration (Cl. 4(d)); data stays in India (Cl. 18); report breaches within 24 hours (Cl. 13); annual compliance audit by a CERT-In empanelled auditor (Cl. 15). Fees: "Currently, there are no platform charges applicable." (Cl. 9)
- **Entity Locker** (DigiLocker for organisations) "is for entities and organizations, not for individuals" ([DigiLocker Entity Locker FAQ](https://www.digilocker.gov.in/assets/FAQ%20DL%20EL_onboarding.pdf)).

**Verdict:** the right production answer (free platform, consent-based, the record comes from the issuer). Not possible for a student team before 14 Oct: we have no registered entity, no domain email, no digital signature, and approval goes through a committee. Roadmap step 1 after the round: register EcoProof itself (a proprietorship on Udyam is enough per the SOP), get a domain email, then apply.

## 2. Udyam portal directly

- The official site has Print/Verify -> "Verify Udyam Registration Number", which takes the number and a captcha and shows name, address, industry type and status (secondary source: [legalwiz.in guide](https://www.legalwiz.in/blog/legalwiz-in-blog-udyam-registration-verification-status-check)). There is **no public API**. Scraping a captcha page is not legitimate, so EcoProof must not do it. We can send the owner or the lender to check it themselves.
- Newer certificates may carry a QR code that shows the same details when scanned; "not all the certificates issued have the QR code" (same secondary source, UNCONFIRMED: what the QR encodes, and whether it is signed).
- The cloud proxy here blocks udyamregistration.gov.in, so the exact verify-page URL is UNCONFIRMED; link to https://udyamregistration.gov.in and name the menu path.

## 3. Udyam KYB APIs (paid aggregators)

- Licensed verification companies sell a Udyam lookup. Example [Cashfree Udyam verify API](https://www.cashfree.com/docs/api-reference/vrs/v2/udyam/verify-udyam.md): input the Udyam number, returns `enterprise_name`, `organization_type`, `major_activity`, `social_category`, `enterprise_type`, dates, `split_address` (masked mobile), `unit_locations`, `nic_codes`, `dic`, status `SUCCESS` / `UDYAM_NOT_FOUND` / `UDYAM_IS_CANCELLED`. No gender field. Sandbox exists but returns test data only. Others: [Surepass](https://surepass.io/blog/a-detailed-guide-to-udyam-verification-with-surepass-api/), [HyperVerge](https://documentation.hyperverge.co/api-reference/india_api/KYB%20APIs/udyam_aadhaar_verification_api).
- Needs a business account and per-call payment (prices not checked). **Roadmap**, cheaper and faster than DigiLocker once we are a company.

## 4. GST

- GSTIN structure: 2-digit state code (Telangana = 36), 10-character PAN, entity number, "Z", check digit ([TaxGuru GSTIN guide](https://taxguru.in/goods-and-service-tax/comprehensive-guide-gstin-goods-services-tax-identification-number.html)). So, for free and offline, we can check the format, the check digit, the state, and that the PAN inside the GSTIN matches the PAN on the Udyam certificate. This catches typos and mismatches, not a forged number.
- The government "Search Taxpayer" page is captcha-gated; programmatic access is via GST Suvidha Providers (paid, e.g. [Vayana](https://docs.enriched-api.vayana.com/routes/basic/gstn/apis/public/Search-Taxpayer/1-search-taxpayer-vtwo-oh)). Roadmap.
- GST data through the Account Aggregator: "RBI allows sharing of GSTR 1 and GSTR 3B through AA"; live FIUs are banks, NBFCs, AMCs, insurers etc. ([Sahamati deck](https://sahamati.org.in/wp-content/uploads/2023/08/Refresher-session-18th-Aug-__-GST-as-FIP-on-AA_Deep-Dive_Sahamati-v2-August.pdf)). That is the lender's route, not ours.
- E-invoice QR codes on supplier invoices are signed by the IRP (a JWT) and can be checked with the IRP public key or the government verifier app ([Masters India](https://www.mastersindia.co/blog/signed-qr-code-e-invoicing-system/)). Free and truly tamper-proof for big-supplier fuel/metal invoices, but the QR has value and HSN, not quantity (see scopes-bills-capture.md). Roadmap; the public key text was not retrieved.

## 5. Login options

- **Phone OTP** (what owners expect): SMS to Indian numbers needs DLT registration by a business ("PAN Card (mandatory)", authorisation on official business letterhead, one business-entity proof such as GST/Shop & Establishment/CIN) ([Infobip DLT guide](https://www.infobip.com/docs/essentials/dlt-registration); whether OTP traffic is exempt is not stated there, treat as required). Firebase phone sign-in SMS is "Pay as you go (Blaze) plan only" ([Firebase limits](https://firebase.google.com/docs/auth/limits)). So: needs a registered entity and a card on file. Roadmap.
- **Email OTP / magic link** on Supabase: the default mailer only delivers to the project's own team ("Email address not authorized" for others) and is capped at "2 messages per hour" ([Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp)). Needs a custom SMTP provider. Not worth it before the round.
- **Google sign-in**: possible on free tiers (Supabase Auth social login), UNCONFIRMED limits; skipped before the round because the browser holds no Supabase key and a new auth flow is the riskiest change the night before a demo.
- **Recommendation:** keep the one-click demo login for the judges on 14 Oct. Pitch line: "Login says who is typing, Udyam says the business is real, the bills say the carbon is real."
- **Never ask for Aadhaar.** Udyam is already Aadhaar-based at the government's end; we only need the Udyam number. Data minimisation (DPDP).

## 6. What is buildable now, free (D8)

"Business check" with an honest three-level badge:
1. **Self-declared**: Udyam number and GSTIN typed, format + GSTIN check digit + state 36 pass.
2. **Matched to documents**: Udyam certificate uploaded (read by the existing bill reader, file not kept), and its number, enterprise name and pincode match what was typed and the unit's electricity bills; PAN in GSTIN matches; one electricity service number can belong to only one business on EcoProof.
3. **Checked with the government record**: locked, shown as "coming" (DigiLocker / Udyam API after EcoProof is a registered company).

Plus buttons for the owner or lender to check the number themselves on the Udyam and GST portals. The badge level prints on the carbon footprint statement and the loan-ready summary. What it does NOT stop: a forged PDF that matches forged bills. Level 3 closes that.

## UNCONFIRMED
- Exact Udyam verify-page URL; what the Udyam QR encodes.
- Whether TRAI DLT applies to pure OTP traffic (assumed yes).
- Prices of KYB APIs and GSPs.
- Supabase free-tier limits for Google sign-in.
- IRP public key for signed-QR checks.
