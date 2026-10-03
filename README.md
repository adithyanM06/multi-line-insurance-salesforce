# Multi-Line Insurance Policy and Claims Management System

Salesforce Developer / Naan Mudhalvan project for Auto, Property and Life insurance.

- **Interactive demo:** https://adithyanm06.github.io/multi-line-insurance-salesforce/
- **Repository:** https://github.com/adithyanM06/multi-line-insurance-salesforce
- **Salesforce source:** `SOURCE.md` contains the complete 45-file project. Run `node extract-source.mjs` to reconstruct the original `metadata/` directory. A separate local `salesforce-source.zip` package is also provided.
- **Readable source listing:** `SOURCE.md` contains every metadata, Apex and LWC file with its original path.
- **Project documentation:** `PROJECT-REPORT.md`, `DEMO-SCRIPT.md`, `VALIDATION.md`.

## Implementation status

The repository contains generated Salesforce source, Apex tests, configuration, and a working browser demonstration using synthetic data. The public demo uses local browser storage; it does not connect to Salesforce. Salesforce deployment, Apex compilation, integration tests, measured coverage, user assignments and org-specific page configuration require an authenticated Salesforce Developer org and have **not** been certified by the browser demo.

Do not report the requested 95%+ coverage as achieved until the Salesforce test report proves it. The demo link demonstrates the workflow; confirm with faculty whether a hosted browser demo meets their demo-link requirements or whether they require a recording of the actual Salesforce org.

## Salesforce deployment

Install the official Salesforce CLI, download and extract this repository, and run from the repository directory:

```sh
node extract-source.mjs
sf org login web --alias insurance-dev
sf project deploy start --metadata-dir metadata --target-org insurance-dev --test-level RunLocalTests --wait 30
sf apex run test --class-names ClaimsAdjusterControllerTest,QuoteVerificationTest --target-org insurance-dev --code-coverage --result-format human --wait 30
```

Use a fresh Developer org. Review deployment errors before activation in an existing org. This metadata has XML and reference checks, but has not yet been compiled against an org.

## Required org setup after deployment

1. Add users to Auto, Property and Life Claims queues. Queue membership grants access, so use product queues only for team members authorized to see that product's claims. State-only adjusters should receive claims through direct assignment and the corresponding state group, without broad queue membership.
2. Add CA, TX and NY adjusters to the matching public groups. Claim sharing is private. Group sharing grants access, it does not revoke ownership, queue access, administrative access or other sharing paths. Audit all effective access in the org.
3. Assign Insurance Agent Access, Insurance Adjuster Access and Insurance Manager Access permission sets to appropriate users. Use restricted base profiles; permission sets add access and cannot remove broad profile privileges.
4. Create synthetic Contacts; quote policies using AutoQuotingFlow, PropertyQuotingFlow or LifeQuotingFlow. The current source uses a Contact ID screen input; obtain it from the Contact record. A lookup screen component can replace this input as a usability improvement.
5. In Lightning App Builder create an Insurance workspace App Page, add `claimsDashboardLwc`, and activate it for Insurance Operations. Add the quoting flows to the Agent workspace.
6. Add `Claim__c.Approve_Reject_Claim` to the Claim page layout's Lightning actions. Add the approval history related list. Show Policy, Amount, Adjuster, Senior Adjuster, Department Manager and Approval Status fields on Claim layouts.
7. For claims over $50,000 set two distinct active user lookups: Senior Adjuster and Department Manager. Ensure these users can access the claim and run ClaimApproverScreenFlow and ClaimApprovalAction. The process submits as the creator; creator is an allowed submitter even after queue routing.
8. The optional QuoteVerification callout simulation requires a `Quote_Verification` Named Credential pointing to your mock service before real use. Unit tests use HttpCalloutMock and never call a real insurer or motor vehicle database. This optional service is not wired into the quoting flow because a service endpoint is not supplied.
9. Create reports for claim counts, status, policy line, territory and amount; managers have RunReports access. Customize the report types and dashboards for the org.
10. Run the test and demonstration checklist in VALIDATION.md. Capture actual Salesforce evidence and coverage, then complete the faculty's phase templates and final submission.

## Source structure

`metadata/objects` defines Policy and Claim, their fields, record types, validation and field sets. `flows` implements three quoting screens, state stamping, product routing, submission and review. `classes` contains rating, current-owner dashboard querying, pending-work-item approval processing and tests. `lwc` contains dashboard and reusable tile bundles. `approvalProcesses` and `workflows` provide two-step approvals and status updates. `queues`, `groups`, `sharingRules` and `permissionsets` supply access configuration.

## Corrections to the supplied guide

- Resolve queue names dynamically; never copy another org's IDs.
- Resolve the policy RecordType's DeveloperName before comparing with Auto / Property / Life.
- Stamp only the linked policy's state onto the triggering claim; never update all claims inside a loop.
- Use ProcessWorkitemRequest to approve/reject an assigned pending item, rather than resubmitting the claim.
- Preserve premium output order and duplicate input IDs for bulk invocations.
- Query dashboard data with sharing and WITH USER_MODE.

All names and records in the public demo are fictional. No authentication tokens, passwords, government IDs or real insurance data are included.
