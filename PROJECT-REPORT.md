# Project report

**Title:** Multi-Line Insurance Policy and Claims Management System  
**Course:** Salesforce Developer — Naan Mudhalvan  
**Prepared:** 3 October 2026

## Phase 1 — Problem definition and requirements

A carrier needs consistent quoting and claim handling across Auto, Property and Life products. Manual workflows create inconsistent premiums, slow routing and fragmented customer records. The project models Contacts, Policies and Claims together and separates agent, adjuster and manager responsibilities.

Functional requirements: product record types and field sets, guided quoting, premium calculation, claim routing, current-owner claims dashboard, high-value sequential approval and validation. Nonfunctional requirements: bulk-safe Apex, enforced record and field access, meaningful errors, synthetic demo data and maintainable metadata without org-specific IDs.

## Phase 2 — Architecture and design

Contact 1 → many Policy__c; Policy__c 1 → many Claim__c. Policy record types: Auto, Property, Life. Claim record types: Accident, Property, Life. Policy fields include customer, state, start date, VIN, model year, square footage, year built, beneficiary, term and premium. Claim fields include policy, amount, loss date, description, adjuster, territory, approver users and approval status.

The agent enters policy data in a Screen Flow. The flow creates a draft, invokes PremiumCalculator and saves its result. A before-save Claim Flow copies the linked policy's state. An after-save routing Flow chooses a direct adjuster or product queue. Claims above $50,000 with New status enter High_Value_Claim_Approval. Senior Adjuster review precedes Department Manager review. The review Screen Flow invokes ClaimApprovalAction, which acts only on an item assigned to the caller.

The LWC dashboard uses @wire to call ClaimsAdjusterController. SOQL includes related policy type and customer name, filters OwnerId to the caller, and applies WITH USER_MODE. Search and type/status filters run client-side. Reusable tiles show amount, customer, territory, status and days open and navigate to the claim record.

## Phase 3 — Implementation

Premium rules: Auto base $1,000; CA multiplier 1.15 or TX multiplier 1.05; Auto model years before 2018 add $100 after the state multiplier. Property base $800 plus $0.10 per square foot; Life base $500 plus $2 per term month. Property and Life use the same state multipliers. These are educational simulated rates, not actuarial advice.

Validation requires a 17-character valid VIN for Auto, valid model year, positive property size, beneficiary and positive life term, positive claim amount and linked policy, no future loss date, and two distinct approvers for high-value claims. The public demo includes equivalent workflow checks and persists synthetic records on the visitor's device.

Private object sharing is supplemented by state criteria groups and role permission sets. Ownership and queue access remain effective sharing paths; configure queue membership carefully. This design does not assert that criteria sharing alone guarantees exclusive territory access.

## Phase 4 — Testing and validation

Source includes ClaimsAdjusterControllerTest and QuoteVerificationTest. Assertions cover assigned metrics, all product lines, queue-owner isolation, missing relationship wrappers, premium order and duplicates, invalid approval actions, successful mocked verification and service failure. Requested controller coverage is at least 95%; it must be measured in the org.

Static XML/reference validation and browser demonstration tests are recorded in VALIDATION.md. Actual Salesforce deployment and runtime test results are pending authenticated org access. No results or screenshots of an undeployed Salesforce app are fabricated.

## Phase 5 — Demonstration and handover

Use DEMO-SCRIPT.md for a short walkthrough. GitHub holds source and documentation; GitHub Pages hosts the synthetic-data demonstration. Final Salesforce handover includes deployment results, test coverage, configured users, layouts, workspace page, screenshots and faculty template details. Student/team identifiers were not supplied and are not invented here.

## Limitations and future work

Org deployment and role assignments remain required. Quote screens currently use Contact IDs. Optional Named Credential integration needs a supplied mock endpoint. Add pagination for workloads above 2,000 personal claims, richer customer lookup UI, product-specific report types, audit monitoring and sandbox validation before any real insurance use.
