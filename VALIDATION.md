# Validation record

## Current evidence

- Salesforce source generated from the supplied project brief with corrections documented in README.md.
- Metadata XML: all XML files parsed; zero parse errors. Flow connectors: zero missing target references. Complete source extraction round trip: 45 files, zero mismatches.
- Salesforce deployment, compilation, Apex execution and measured coverage: **pending org access**.
- Live browser checks passed: invalid VIN error; Auto CA 2017 = $1,250; Property TX 2,000 sqft = $1,050; Life NY 120 months = $740; $60,000 claim routing; Senior Adjuster then Department Manager approval; senior rejection; exactly $50,000 stays New; no-match filter; data persistence after reload. JavaScript syntax parsed successfully.

## Required Salesforce checks

1. Deploy successfully to a fresh Developer org with RunLocalTests.
2. Record actual coverage for ClaimsAdjusterController; target 95% or higher. Confirm overall deployable coverage and all tests pass.
3. Assign restricted-profile agent, adjuster and manager users; verify object permissions and field access, including approval status fields being controlled by approval actions.
4. Quote Auto CA 2017 ($1,250), Auto TX 2020 ($1,050), Property TX 2,000 sqft ($1,050), Life NY 120 months ($740).
5. Reject invalid VIN/model year, invalid property/life fields, zero/negative claims, missing policy, future loss date and high-value claims missing distinct approvers.
6. Create claims for each policy line and confirm correct queue ownership. Set Adjuster__c and confirm direct ownership at creation.
7. Change linked policy on a claim and confirm territory derives from that specific policy, without touching unrelated claims.
8. Test $49,999.99, $50,000 and $50,000.01. Only the last should submit for approval.
9. Verify Senior Adjuster approval advances to Department Manager; second approval completes; either rejection rejects. Confirm unassigned callers cannot approve.
10. As two different adjusters, verify personal dashboard owner filtering; state sharing groups; no broad queue/group/profile access defeats territory restrictions.
11. Run mocked verification success and failure tests. Configure optional Named Credential separately if demonstrating a real callout.
12. Add the LWC to an active Lightning page and quick action to Claim layouts; capture screenshots and a recording from the org.

## Submission

Confirm whether faculty accepts an interactive hosted demonstration or requires a video recording. Submit GitHub and demo links to the project workspace. Mark milestone tasks complete only when the corresponding org behavior has been verified. DigiLocker verification and assessment are outside this project; do not start the assessment based on this project submission.
