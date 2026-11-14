# NeoGrowth — Fenton 2025 validation plan

Status: validation framework only. This document does not certify the calculator for clinical use.

## 1. Reference sources and provenance

- Primary comparator: the official Fenton 2025 Growth Chart Plotter and Bulk Processor maintained at https://fentongrowth.ca/.
- Bulk Processor user guide: https://fentongrowth.ca/docs/Fenton2025BulkProcessorUsersManual.pdf
- Plotter user guide: https://fentongrowth.ca/docs/Fenton2025PlotterUsersManual.pdf
- Clinical background: Fenton TR, Elmrayed S, Alshaikh BN. Fenton Third-Generation Growth Charts of Preterm Infants Without Abnormal Fetal Growth: A Systematic Review and Meta-Analysis. Paediatr Perinat Epidemiol. 2025;39(6):543-555. doi:10.1111/ppe.70035.
- LMS provenance: obtain the authors' 2025 Fenton Growth Chart Clinical Calculator workbook or other explicitly authorised LMS data directly from the rights holder. Do not scrape, copy, infer, or redistribute third-party LMS tables without checking the licence and obtaining permission where required.
- Current app implementation: digitised percentile knots and interpolation are approximations, not official LMS calculations. Keep this distinction visible until the replacement engine is implemented and validated.

## 2. Supported measurement ranges

Use exact age in days / completed days where supported by the reference implementation. Convert to PMA consistently and document the convention.

| Measure | Unit | Fenton 2025 PMA range |
|---|---:|---:|
| Weight | g | 22+4/7 to 50+0/7 weeks |
| Head circumference | cm | 22+4/7 to 50+0/7 weeks |
| Length | cm | 23+4/7 to 50+0/7 weeks |

Out-of-range values must return an explicit unavailable result, not silently clamp to an endpoint. Test the exact lower and upper boundaries and one day / one increment outside each boundary.

## 3. Required test dimensions

For each sex (male and female), and each measure (weight, head circumference, length), collect official comparator outputs at:

1. Lower boundary, first supported age, midpoint ages, and upper boundary.
2. Every whole week and selected intermediate days (at least +0, +3, +6 days).
3. Centile anchors: 3rd, 10th, 50th, 90th, and 97th centiles, where the comparator permits direct input or reference-value extraction.
4. Values near the median and both tails, including Z approximately -3, -2, -1, 0, +1, +2, +3.
5. Weight values beyond ±3 SD to verify the WHO restricted LMS behaviour separately from ordinary LMS.
6. Boundary and invalid inputs: below/above age range, missing value, zero, negative value, non-numeric text, implausible unit conversion, and sex not selected.

Do not invent expected Z-scores. Populate expected values by running the same input through the official Fenton 2025 tool and recording its displayed output, version, date, and input.

## 4. Numerical acceptance criteria

- Compare Z-scores before rounding where the reference exposes sufficient precision; otherwise compare the displayed precision and record that limitation.
- Target absolute difference <= 0.01 Z for ordinary in-range test cases when precision permits.
- Percentile agreement should be assessed after converting the validated Z-score using a standard normal CDF; target absolute difference <= 0.5 percentile points for central centiles, with tail behaviour assessed separately.
- For weight |Z| > 3, verify the WHO restricted LMS method against the official tool; do not accept plain LMS extrapolation as equivalent.
- Any systematic sex-, age-, or measure-specific bias is a failure requiring investigation.
- Re-run all cases after every change to reference data, interpolation, age conversion, or calculation code.

These are proposed engineering QA tolerances, not published clinical performance standards. Clinical sign-off should be agreed with the neonatology team and reference-data owner.

## 5. Functional and safety tests

- Gestational age and PMA conversion: weeks+days parsing, date-derived age, leap years, and day-boundary transitions.
- Sex selection: male/female reference rows never cross-contaminate.
- Units: grams vs kilograms; centimetres vs millimetres; reject ambiguous input.
- Serial data: duplicate dates / DOL, out-of-order records, missing measurements, and corrected records.
- Term-born infants: do not display preterm Fenton longitudinal classification as if it were an appropriate term reference.
- Plotting: points align with the same numerical reference values used for the displayed Z-score / centile.
- Offline mode: calculation and saved data remain available without network access; no patient-identifiable data is transmitted.
- Auditability: display reference name/version, calculation method, supported age range, and a clear estimate / validation status.

## 6. Validation workflow

1. Obtain written permission and the authorised LMS workbook/data, including its licence and permitted redistribution/use terms.
2. Freeze a versioned reference dataset; record source, date received, checksum, sex, measure, age units, and row counts.
3. Independently implement LMS forward and inverse calculations. For L != 0: Z = ((X/M)^L - 1)/(L*S); for L = 0: Z = ln(X/M)/S. Inverse: X = M*(1 + L*S*Z)^(1/L), or M*exp(S*Z) when L = 0.
4. Implement the specified WHO restricted method for weight values beyond ±3 SD, only after its precise algorithm and authorised inputs are confirmed.
5. Run the test matrix against the official Fenton Bulk Processor / Plotter. Save de-identified input cases and output records.
6. Independently review failures and boundary cases; obtain clinical review and documented sign-off.
7. Only then consider replacing the current approximation and removing the provisional warning.

## 7. Release gate

Do not merge or deploy as a clinically validated Fenton 2025 calculator until:
- authorised reference data and usage rights are documented;
- all numerical and functional tests pass;
- the >±3 SD weight method is confirmed;
- independent clinical review is recorded; and
- the UI clearly identifies reference/version and limitations.

## 8. Test record template

Use `FENTON_2025_TEST_CASES.csv` to record each case. Use de-identified synthetic or reference-only values; do not place patient identifiers or clinical records in this repository.
