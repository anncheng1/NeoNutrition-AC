# NeoNutrition-AC — Phase 4 Clinical Validation Plan

**Target branch:** `feature/neo-nutrition-v2`  
**Status:** Protocol drafted; clinical execution and sign-off pending  
**Purpose:** Validate calculation accuracy, data handling, longitudinal summaries, handover output, and core usability before considering release.

> This is a software verification plan, not a clinical guideline. Do not use test outputs to guide patient care. All expected results must be calculated independently by a qualified reviewer using the currently approved local protocol and the cited source/reference version. Do not change clinical formulas or reference ranges solely to make the application match an unverified test value.

## 1. Scope

Validate the existing app functions, including:

- Patient demographics and gestational/postnatal age handling
- Enteral feed volume and nutrient calculations
- IV fluid and parenteral nutrition calculations
- Total fluid, energy, and protein totals
- Growth plotting, Fenton-derived Z-scores, and weight velocity
- Energy/protein deficit log and longitudinal review
- Daily Nutrition Snapshot / Clinical Handover summary
- Patient record persistence, backup, restore, and offline/PWA behaviour

Out of scope for this phase: introducing new dosing recommendations, changing nutrient targets, adding new product compositions, or changing growth references.

## 1.1 Corrections made in the V2 review branch

The following software-level corrections have been implemented and require regression testing plus clinical review:

- KVO volume is deducted from the automatic main IV/TPN suggestion and KVO edits refresh the suggestion.
- Date-only DOB values are parsed as local dates; DOL uses local calendar-day boundaries.
- Preterm first-five-day fluid targets are aligned to the Malaysian Paediatric Protocols, 5th Edition (2025): 60, 80, 100, 120 and 140 mL/kg/day. Term schedule remains 60, 90, 120, 150 and 150 mL/kg/day.
- Stable growing preterm full-enteral targets use ESPGHAN 2022 energy 115–140 kcal/kg/day and protein 3.5–4.0 g/kg/day. Higher intakes are not automatic targets.
- Enteral protein:energy ratio uses 2.8–3.6 g/100 kcal and is not interpreted for PN or when energy/protein targets are outside their recommended ranges.
- Vitamin D is entered as IU/day. For preterm infants, the tracker assesses 400–700 IU/kg/day while enforcing an absolute 1,000 IU/day upper limit; for term infants it displays the Malaysian routine reference of 400 IU/day. The separate Growth tab shows the MOH 400 IU/day supplementation prompt after day 14 once full feeds are reached.
- Fenton 2025 percentile/Z-score outputs remain explicitly labelled as approximations from five digitised percentile curves. They are not official LMS calculations; borderline preterm SGA/LGA results must be checked using the official Fenton calculator. Term-born SGA/LGA classification is disabled because the separate Fenton 2025 BirthSize dataset is not embedded. The growth chart warns when term-born infants or weight/OFC measurements outside 22+4 to 50 weeks PMA or length measurements outside 23+4 to 50 weeks PMA are entered; longitudinal Z-score change is suppressed outside the embedded reference range.
- Feed and PN compositions remain reference estimates. Existing PN composition values are based on SGH formulations and have not been verified against current Hospital Miri pharmacy formulations. Product labels, fortifier recipes and local PN formulations require pharmacist/dietitian confirmation before clinical use.

- Mixed PN/enteral energy and protein targets remain a volume-share heuristic for phase estimation. The calculation now includes lipid volume and excludes KVO, but the resulting blend is explicitly labelled as estimated and requires clinician review; it is not a validated individualized nutrient target.
- Enteral mineral reference ranges are aligned to ESPGHAN 2022 (calcium 3.0–5.0 mmol/kg/day; phosphate 2.2–3.7 mmol/kg/day; magnesium 0.4–0.5 mmol/kg/day, represented as approximately 9.7–12.2 mg/kg/day in the Growth tab). The enteral calcium:phosphate molar ratio is displayed as an upper limit of ≤1.4:1; PN ratio targets remain separate.
- Preterm weight-gain reference is aligned to the Malaysian 15–25 g/kg/day guidance; term-equivalent reference remains separate and should be interpreted with clinical context.
- Enteral prompts distinguish initial trophic feeds (<25 mL/kg/day in preterm infants; a more conservative 15–20 mL/kg/day prompt for ELBW) from the usual subsequent advancement rate of 20–30 mL/kg/day. Slower advancement is prompted for IUGR with reversed end-diastolic flow or other clinical risk. Term infants are directed to their own feeding protocol. Preterm iron prompts apply the MOH 2–3 mg/kg/day regimen to infants below 2,000 g from day 14; infants ≥2,000 g and term infants are directed to individualise rather than receive an automatic dose.
- PN initiation prompts now follow Malaysian Paediatric Protocols 5th Edition gestational-age criteria (<31+0 weeks: consider PN from birth; ≥31+0 weeks: consider PN if insufficient enteral progress by 72 hours). PN weaning prompts now use the national preterm 100–120 mL/kg/day range; term PN withdrawal is explicitly individualised.

These changes do not constitute clinical sign-off. The official Fenton 2025 data/calculation method and current local product/PN compositions must be validated before release.

## 2. Test governance and safety

1. Use synthetic cases only. Never enter identifiable patient data into a test environment or attach real patient exports to test reports.
2. Record the app version/commit, browser, operating system, test date, tester, and reference documents used.
3. For every calculation, record inputs, app output, independently calculated expected output, units, rounding, absolute difference, and pass/fail.
4. Independently verify the calculation pathway; do not use the app itself to generate the expected answer.
5. A neonatologist/pharmacist/dietitian reviewer should confirm product composition and local PN conventions where relevant.
6. Any discrepancy affecting prescribed fluid, energy, protein, electrolyte, or growth interpretation is a release-blocking defect until explained and resolved.
7. Do not use this application as the sole source for prescribing or clinical decisions.

## 3. Representative synthetic case matrix

The matrix below defines scenarios, not pre-computed clinical answers. Populate exact numerical inputs and expected outputs from the approved local protocol before execution.

| ID | Scenario | Main functions to verify | Important edge/check |
|---|---|---|---|
| NUT-01 | ELBW infant on day 1, starter PN and minimal enteral feeds | Total fluid, PN, enteral volume, energy/protein totals | Very low birth weight; units and weight basis |
| NUT-02 | ELBW infant on day 3 with advancing feeds and PN | Enteral + PN totals | Ensure both sources are included once |
| NUT-03 | ELBW infant on full PN with no enteral feed | PN energy/protein and fluid totals | Zero enteral volume must not create NaN/blank errors |
| NUT-04 | VLBW infant transitioning from PN to enteral feeds | Combined nutrition totals | Changes in PN and feeds update totals immediately |
| NUT-05 | Preterm infant on fortified expressed breast milk | Feed volume and nutrient totals | Correct fortifier selection and composition |
| NUT-06 | Preterm infant receiving formula | Feed volume and nutrient totals | Correct formula selection and concentration |
| NUT-07 | Term infant with feeding difficulty | Enteral volume and totals | Term gestation boundary |
| NUT-08 | Infant with fluid restriction | Total fluid and concentration calculations | Flag inconsistent totals; no silent unit conversion |
| NUT-09 | Infant with interrupted feeds | Delivered volume and daily totals | Partial-day intake not mistaken for a full 24-hour intake |
| NUT-10 | Infant with multiple feed types in one day | Enteral totals | Correct weighted aggregation by volume |
| PN-01 | PN containing glucose and amino acids, no lipid | PN energy and protein | No lipid contribution when absent |
| PN-02 | PN with lipid included | Lipid and total energy | Lipid counted once; correct units |
| PN-03 | PN with changed glucose infusion rate | Glucose contribution | Correct weight and time basis |
| PN-04 | PN with changed amino-acid dose | Protein contribution | Correct g/kg/day conversion |
| PN-05 | PN with zero or blank component | PN totals | Distinguish zero from missing input |
| PN-06 | PN with high/low component input | Validation and display | Boundary handling; no invalid negative values |
| FLU-01 | Enteral feeds plus maintenance IV fluid | Total fluid | Avoid double counting or omitted routes |
| FLU-02 | Enteral feeds plus PN, lipid and KVO infusions | Total fluid | Verify each running infusion is counted exactly once |
| FLU-03 | Fluid restriction with multiple infusions | Total fluid | Consistent mL/kg/day denominator |
| FLU-04 | Weight changed during admission | Weight-based calculations | Explicitly identify which weight is used |
| GRW-01 | First growth entry only | Growth chart and Z-score | No velocity shown without an interval |
| GRW-02 | Two weights on separate consecutive DOLs | Weight velocity | Correct interval and units |
| GRW-03 | Two weights several days apart | Weight velocity | Use actual elapsed days, not assumed daily interval |
| GRW-04 | Multiple weights recorded on same DOL | Longitudinal summary | Duplicate-day handling is explicit and consistent |
| GRW-05 | Weight data with missing days | Longitudinal summary | Missing days are not interpreted as adequate intake |
| GRW-06 | Gestational age near Fenton chart boundary | Z-score and plotting | Boundary and out-of-range handling |
| GRW-07 | PMA crosses 50-week boundary | Growth reference handling | No extrapolation without explicit validation |
| LOG-01 | One daily energy snapshot | Cumulative energy balance | Sign convention and target-minus-delivered definition |
| LOG-02 | Several logged days with one missing day | Cumulative energy balance | Missing day not silently counted as zero or adequate |
| LOG-03 | Protein below minimum on selected logged days | Days below protein minimum | Correct count; missing days excluded |
| LOG-04 | Corrected/edited log entry or cleared log | Longitudinal dashboard | Dashboard refreshes and stale totals disappear |
| HAND-01 | Complete patient record with enteral + PN | Handover summary | All displayed values match calculation engine |
| HAND-02 | Partial patient record | Handover summary | Missing fields are labelled; no misleading zero |
| DATA-01 | Save, close, reopen patient record | Local persistence | Values persist without corruption |
| DATA-02 | Export then restore backup | Backup/restore | Round-trip integrity and version compatibility |
| DATA-03 | Malformed or older backup file | Restore validation | Safe rejection; existing data preserved |
| PWA-01 | Open app offline after initial load | Offline use | Core screens load; no misleading success for unavailable features |
| PWA-02 | Deploy updated service worker | Cache update | New version loads after controlled refresh; old cache does not persist unexpectedly |

## 4. Calculation verification worksheet

For each applicable test, capture:

| Field | Record |
|---|---|
| Test ID | e.g. NUT-01 |
| App commit/version | Exact commit SHA |
| Test environment | Browser + OS + device |
| Synthetic inputs | GA, DOL, weight, feed type/volume, PN components, fluids |
| Independent expected result | Calculation and source/reference |
| App result | Exact displayed value and unit |
| Difference | App minus expected; absolute and percentage where meaningful |
| Rounding | Expected display precision |
| Result | Pass / Fail / Blocked / Not applicable |
| Reviewer and date | Name/role and date |
| Defect/reference | Issue ID or notes |

## 5. Acceptance criteria

A release candidate should meet all of the following:

- 100% pass for critical calculation tests after discrepancies are resolved.
- No unexplained discrepancy in total fluid, energy, protein, PN glucose, amino-acid, or lipid contributions.
- Units, denominators, rounding, and weight basis are explicit and consistent.
- Zero, blank, missing, and invalid values are handled distinctly.
- Growth Z-score and velocity outputs match independent calculations within the agreed rounding tolerance and the validated reference domain.
- Longitudinal summaries correctly handle duplicate dates, missing days, and cleared logs.
- Handover summary matches the underlying app calculation values and clearly labels missing information.
- Backup/restore round-trip succeeds and failed restores do not overwrite valid data.
- Offline/PWA update behaviour is tested on at least one desktop browser and one mobile browser.
- No open critical or high-severity defects remain.
- Clinical reviewer signs off the reference sources and all clinical calculations before deployment.

## 6. Defect severity

- **Critical:** Could plausibly produce an unsafe fluid/nutrient prescription or materially misleading clinical summary. Stop release.
- **High:** Incorrect calculation, patient data loss/corruption, or major workflow failure. Stop release until resolved.
- **Moderate:** Non-critical display, navigation, or usability issue with a safe workaround.
- **Low:** Cosmetic or minor wording issue.

Every defect should include reproducible synthetic inputs, expected result, actual result, screenshot if useful (without patient data), browser/device, and commit SHA.

## 7. Recommended execution sequence

1. Confirm current clinical references, local PN conventions, product composition tables, and calculation definitions.
2. Complete the independent expected-result worksheet for the 30 calculation-focused scenarios.
3. Run calculation tests with a second reviewer checking the independent arithmetic.
4. Test longitudinal dashboard and handover output using the same synthetic records.
5. Test persistence, backup/restore, and offline/PWA behaviour.
6. Triage defects; fix only after the cause is understood and the expected behaviour is agreed.
7. Repeat all affected tests and regression tests.
8. Obtain documented clinical sign-off before merging to `main` or using the updated app in clinical care.

## 8. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Neonatal clinical reviewer |  | Pending |  |
| Pharmacy/PN reviewer |  | Pending |  |
| Dietitian/nutrition reviewer (if available) |  | Pending |  |
| Software/technical reviewer |  | Pending |  |

**Current release status: NOT CLINICALLY VALIDATED.** The feature branch is for review and testing only.

## 9. Reference sources for clinical review

- Malaysian Ministry of Health. *Paediatric Protocols for Malaysian Hospitals*, 5th Edition (2025), Chapter 15 (preterm fluids and enteral advancement), Chapter 16 (feeding and micronutrient supplementation), and Chapter 17 (PN indications and stopping PN): https://www2.moh.gov.my/images/04-penerbitan/penerbitan-klinikal/perkhidmatan-OG-dan-pediatrik/pediatrik/FA_-_Paediatric_Protocols_5th_Edition_MOH_PDF_1-compressed.pdf
- Embleton ND et al. *Enteral Nutrition in Preterm Infants: ESPGHAN Position Paper 2022*. J Pediatr Gastroenterol Nutr. 2023;76(2):248–268. doi:10.1097/MPG.0000000000003642.
- ESPGHAN/ESPEN/ESPR/CSPEN. *Pediatric Parenteral Nutrition: Carbohydrates*. Clin Nutr. 2018. https://www.clinicalnutritionjournal.com/article/S0261-5614(18)31166-X/fulltext
- Fenton TR et al. *Fenton Third-Generation Growth Charts of Preterm Infants Without Abnormal Fetal Growth*. Paediatr Perinat Epidemiol. 2025;39:543–555. doi:10.1111/ppe.70035. Official plotter and data access: https://fentongrowth.ca/
