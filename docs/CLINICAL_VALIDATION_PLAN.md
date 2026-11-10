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
| FLU-02 | Enteral feeds plus PN and lipid infusion | Total fluid | Check whether lipid volume is included per app design |
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
