# Demonstration script

The hosted browser demo is synthetic and is not connected to Salesforce. Use it to explain the workflow while the Salesforce org is being configured. A final Salesforce recording should follow the same steps after deployment.

1. Open the demo. Explain the three insurance lines and four initial synthetic claims. Show total exposure and pending approvals.
2. Search for Jordan. Filter Property, TX, Submitted for Approval. Clear the filters to recover the full workload.
3. Open Policy quoting. Enter Auto, Demo Customer, CA, VIN `1HGCM82633A004352`, model year `2017`. Save: premium should be $1,250. Enter an invalid VIN and show the validation error.
4. Quote a Property policy with 2,000 square feet, year built 2000, TX. Expected premium: ($800 + $200) × 1.05 = $1,050. Quote Life with beneficiary Demo Beneficiary, 120 months, NY. Expected premium: $740.
5. Open Claims dashboard, File a claim. Select the new Auto policy, amount $60,000 and a past loss date. Create it and show product routing plus Submitted for Approval.
6. Open Approvals as Senior Adjuster. Approve the claim with a comment. It remains pending and now requires Department Manager. Switch to Department Manager and approve. Show final Approved status.
7. Create another high-value claim and reject at the senior step. Show Rejected status. Explain that exactly $50,000 remains New and does not enter the high-value process.
8. Open Project guide and GitHub source. Explain the Salesforce objects, Flows, Apex, LWC, privacy and test classes.

For the actual Salesforce recording, also show setup objects and field sets, flow activation, real current-user ownership filtering, approval history, role access checks and the Apex test report. Do not claim measured coverage using this browser demo.
