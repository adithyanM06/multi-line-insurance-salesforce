# Salesforce source listing

## metadata/package.xml

```
<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>CustomObject</name></types><types><members>*</members><name>ApexClass</name></types><types><members>*</members><name>LightningComponentBundle</name></types><types><members>*</members><name>Flow</name></types><types><members>*</members><name>Queue</name></types><types><members>*</members><name>Group</name></types><types><members>*</members><name>SharingRules</name></types><types><members>*</members><name>PermissionSet</name></types><types><members>*</members><name>ApprovalProcess</name></types><types><members>*</members><name>Workflow</name></types><types><members>*</members><name>CustomTab</name></types><types><members>*</members><name>CustomApplication</name></types><types><members>*</members><name>QuickAction</name></types><version>63.0</version></Package>
```

## metadata/applications/Insurance_Operations.app

```
<?xml version="1.0" encoding="UTF-8"?><CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata"><description>Policy and claims workspace</description><formFactors>Large</formFactors><label>Insurance Operations</label><navType>Standard</navType><tabs>Policy__c</tabs><tabs>Claim__c</tabs><uiType>Lightning</uiType></CustomApplication>
```

## metadata/approvalProcesses/Claim__c.High_Value_Claim_Approval.approvalProcess

```
<?xml version="1.0" encoding="UTF-8"?><ApprovalProcess xmlns="http://soap.sforce.com/2006/04/metadata"><active>true</active><allowRecall>true</allowRecall><allowedSubmitters><type>owner</type></allowedSubmitters><allowedSubmitters><type>creator</type></allowedSubmitters><approvalPageFields><field>Name</field><field>Claim_Amount__c</field><field>Policy__c</field><field>Senior_Adjuster__c</field><field>Department_Manager__c</field></approvalPageFields><approvalStep><allowDelegate>false</allowDelegate><assignedApprover><approver><name>Senior_Adjuster__c</name><type>relatedUserField</type></approver><whenMultipleApprovers>FirstResponse</whenMultipleApprovers></assignedApprover><label>Senior Adjuster Review</label><name>Senior_Review</name><rejectBehavior><type>RejectRequest</type></rejectBehavior></approvalStep><approvalStep><allowDelegate>false</allowDelegate><assignedApprover><approver><name>Department_Manager__c</name><type>relatedUserField</type></approver><whenMultipleApprovers>FirstResponse</whenMultipleApprovers></assignedApprover><label>Department Manager Review</label><name>Manager_Review</name><rejectBehavior><type>RejectRequest</type></rejectBehavior></approvalStep><entryCriteria><formula>Claim_Amount__c &gt; 50000</formula></entryCriteria><finalApprovalActions><action><name>Status_Approved</name><type>FieldUpdate</type></action></finalApprovalActions><finalApprovalRecordLock>false</finalApprovalRecordLock><finalRejectionActions><action><name>Status_Rejected</name><type>FieldUpdate</type></action></finalRejectionActions><finalRejectionRecordLock>false</finalRejectionRecordLock><initialSubmissionActions><action><name>Status_Submitted</name><type>FieldUpdate</type></action></initialSubmissionActions><label>High Value Claim Approval</label><processOrder>1</processOrder><recordEditability>AdminOnly</recordEditability><showApprovalHistory>true</showApprovalHistory></ApprovalProcess>
```

## metadata/classes/ClaimApprovalAction.cls

```
public with sharing class ClaimApprovalAction {
    public class Input {
        @InvocableVariable(required=true) public Id claimId;
        @InvocableVariable(required=true) public String decision;
        @InvocableVariable public String comments;
    }
    @InvocableMethod(label='Decide Pending Claim Approval')
    public static void decide(List<Input> inputs) {
        Set<Id> ids=new Set<Id>();
        for(Input i:inputs) { if(i.decision!='Approve' && i.decision!='Reject') throw new AuraHandledException('Choose Approve or Reject.'); ids.add(i.claimId); }
        // Only work items assigned to the caller can be acted on. Never resubmit.
        Map<Id,Id> workByClaim=new Map<Id,Id>();
        for(ProcessInstanceWorkitem w:[SELECT Id, ProcessInstance.TargetObjectId FROM ProcessInstanceWorkitem WHERE ProcessInstance.TargetObjectId IN :ids AND ActorId=:UserInfo.getUserId()]) workByClaim.put(w.ProcessInstance.TargetObjectId,w.Id);
        List<Approval.ProcessRequest> requests=new List<Approval.ProcessRequest>();
        for(Input i:inputs){
            if(!workByClaim.containsKey(i.claimId)) throw new AuraHandledException('No pending approval is assigned to you for this claim.');
            Approval.ProcessWorkitemRequest r=new Approval.ProcessWorkitemRequest(); r.setWorkitemId(workByClaim.get(i.claimId)); r.setAction(i.decision); r.setComments(i.comments); requests.add(r);
        }
        for(Approval.ProcessResult r:Approval.process(requests)) if(!r.isSuccess()) throw new AuraHandledException(r.getErrors()[0].getMessage());
    }
}
```

## metadata/classes/ClaimApprovalAction.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/classes/ClaimsAdjusterController.cls

```
public with sharing class ClaimsAdjusterController {
    public class ClaimWrapper {
        @AuraEnabled public Id claimId;
        @AuraEnabled public String claimNumber;
        @AuraEnabled public Decimal claimAmount;
        @AuraEnabled public String status;
        @AuraEnabled public String policyType;
        @AuraEnabled public String policyHolderName;
        @AuraEnabled public String state;
        @AuraEnabled public Integer daysOpen;
        public ClaimWrapper(Claim__c c) {
            claimId=c.Id; claimNumber=c.Name; claimAmount=c.Claim_Amount__c;
            status=c.Approval_Status__c; state=c.Policy_Account_Holder_State__c;
            policyType=c.Policy__r == null || c.Policy__r.RecordType == null ? 'Unknown' : c.Policy__r.RecordType.DeveloperName;
            policyHolderName=c.Policy__r == null || c.Policy__r.Customer__r == null ? 'Unknown' : c.Policy__r.Customer__r.Name;
            daysOpen=c.CreatedDate.date().daysBetween(Date.today());
        }
    }
    @AuraEnabled(cacheable=true)
    public static List<ClaimWrapper> getAssignedClaims() {
        List<ClaimWrapper> result=new List<ClaimWrapper>();
        for(Claim__c c : [SELECT Id, Name, Claim_Amount__c, Approval_Status__c, CreatedDate, Policy_Account_Holder_State__c, Policy__r.RecordType.DeveloperName, Policy__r.Customer__r.Name FROM Claim__c WHERE OwnerId=:UserInfo.getUserId() WITH USER_MODE ORDER BY CreatedDate DESC LIMIT 2000]) result.add(new ClaimWrapper(c));
        return result;
    }
}
```

## metadata/classes/ClaimsAdjusterController.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/classes/ClaimsAdjusterControllerTest.cls

```
@IsTest
private class ClaimsAdjusterControllerTest {
    static Policy__c policy(String type,Id contactId){
        Policy__c p=new Policy__c(Customer__c=contactId,RecordTypeId=Schema.SObjectType.Policy__c.getRecordTypeInfosByDeveloperName().get(type).getRecordTypeId(),VIN__c='1HGCM82633A004352',Model_Year__c='2017',Square_Footage__c=1200,Year_Built__c='2000',Beneficiary_Name__c='Demo Beneficiary',Policy_Term_Months__c=120,Policy_State__c='CA'); insert p;return p;
    }
    @IsTest static void assignedAndMetrics(){
        Contact con=new Contact(FirstName='Demo',LastName='Customer');insert con;
        List<Claim__c> claims=new List<Claim__c>();
        for(String type:new List<String>{'Auto','Property','Life'}) {Policy__c p=policy(type,con.Id);claims.add(new Claim__c(Policy__c=p.Id,Claim_Amount__c=5000,Adjuster__c=UserInfo.getUserId(),Approval_Status__c='New'));}
        insert claims;
        for(Claim__c c:claims) Test.setCreatedDate(c.Id,DateTime.now().addDays(-10));
        Test.startTest();List<ClaimsAdjusterController.ClaimWrapper> rows=ClaimsAdjusterController.getAssignedClaims();Test.stopTest();
        System.assertEquals(3,rows.size());Set<String> types=new Set<String>();
        for(ClaimsAdjusterController.ClaimWrapper r:rows){types.add(r.policyType);System.assertEquals('Demo Customer',r.policyHolderName);System.assertEquals(5000,r.claimAmount);System.assertEquals('New',r.status);System.assertEquals(10,r.daysOpen);System.assertEquals('CA',r.state);System.assertNotEquals(null,r.claimId);System.assertNotEquals(null,r.claimNumber);}
        System.assertEquals(new Set<String>{'Auto','Property','Life'},types);
    }
    @IsTest static void emptyAndOwnerIsolation(){
        Contact con=new Contact(LastName='Customer');insert con;Policy__c p=policy('Auto',con.Id);
        Id queue=[SELECT Id FROM Group WHERE DeveloperName='Auto_Claims' AND Type='Queue' LIMIT 1].Id;
        insert new Claim__c(Policy__c=p.Id,Claim_Amount__c=100,OwnerId=queue);
        System.assertEquals(0,ClaimsAdjusterController.getAssignedClaims().size(),'Queue owned claims must not leak into personal workload');
    }
    @IsTest static void wrapperNullRelationships(){
        Claim__c c=new Claim__c(Claim_Amount__c=100,CreatedDate=DateTime.now());
        ClaimsAdjusterController.ClaimWrapper r=new ClaimsAdjusterController.ClaimWrapper(c);
        System.assertEquals('Unknown',r.policyType);System.assertEquals('Unknown',r.policyHolderName);System.assertEquals(0,r.daysOpen);
    }
    @IsTest static void bulkPremiumOrder(){
        Contact con=new Contact(LastName='Quote');insert con;
        Policy__c ca=policy('Auto',con.Id),tx=policy('Auto',con.Id);tx.Policy_State__c='TX';tx.Model_Year__c='2020';update tx;
        List<PremiumCalculator.Input> requests=new List<PremiumCalculator.Input>();
        for(Id id:new List<Id>{tx.Id,ca.Id,tx.Id}){PremiumCalculator.Input i=new PremiumCalculator.Input();i.policyId=id;requests.add(i);}
        Test.startTest();List<PremiumCalculator.Output> out=PremiumCalculator.calculatePremium(requests);Test.stopTest();
        System.assertEquals(3,out.size());System.assertEquals(1050,out[0].premium);System.assertEquals(1250,out[1].premium);System.assertEquals(1050,out[2].premium);
    }
    @IsTest static void rejectInvalidApproval(){
        ClaimApprovalAction.Input i=new ClaimApprovalAction.Input();i.decision='invalid';
        try{ClaimApprovalAction.decide(new List<ClaimApprovalAction.Input>{i});System.assert(false);}catch(AuraHandledException e){System.assertNotEquals(null,e);}
        i.decision='Approve';
        try{ClaimApprovalAction.decide(new List<ClaimApprovalAction.Input>{i});System.assert(false);}catch(AuraHandledException e){System.assertNotEquals(null,e);}
    }
}
```

## metadata/classes/ClaimsAdjusterControllerTest.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/classes/PremiumCalculator.cls

```
public with sharing class PremiumCalculator {
    public class Input { @InvocableVariable(required=true) public Id policyId; }
    public class Output { @InvocableVariable public Decimal premium; }
    @InvocableMethod(label='Calculate Policy Premium')
    public static List<Output> calculatePremium(List<Input> inputs) {
        Set<Id> ids = new Set<Id>();
        for (Input i : inputs) if (i != null && i.policyId != null) ids.add(i.policyId);
        Map<Id,Policy__c> policies = new Map<Id,Policy__c>([SELECT Id, RecordType.DeveloperName, Model_Year__c, Policy_State__c, Square_Footage__c, Policy_Term_Months__c FROM Policy__c WHERE Id IN :ids WITH USER_MODE]);
        List<Output> results = new List<Output>();
        for (Input i : inputs) {
            if(i == null || !policies.containsKey(i.policyId)) throw new AuraHandledException('Policy is unavailable.');
            Policy__c p = policies.get(i.policyId);
            Decimal rate = p.RecordType.DeveloperName == 'Property' ? 800 + p.Square_Footage__c * 0.1 : p.RecordType.DeveloperName == 'Life' ? 500 + p.Policy_Term_Months__c * 2 : 1000;
            if(p.Policy_State__c == 'CA') rate *= 1.15;
            else if(p.Policy_State__c == 'TX') rate *= 1.05;
            if(p.RecordType.DeveloperName == 'Auto' && String.isNotBlank(p.Model_Year__c) && Integer.valueOf(p.Model_Year__c) < 2018) rate += 100;
            Output o = new Output(); o.premium = rate.setScale(2); results.add(o);
        }
        return results;
    }
}
```

## metadata/classes/PremiumCalculator.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/classes/QuoteVerification.cls

```
public with sharing class QuoteVerification {
    // Configure the Quote_Verification Named Credential before using this optional simulation.
    public static Boolean verifyVin(String vin) {
        if(vin == null || !Pattern.matches('[A-HJ-NPR-Z0-9]{17}',vin)) return false;
        HttpRequest req=new HttpRequest(); req.setEndpoint('callout:Quote_Verification/vehicles/'+EncodingUtil.urlEncode(vin,'UTF-8')); req.setMethod('GET'); req.setTimeout(10000);
        HttpResponse response=new Http().send(req);
        if(response.getStatusCode()!=200) throw new CalloutException('Verification service unavailable.');
        Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
        return payload.get('valid') == true;
    }
}
```

## metadata/classes/QuoteVerification.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/classes/QuoteVerificationTest.cls

```
@IsTest private class QuoteVerificationTest {
    private class Mock implements HttpCalloutMock { public HttpResponse respond(HttpRequest r){System.assert(r.getEndpoint().contains('1HGCM82633A004352'));HttpResponse h=new HttpResponse();h.setStatusCode(200);h.setBody('{"valid":true}');return h;} }
    private class Failure implements HttpCalloutMock {public HttpResponse respond(HttpRequest r){HttpResponse h=new HttpResponse();h.setStatusCode(503);return h;}}
    @IsTest static void verification(){Test.setMock(HttpCalloutMock.class,new Mock());System.assert(QuoteVerification.verifyVin('1HGCM82633A004352'));System.assertEquals(false,QuoteVerification.verifyVin('bad'));}
    @IsTest static void serviceFailure(){Test.setMock(HttpCalloutMock.class,new Failure());try{QuoteVerification.verifyVin('1HGCM82633A004352');System.assert(false);}catch(CalloutException e){System.assert(e.getMessage().contains('unavailable'));}}
}
```

## metadata/classes/QuoteVerificationTest.cls-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><status>Active</status></ApexClass>
```

## metadata/flows/AutoQuotingFlow.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Auto Quoting Flow</label><processType>Flow</processType><recordLookups><name>GetRecordType</name><label>GetRecordType</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>Basics</targetReference></connector><filterLogic>and</filterLogic><filters><field>SobjectType</field><operator>EqualTo</operator><value><stringValue>Policy__c</stringValue></value></filters><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Auto</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>RecordType</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><screens><name>Basics</name><label>Auto Policy Basics</label><locationX>100</locationX><locationY>150</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>Details</targetReference></connector><fields><name>CustomerId</name><dataType>String</dataType><fieldText>Customer Contact ID</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>StartDate</name><dataType>Date</dataType><fieldText>Policy start date</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>State</name><dataType>String</dataType><fieldText>State (CA, TX, NY, Other)</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Details</name><label>Auto Details</label><locationX>100</locationX><locationY>200</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>CreateDraft</targetReference></connector><fields><name>VIN</name><dataType>String</dataType><fieldText>VIN</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>Model_Year</name><dataType>String</dataType><fieldText>Model Year</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><recordCreates><name>CreateDraft</name><label>Create Draft Policy</label><locationX>100</locationX><locationY>250</locationY><connector><targetReference>CalculatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><inputAssignments><field>VIN__c</field><value><elementReference>VIN</elementReference></value></inputAssignments><inputAssignments><field>Model_Year__c</field><value><elementReference>Model_Year</elementReference></value></inputAssignments><inputAssignments><field>Customer__c</field><value><elementReference>CustomerId</elementReference></value></inputAssignments><inputAssignments><field>Policy_Start_Date__c</field><value><elementReference>StartDate</elementReference></value></inputAssignments><inputAssignments><field>Policy_State__c</field><value><elementReference>State</elementReference></value></inputAssignments><inputAssignments><field>RecordTypeId</field><value><elementReference>GetRecordType.Id</elementReference></value></inputAssignments><object>Policy__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordCreates><actionCalls><name>CalculatePremium</name><label>Calculate Premium</label><locationX>100</locationX><locationY>300</locationY><actionName>PremiumCalculator</actionName><actionType>apex</actionType><connector><targetReference>UpdatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><flowTransactionModel>CurrentTransaction</flowTransactionModel><inputParameters><name>policyId</name><value><elementReference>CreateDraft</elementReference></value></inputParameters><storeOutputAutomatically>true</storeOutputAutomatically></actionCalls><recordUpdates><name>UpdatePremium</name><label>Save Calculated Premium</label><locationX>100</locationX><locationY>350</locationY><connector><targetReference>Success</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>CreateDraft</elementReference></value></filters><inputAssignments><field>Premium__c</field><value><elementReference>CalculatePremium.premium</elementReference></value></inputAssignments><object>Policy__c</object></recordUpdates><screens><name>Success</name><label>Quote Ready</label><locationX>100</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>QuoteResult</name><fieldText>Draft policy: {!CreateDraft}. Premium: {!CalculatePremium.premium}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Failure</name><label>Unable to complete</label><locationX>600</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>ErrorMessage</name><fieldText>{!$Flow.FaultMessage}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetRecordType</targetReference></connector></start><status>Active</status></Flow>
```

## metadata/flows/ClaimApproverScreenFlow.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Claim Approver Screen Flow</label><processType>Flow</processType><choices><name>Approve</name><choiceText>Approve</choiceText><dataType>String</dataType><value><stringValue>Approve</stringValue></value></choices><choices><name>Reject</name><choiceText>Reject</choiceText><dataType>String</dataType><value><stringValue>Reject</stringValue></value></choices><recordLookups><name>GetClaim</name><label>GetClaim</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>Review</targetReference></connector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>recordId</elementReference></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Claim__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><screens><name>Review</name><label>Review Claim</label><locationX>100</locationX><locationY>200</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>Decide</targetReference></connector><fields><name>ClaimSummary</name><fieldText>Claim {!GetClaim.Name} â€” Amount {!GetClaim.Claim_Amount__c} â€” Status {!GetClaim.Approval_Status__c}</fieldText><fieldType>DisplayText</fieldType></fields><fields><name>Decision</name><choiceReferences>Approve</choiceReferences><choiceReferences>Reject</choiceReferences><dataType>String</dataType><fieldText>Approval decision</fieldText><fieldType>RadioButtons</fieldType><isRequired>true</isRequired></fields><fields><name>Comments</name><dataType>String</dataType><fieldText>Review comments</fieldText><fieldType>LargeTextArea</fieldType><isRequired>false</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><actionCalls><name>Decide</name><label>Decide Pending Approval</label><locationX>100</locationX><locationY>300</locationY><actionName>ClaimApprovalAction</actionName><actionType>apex</actionType><faultConnector><targetReference>Failure</targetReference></faultConnector><flowTransactionModel>CurrentTransaction</flowTransactionModel><inputParameters><name>claimId</name><value><elementReference>recordId</elementReference></value></inputParameters><inputParameters><name>decision</name><value><elementReference>Decision</elementReference></value></inputParameters><inputParameters><name>comments</name><value><elementReference>Comments</elementReference></value></inputParameters></actionCalls><screens><name>Failure</name><label>Unable to complete</label><locationX>600</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>ErrorMessage</name><fieldText>{!$Flow.FaultMessage}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetClaim</targetReference></connector></start><status>Active</status><variables><name>recordId</name><dataType>String</dataType><isCollection>false</isCollection><isInput></isInput><isOutput>false</isOutput></variables></Flow>
```

## metadata/flows/ClaimPolicyHolderStateUpdate.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Claim Policy Holder State Update</label><processType>AutoLaunchedFlow</processType><recordLookups><name>GetPolicy</name><label>GetPolicy</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>StampState</targetReference></connector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>$Record.Policy__c</elementReference></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Policy__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><assignments><name>StampState</name><label>Stamp linked policy state</label><locationX>100</locationX><locationY>200</locationY><assignmentItems><assignToReference>$Record.Policy_Account_Holder_State__c</assignToReference><operator>Assign</operator><value><elementReference>GetPolicy.Policy_State__c</elementReference></value></assignmentItems></assignments><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetPolicy</targetReference></connector><object>Claim__c</object><recordTriggerType>CreateAndUpdate</recordTriggerType><triggerType>RecordBeforeSave</triggerType></start><status>Active</status></Flow>
```

## metadata/flows/ClaimRouting.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Claim Routing</label><processType>AutoLaunchedFlow</processType><recordLookups><name>GetPolicy</name><label>GetPolicy</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>GetPolicyType</targetReference></connector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>$Record.Policy__c</elementReference></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Policy__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><recordLookups><name>GetPolicyType</name><label>GetPolicyType</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>AssignedAdjuster</targetReference></connector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>GetPolicy.RecordTypeId</elementReference></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>RecordType</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><decisions><name>AssignedAdjuster</name><label>Has assigned adjuster?</label><locationX>100</locationX><locationY>150</locationY><connector><targetReference>RouteByLine</targetReference></connector><defaultConnectorLabel>Route to queue</defaultConnectorLabel><rules><name>HasAdjuster</name><conditionLogic>and</conditionLogic><conditions><leftValueReference>$Record.Adjuster__c</leftValueReference><operator>IsNull</operator><rightValue><booleanValue>false</booleanValue></rightValue></conditions><connector><targetReference>SetAdjusterOwner</targetReference></connector><label>Assigned adjuster</label></rules></decisions><recordUpdates><name>SetAdjusterOwner</name><label>SetAdjusterOwner</label><locationX>100</locationX><locationY>300</locationY><inputAssignments><field>OwnerId</field><value><elementReference>$Record.Adjuster__c</elementReference></value></inputAssignments><inputReference>$Record</inputReference></recordUpdates><decisions><name>RouteByLine</name><label>Route by policy type</label><locationX>100</locationX><locationY>200</locationY><connector><targetReference>GetLifeQueue</targetReference></connector><defaultConnectorLabel>Life</defaultConnectorLabel><rules><name>AutoRoute</name><conditionLogic>and</conditionLogic><conditions><leftValueReference>GetPolicyType.DeveloperName</leftValueReference><operator>EqualTo</operator><rightValue><stringValue>Auto</stringValue></rightValue></conditions><connector><targetReference>GetAutoQueue</targetReference></connector><label>Auto</label></rules><rules><name>PropertyRoute</name><conditionLogic>and</conditionLogic><conditions><leftValueReference>GetPolicyType.DeveloperName</leftValueReference><operator>EqualTo</operator><rightValue><stringValue>Property</stringValue></rightValue></conditions><connector><targetReference>GetPropertyQueue</targetReference></connector><label>Property</label></rules></decisions><recordLookups><name>GetAutoQueue</name><label>GetAutoQueue</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>AssignAutoQueue</targetReference></connector><filterLogic>and</filterLogic><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Auto_Claims</stringValue></value></filters><filters><field>Type</field><operator>EqualTo</operator><value><stringValue>Queue</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Group</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><recordUpdates><name>AssignAutoQueue</name><label>AssignAutoQueue</label><locationX>100</locationX><locationY>300</locationY><inputAssignments><field>OwnerId</field><value><elementReference>GetAutoQueue.Id</elementReference></value></inputAssignments><inputReference>$Record</inputReference></recordUpdates><recordLookups><name>GetPropertyQueue</name><label>GetPropertyQueue</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>AssignPropertyQueue</targetReference></connector><filterLogic>and</filterLogic><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Property_Claims</stringValue></value></filters><filters><field>Type</field><operator>EqualTo</operator><value><stringValue>Queue</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Group</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><recordUpdates><name>AssignPropertyQueue</name><label>AssignPropertyQueue</label><locationX>100</locationX><locationY>300</locationY><inputAssignments><field>OwnerId</field><value><elementReference>GetPropertyQueue.Id</elementReference></value></inputAssignments><inputReference>$Record</inputReference></recordUpdates><recordLookups><name>GetLifeQueue</name><label>GetLifeQueue</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>AssignLifeQueue</targetReference></connector><filterLogic>and</filterLogic><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Life_Claims</stringValue></value></filters><filters><field>Type</field><operator>EqualTo</operator><value><stringValue>Queue</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>Group</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><recordUpdates><name>AssignLifeQueue</name><label>AssignLifeQueue</label><locationX>100</locationX><locationY>300</locationY><inputAssignments><field>OwnerId</field><value><elementReference>GetLifeQueue.Id</elementReference></value></inputAssignments><inputReference>$Record</inputReference></recordUpdates><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetPolicy</targetReference></connector><object>Claim__c</object><recordTriggerType>Create</recordTriggerType><triggerType>RecordAfterSave</triggerType></start><status>Active</status></Flow>
```

## metadata/flows/LifeQuotingFlow.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Life Quoting Flow</label><processType>Flow</processType><recordLookups><name>GetRecordType</name><label>GetRecordType</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>Basics</targetReference></connector><filterLogic>and</filterLogic><filters><field>SobjectType</field><operator>EqualTo</operator><value><stringValue>Policy__c</stringValue></value></filters><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Life</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>RecordType</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><screens><name>Basics</name><label>Life Policy Basics</label><locationX>100</locationX><locationY>150</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>Details</targetReference></connector><fields><name>CustomerId</name><dataType>String</dataType><fieldText>Customer Contact ID</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>StartDate</name><dataType>Date</dataType><fieldText>Policy start date</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>State</name><dataType>String</dataType><fieldText>State (CA, TX, NY, Other)</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Details</name><label>Life Details</label><locationX>100</locationX><locationY>200</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>CreateDraft</targetReference></connector><fields><name>Beneficiary_Name</name><dataType>String</dataType><fieldText>Beneficiary Name</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>Policy_Term_Months</name><dataType>Number</dataType><fieldText>Policy Term Months</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><recordCreates><name>CreateDraft</name><label>Create Draft Policy</label><locationX>100</locationX><locationY>250</locationY><connector><targetReference>CalculatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><inputAssignments><field>Beneficiary_Name__c</field><value><elementReference>Beneficiary_Name</elementReference></value></inputAssignments><inputAssignments><field>Policy_Term_Months__c</field><value><elementReference>Policy_Term_Months</elementReference></value></inputAssignments><inputAssignments><field>Customer__c</field><value><elementReference>CustomerId</elementReference></value></inputAssignments><inputAssignments><field>Policy_Start_Date__c</field><value><elementReference>StartDate</elementReference></value></inputAssignments><inputAssignments><field>Policy_State__c</field><value><elementReference>State</elementReference></value></inputAssignments><inputAssignments><field>RecordTypeId</field><value><elementReference>GetRecordType.Id</elementReference></value></inputAssignments><object>Policy__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordCreates><actionCalls><name>CalculatePremium</name><label>Calculate Premium</label><locationX>100</locationX><locationY>300</locationY><actionName>PremiumCalculator</actionName><actionType>apex</actionType><connector><targetReference>UpdatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><flowTransactionModel>CurrentTransaction</flowTransactionModel><inputParameters><name>policyId</name><value><elementReference>CreateDraft</elementReference></value></inputParameters><storeOutputAutomatically>true</storeOutputAutomatically></actionCalls><recordUpdates><name>UpdatePremium</name><label>Save Calculated Premium</label><locationX>100</locationX><locationY>350</locationY><connector><targetReference>Success</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>CreateDraft</elementReference></value></filters><inputAssignments><field>Premium__c</field><value><elementReference>CalculatePremium.premium</elementReference></value></inputAssignments><object>Policy__c</object></recordUpdates><screens><name>Success</name><label>Quote Ready</label><locationX>100</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>QuoteResult</name><fieldText>Draft policy: {!CreateDraft}. Premium: {!CalculatePremium.premium}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Failure</name><label>Unable to complete</label><locationX>600</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>ErrorMessage</name><fieldText>{!$Flow.FaultMessage}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetRecordType</targetReference></connector></start><status>Active</status></Flow>
```

## metadata/flows/PropertyQuotingFlow.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>Property Quoting Flow</label><processType>Flow</processType><recordLookups><name>GetRecordType</name><label>GetRecordType</label><locationX>100</locationX><locationY>100</locationY><connector><targetReference>Basics</targetReference></connector><filterLogic>and</filterLogic><filters><field>SobjectType</field><operator>EqualTo</operator><value><stringValue>Policy__c</stringValue></value></filters><filters><field>DeveloperName</field><operator>EqualTo</operator><value><stringValue>Property</stringValue></value></filters><getFirstRecordOnly>true</getFirstRecordOnly><object>RecordType</object><storeOutputAutomatically>true</storeOutputAutomatically></recordLookups><screens><name>Basics</name><label>Property Policy Basics</label><locationX>100</locationX><locationY>150</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>Details</targetReference></connector><fields><name>CustomerId</name><dataType>String</dataType><fieldText>Customer Contact ID</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>StartDate</name><dataType>Date</dataType><fieldText>Policy start date</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>State</name><dataType>String</dataType><fieldText>State (CA, TX, NY, Other)</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Details</name><label>Property Details</label><locationX>100</locationX><locationY>200</locationY><allowBack>true</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><connector><targetReference>CreateDraft</targetReference></connector><fields><name>Square_Footage</name><dataType>Number</dataType><fieldText>Square Footage</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><fields><name>Year_Built</name><dataType>String</dataType><fieldText>Year Built</fieldText><fieldType>InputField</fieldType><isRequired>true</isRequired></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><recordCreates><name>CreateDraft</name><label>Create Draft Policy</label><locationX>100</locationX><locationY>250</locationY><connector><targetReference>CalculatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><inputAssignments><field>Square_Footage__c</field><value><elementReference>Square_Footage</elementReference></value></inputAssignments><inputAssignments><field>Year_Built__c</field><value><elementReference>Year_Built</elementReference></value></inputAssignments><inputAssignments><field>Customer__c</field><value><elementReference>CustomerId</elementReference></value></inputAssignments><inputAssignments><field>Policy_Start_Date__c</field><value><elementReference>StartDate</elementReference></value></inputAssignments><inputAssignments><field>Policy_State__c</field><value><elementReference>State</elementReference></value></inputAssignments><inputAssignments><field>RecordTypeId</field><value><elementReference>GetRecordType.Id</elementReference></value></inputAssignments><object>Policy__c</object><storeOutputAutomatically>true</storeOutputAutomatically></recordCreates><actionCalls><name>CalculatePremium</name><label>Calculate Premium</label><locationX>100</locationX><locationY>300</locationY><actionName>PremiumCalculator</actionName><actionType>apex</actionType><connector><targetReference>UpdatePremium</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><flowTransactionModel>CurrentTransaction</flowTransactionModel><inputParameters><name>policyId</name><value><elementReference>CreateDraft</elementReference></value></inputParameters><storeOutputAutomatically>true</storeOutputAutomatically></actionCalls><recordUpdates><name>UpdatePremium</name><label>Save Calculated Premium</label><locationX>100</locationX><locationY>350</locationY><connector><targetReference>Success</targetReference></connector><faultConnector><targetReference>Failure</targetReference></faultConnector><filterLogic>and</filterLogic><filters><field>Id</field><operator>EqualTo</operator><value><elementReference>CreateDraft</elementReference></value></filters><inputAssignments><field>Premium__c</field><value><elementReference>CalculatePremium.premium</elementReference></value></inputAssignments><object>Policy__c</object></recordUpdates><screens><name>Success</name><label>Quote Ready</label><locationX>100</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>QuoteResult</name><fieldText>Draft policy: {!CreateDraft}. Premium: {!CalculatePremium.premium}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><screens><name>Failure</name><label>Unable to complete</label><locationX>600</locationX><locationY>400</locationY><allowBack>false</allowBack><allowFinish>true</allowFinish><allowPause>false</allowPause><fields><name>ErrorMessage</name><fieldText>{!$Flow.FaultMessage}</fieldText><fieldType>DisplayText</fieldType></fields><showFooter>true</showFooter><showHeader>true</showHeader></screens><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>GetRecordType</targetReference></connector></start><status>Active</status></Flow>
```

## metadata/flows/SubmissionAutomationFlow.flow

```
<?xml version="1.0" encoding="UTF-8"?><Flow xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><interviewLabel>Insurance {!$Flow.CurrentDateTime}</interviewLabel><label>High Value Claim Submission</label><processType>AutoLaunchedFlow</processType><actionCalls><name>SubmitApproval</name><label>Submit Claim for Approval</label><locationX>100</locationX><locationY>100</locationY><actionName>submit</actionName><actionType>submit</actionType><flowTransactionModel>CurrentTransaction</flowTransactionModel><inputParameters><name>objectId</name><value><elementReference>$Record.Id</elementReference></value></inputParameters><inputParameters><name>processDefinitionNameOrId</name><value><stringValue>High_Value_Claim_Approval</stringValue></value></inputParameters><inputParameters><name>submitterId</name><value><elementReference>$Record.CreatedById</elementReference></value></inputParameters><storeOutputAutomatically>true</storeOutputAutomatically></actionCalls><start><locationX>100</locationX><locationY>0</locationY><connector><targetReference>SubmitApproval</targetReference></connector><filterLogic>and</filterLogic><filters><field>Claim_Amount__c</field><operator>GreaterThan</operator><value><numberValue>50000</numberValue></value></filters><filters><field>Approval_Status__c</field><operator>EqualTo</operator><value><stringValue>New</stringValue></value></filters><object>Claim__c</object><recordTriggerType>CreateAndUpdate</recordTriggerType><triggerType>RecordAfterSave</triggerType></start><status>Active</status></Flow>
```

## metadata/groups/CA_Adjusters.group

```
<?xml version="1.0" encoding="UTF-8"?><Group xmlns="http://soap.sforce.com/2006/04/metadata"><doesIncludeBosses>false</doesIncludeBosses><name>CA Adjusters</name></Group>
```

## metadata/groups/NY_Adjusters.group

```
<?xml version="1.0" encoding="UTF-8"?><Group xmlns="http://soap.sforce.com/2006/04/metadata"><doesIncludeBosses>false</doesIncludeBosses><name>NY Adjusters</name></Group>
```

## metadata/groups/TX_Adjusters.group

```
<?xml version="1.0" encoding="UTF-8"?><Group xmlns="http://soap.sforce.com/2006/04/metadata"><doesIncludeBosses>false</doesIncludeBosses><name>TX Adjusters</name></Group>
```

## metadata/lwc/claimsDashboardLwc/claimsDashboardLwc.css

```
.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:1rem}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}@media(max-width:600px){.filters{grid-template-columns:1fr}}
```

## metadata/lwc/claimsDashboardLwc/claimsDashboardLwc.html

```
<template><lightning-card title="My Assigned Claims" icon-name="standard:case"><lightning-button slot="actions" label="Refresh" onclick={refresh}></lightning-button><div class="slds-p-around_medium"><template lwc:if={error}><p role="alert">{error}</p></template><div class="filters"><lightning-input type="search" label="Search claims or customers" onchange={onSearch}></lightning-input><lightning-combobox label="Policy type" value={type} options={typeOptions} onchange={onType}></lightning-combobox><lightning-combobox label="Status" value={status} options={statusOptions} onchange={onStatus}></lightning-combobox></div><p class="slds-m-vertical_medium">{count} claims Â· <lightning-formatted-number value={total} format-style="currency" currency-code="USD"></lightning-formatted-number></p><template lwc:if={empty}><p>No claims match these filters.</p></template><div class="tiles"><template for:each={filtered} for:item="claim"><c-claim-tile-lwc key={claim.claimId} claim-data={claim}></c-claim-tile-lwc></template></div></div></lightning-card></template>
```

## metadata/lwc/claimsDashboardLwc/claimsDashboardLwc.js

```
import { LightningElement, wire } from 'lwc';
import getAssignedClaims from '@salesforce/apex/ClaimsAdjusterController.getAssignedClaims';
import { refreshApex } from '@salesforce/apex';
export default class ClaimsDashboardLwc extends LightningElement {
    rows=[]; error; search=''; type='All'; status='All'; wiredResult;
    @wire(getAssignedClaims) wiredClaims(result){this.wiredResult=result; if(result.data){this.rows=result.data;this.error=undefined;}else if(result.error){this.error=result.error.body?.message || 'Unable to load claims';}}
    get typeOptions(){return ['All','Auto','Property','Life'].map(v=>({label:v,value:v}));}
    get statusOptions(){return ['All','New','Submitted for Approval','Approved','Rejected'].map(v=>({label:v,value:v}));}
    get filtered(){let q=this.search.toLowerCase();return this.rows.filter(r=>(this.type==='All'||r.policyType===this.type)&&(this.status==='All'||r.status===this.status)&&[r.claimNumber,r.policyHolderName,r.state].some(v=>(v||'').toLowerCase().includes(q)));}
    get count(){return this.filtered.length;} get total(){return this.filtered.reduce((n,r)=>n+(r.claimAmount||0),0);} get empty(){return !this.count;}
    onSearch(e){this.search=e.target.value;} onType(e){this.type=e.detail.value;} onStatus(e){this.status=e.detail.value;}
    refresh(){return refreshApex(this.wiredResult);}
}
```

## metadata/lwc/claimsDashboardLwc/claimsDashboardLwc.js-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><isExposed>true</isExposed><targets><target>lightning__AppPage</target><target>lightning__HomePage</target></targets></LightningComponentBundle>
```

## metadata/lwc/claimTileLwc/claimTileLwc.html

```
<template><article class="slds-box"><lightning-icon icon-name={policyIcon} size="small"></lightning-icon><lightning-button variant="base" label={claimData.claimNumber} onclick={open}></lightning-button><p>{claimData.policyHolderName}</p><p>{claimData.policyType} Â· {claimData.state}</p><lightning-formatted-number value={claimData.claimAmount} format-style="currency" currency-code="USD"></lightning-formatted-number><p>{claimData.status}</p><p>Days open: {claimData.daysOpen}</p></article></template>
```

## metadata/lwc/claimTileLwc/claimTileLwc.js

```
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
export default class ClaimTileLwc extends NavigationMixin(LightningElement){
    @api claimData;
    get policyIcon(){return {Auto:'utility:truck',Property:'utility:home',Life:'utility:people'}[this.claimData?.policyType]||'utility:help';}
    open(){this[NavigationMixin.Navigate]({type:'standard__recordPage',attributes:{recordId:this.claimData.claimId,objectApiName:'Claim__c',actionName:'view'}});}
}
```

## metadata/lwc/claimTileLwc/claimTileLwc.js-meta.xml

```
<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>63.0</apiVersion><isExposed>false</isExposed></LightningComponentBundle>
```

## metadata/objects/Claim__c.object

```
<?xml version="1.0" encoding="UTF-8"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><deploymentStatus>Deployed</deploymentStatus><enableActivities>true</enableActivities><enableHistory>true</enableHistory><enableReports>true</enableReports><enableSearch>true</enableSearch><label>Claim</label><nameField><displayFormat>C-{0000}</displayFormat><label>Claim Number</label><type>AutoNumber</type></nameField><pluralLabel>Claims</pluralLabel><sharingModel>Private</sharingModel><fields><fullName>Policy__c</fullName><label>Policy</label><type>Lookup</type><deleteConstraint>Restrict</deleteConstraint><referenceTo>Policy__c</referenceTo><relationshipLabel>Policys</relationshipLabel><relationshipName>Policys</relationshipName></fields><fields><fullName>Adjuster__c</fullName><label>Adjuster</label><type>Lookup</type><deleteConstraint>Restrict</deleteConstraint><referenceTo>User</referenceTo><relationshipLabel>Adjusters</relationshipLabel><relationshipName>Adjusters</relationshipName></fields><fields><fullName>Senior_Adjuster__c</fullName><label>Senior Adjuster</label><type>Lookup</type><deleteConstraint>Restrict</deleteConstraint><referenceTo>User</referenceTo><relationshipLabel>Senior Adjusters</relationshipLabel><relationshipName>Senior_Adjusters</relationshipName></fields><fields><fullName>Department_Manager__c</fullName><label>Department Manager</label><type>Lookup</type><deleteConstraint>Restrict</deleteConstraint><referenceTo>User</referenceTo><relationshipLabel>Department Managers</relationshipLabel><relationshipName>Department_Managers</relationshipName></fields><fields><fullName>Claim_Amount__c</fullName><label>Claim Amount</label><type>Currency</type><precision>18</precision><scale>2</scale></fields><fields><fullName>Date_of_Loss__c</fullName><label>Date of Loss</label><type>DateTime</type></fields><fields><fullName>Description__c</fullName><label>Description</label><type>LongTextArea</type><length>32768</length><visibleLines>5</visibleLines></fields><fields><fullName>Policy_Account_Holder_State__c</fullName><label>Policy Account Holder State</label><type>Text</type><length>10</length></fields><fields><fullName>Approval_Status__c</fullName><label>Approval Status</label><type>Picklist</type><valueSet><restricted>true</restricted><valueSetDefinition><sorted>false</sorted><value><fullName>New</fullName><default>true</default><label>New</label></value><value><fullName>Submitted for Approval</fullName><default>false</default><label>Submitted for Approval</label></value><value><fullName>Approved</fullName><default>false</default><label>Approved</label></value><value><fullName>Rejected</fullName><default>false</default><label>Rejected</label></value></valueSetDefinition></valueSet></fields><recordTypes><fullName>Accident</fullName><active>true</active><label>Accident</label><picklistValues><picklist>Approval_Status__c</picklist><values><fullName>New</fullName><default>true</default></values><values><fullName>Submitted for Approval</fullName><default>false</default></values><values><fullName>Approved</fullName><default>false</default></values><values><fullName>Rejected</fullName><default>false</default></values></picklistValues></recordTypes><recordTypes><fullName>Property</fullName><active>true</active><label>Property</label><picklistValues><picklist>Approval_Status__c</picklist><values><fullName>New</fullName><default>true</default></values><values><fullName>Submitted for Approval</fullName><default>false</default></values><values><fullName>Approved</fullName><default>false</default></values><values><fullName>Rejected</fullName><default>false</default></values></picklistValues></recordTypes><recordTypes><fullName>Life</fullName><active>true</active><label>Life</label><picklistValues><picklist>Approval_Status__c</picklist><values><fullName>New</fullName><default>true</default></values><values><fullName>Submitted for Approval</fullName><default>false</default></values><values><fullName>Approved</fullName><default>false</default></values><values><fullName>Rejected</fullName><default>false</default></values></picklistValues></recordTypes><validationRules><fullName>Positive_Claim</fullName><active>true</active><errorConditionFormula>OR(ISBLANK(Claim_Amount__c),Claim_Amount__c&lt;=0,ISBLANK(Policy__c))</errorConditionFormula><errorMessage>A claim requires a policy and a positive amount.</errorMessage></validationRules><validationRules><fullName>Loss_Date_Not_Future</fullName><active>true</active><errorDisplayField>Date_of_Loss__c</errorDisplayField><errorConditionFormula>Date_of_Loss__c&gt;NOW()</errorConditionFormula><errorMessage>Date of loss cannot be in the future.</errorMessage></validationRules><validationRules><fullName>Approvers_Required</fullName><active>true</active><errorConditionFormula>AND(Claim_Amount__c&gt;50000,OR(ISBLANK(Senior_Adjuster__c),ISBLANK(Department_Manager__c),Senior_Adjuster__c=Department_Manager__c))</errorConditionFormula><errorMessage>High-value claims require two distinct approvers.</errorMessage></validationRules></CustomObject>
```

## metadata/objects/Policy__c.object

```
<?xml version="1.0" encoding="UTF-8"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><deploymentStatus>Deployed</deploymentStatus><enableActivities>true</enableActivities><enableHistory>true</enableHistory><enableReports>true</enableReports><enableSearch>true</enableSearch><label>Policy</label><nameField><displayFormat>P-{0000}</displayFormat><label>Policy Number</label><type>AutoNumber</type></nameField><pluralLabel>Policies</pluralLabel><sharingModel>Private</sharingModel><fields><fullName>Customer__c</fullName><label>Customer</label><type>Lookup</type><deleteConstraint>Restrict</deleteConstraint><referenceTo>Contact</referenceTo><relationshipLabel>Customers</relationshipLabel><relationshipName>Customers</relationshipName></fields><fields><fullName>VIN__c</fullName><label>VIN</label><type>Text</type><length>20</length></fields><fields><fullName>Model_Year__c</fullName><label>Model Year</label><type>Text</type><length>5</length></fields><fields><fullName>Year_Built__c</fullName><label>Year Built</label><type>Text</type><length>5</length></fields><fields><fullName>Beneficiary_Name__c</fullName><label>Beneficiary Name</label><type>Text</type><length>50</length></fields><fields><fullName>Square_Footage__c</fullName><label>Square Footage</label><type>Number</type><precision>18</precision><scale>0</scale></fields><fields><fullName>Policy_Term_Months__c</fullName><label>Policy Term Months</label><type>Number</type><precision>18</precision><scale>0</scale></fields><fields><fullName>Policy_Start_Date__c</fullName><label>Policy Start Date</label><type>Date</type></fields><fields><fullName>Premium__c</fullName><label>Premium</label><type>Currency</type><precision>18</precision><scale>2</scale></fields><fields><fullName>Policy_State__c</fullName><label>Policy State</label><type>Picklist</type><valueSet><restricted>true</restricted><valueSetDefinition><sorted>false</sorted><value><fullName>CA</fullName><default>true</default><label>CA</label></value><value><fullName>TX</fullName><default>false</default><label>TX</label></value><value><fullName>NY</fullName><default>false</default><label>NY</label></value><value><fullName>Other</fullName><default>false</default><label>Other</label></value></valueSetDefinition></valueSet></fields><fields><fullName>Status__c</fullName><label>Status</label><type>Picklist</type><valueSet><restricted>true</restricted><valueSetDefinition><sorted>false</sorted><value><fullName>Draft</fullName><default>true</default><label>Draft</label></value><value><fullName>Issued</fullName><default>false</default><label>Issued</label></value><value><fullName>Expired</fullName><default>false</default><label>Expired</label></value></valueSetDefinition></valueSet></fields><recordTypes><fullName>Auto</fullName><active>true</active><label>Auto</label><picklistValues><picklist>Policy_State__c</picklist><values><fullName>CA</fullName><default>true</default></values><values><fullName>TX</fullName><default>false</default></values><values><fullName>NY</fullName><default>false</default></values><values><fullName>Other</fullName><default>false</default></values></picklistValues><picklistValues><picklist>Status__c</picklist><values><fullName>Draft</fullName><default>true</default></values><values><fullName>Issued</fullName><default>false</default></values><values><fullName>Expired</fullName><default>false</default></values></picklistValues></recordTypes><recordTypes><fullName>Property</fullName><active>true</active><label>Property</label><picklistValues><picklist>Policy_State__c</picklist><values><fullName>CA</fullName><default>true</default></values><values><fullName>TX</fullName><default>false</default></values><values><fullName>NY</fullName><default>false</default></values><values><fullName>Other</fullName><default>false</default></values></picklistValues><picklistValues><picklist>Status__c</picklist><values><fullName>Draft</fullName><default>true</default></values><values><fullName>Issued</fullName><default>false</default></values><values><fullName>Expired</fullName><default>false</default></values></picklistValues></recordTypes><recordTypes><fullName>Life</fullName><active>true</active><label>Life</label><picklistValues><picklist>Policy_State__c</picklist><values><fullName>CA</fullName><default>true</default></values><values><fullName>TX</fullName><default>false</default></values><values><fullName>NY</fullName><default>false</default></values><values><fullName>Other</fullName><default>false</default></values></picklistValues><picklistValues><picklist>Status__c</picklist><values><fullName>Draft</fullName><default>true</default></values><values><fullName>Issued</fullName><default>false</default></values><values><fullName>Expired</fullName><default>false</default></values></picklistValues></recordTypes><fieldSets><fullName>Auto_Fields</fullName><description>Policy-specific quote inputs</description><displayedFields><field>VIN__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><displayedFields><field>Model_Year__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><label>Auto_Fields</label></fieldSets><fieldSets><fullName>Property_Fields</fullName><description>Policy-specific quote inputs</description><displayedFields><field>Square_Footage__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><displayedFields><field>Year_Built__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><label>Property_Fields</label></fieldSets><fieldSets><fullName>Life_Fields</fullName><description>Policy-specific quote inputs</description><displayedFields><field>Beneficiary_Name__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><displayedFields><field>Policy_Term_Months__c</field><isFieldManaged>false</isFieldManaged><isRequired>true</isRequired></displayedFields><label>Life_Fields</label></fieldSets><validationRules><fullName>VIN_Must_Be_17_Characters</fullName><active>true</active><errorDisplayField>VIN__c</errorDisplayField><errorConditionFormula>AND(RecordType.DeveloperName="Auto",NOT(REGEX(VIN__c,"[A-HJ-NPR-Z0-9]{17}")))</errorConditionFormula><errorMessage>Auto VIN must contain 17 valid uppercase VIN characters.</errorMessage></validationRules><validationRules><fullName>Valid_Model_Year</fullName><active>true</active><errorDisplayField>Model_Year__c</errorDisplayField><errorConditionFormula>AND(RecordType.DeveloperName="Auto",OR(NOT(REGEX(Model_Year__c,"[0-9]{4}")),VALUE(Model_Year__c)&lt;1900,VALUE(Model_Year__c)&gt;YEAR(TODAY())+1))</errorConditionFormula><errorMessage>Enter a valid four-digit model year.</errorMessage></validationRules><validationRules><fullName>Property_Details_Required</fullName><active>true</active><errorConditionFormula>AND(RecordType.DeveloperName="Property",OR(ISBLANK(Square_Footage__c),Square_Footage__c&lt;=0,NOT(REGEX(Year_Built__c,"[0-9]{4}"))))</errorConditionFormula><errorMessage>Property requires positive square footage and four-digit year built.</errorMessage></validationRules><validationRules><fullName>Life_Details_Required</fullName><active>true</active><errorConditionFormula>AND(RecordType.DeveloperName="Life",OR(ISBLANK(Beneficiary_Name__c),ISBLANK(Policy_Term_Months__c),Policy_Term_Months__c&lt;=0))</errorConditionFormula><errorMessage>Life requires beneficiary and positive term.</errorMessage></validationRules></CustomObject>
```

## metadata/permissionsets/Insurance_Adjuster_Access.permissionset

```
<?xml version="1.0" encoding="UTF-8"?><PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata"><hasActivationRequired>false</hasActivationRequired><label>Insurance Adjuster Access</label><classAccesses><apexClass>ClaimsAdjusterController</apexClass><enabled>true</enabled></classAccesses><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Policy__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Customer__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.VIN__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Model_Year__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Year_Built__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Beneficiary_Name__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Square_Footage__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_Term_Months__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_Start_Date__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Premium__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>true</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Claim__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Policy__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Senior_Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Department_Manager__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Claim_Amount__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Date_of_Loss__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Description__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Policy_Account_Holder_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Approval_Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Contact</object><viewAllRecords>false</viewAllRecords></objectPermissions><userPermissions><enabled>true</enabled><name>RunFlow</name></userPermissions><recordTypeVisibilities><recordType>Policy__c.Auto</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Life</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Accident</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Life</recordType><visible>true</visible></recordTypeVisibilities><applicationVisibilities><application>Insurance_Operations</application><visible>true</visible></applicationVisibilities></PermissionSet>
```

## metadata/permissionsets/Insurance_Agent_Access.permissionset

```
<?xml version="1.0" encoding="UTF-8"?><PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata"><hasActivationRequired>false</hasActivationRequired><label>Insurance Agent Access</label><classAccesses><apexClass>PremiumCalculator</apexClass><enabled>true</enabled></classAccesses><objectPermissions><allowCreate>true</allowCreate><allowDelete>false</allowDelete><allowEdit>true</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Policy__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Customer__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.VIN__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Model_Year__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Year_Built__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Beneficiary_Name__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Square_Footage__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Policy_Term_Months__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Policy_Start_Date__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Premium__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Policy_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Policy__c.Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Claim__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Policy__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Senior_Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Department_Manager__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Claim_Amount__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Date_of_Loss__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Description__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Policy_Account_Holder_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Approval_Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Contact</object><viewAllRecords>false</viewAllRecords></objectPermissions><userPermissions><enabled>true</enabled><name>RunFlow</name></userPermissions><recordTypeVisibilities><recordType>Policy__c.Auto</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Life</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Accident</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Life</recordType><visible>true</visible></recordTypeVisibilities><applicationVisibilities><application>Insurance_Operations</application><visible>true</visible></applicationVisibilities></PermissionSet>
```

## metadata/permissionsets/Insurance_Manager_Access.permissionset

```
<?xml version="1.0" encoding="UTF-8"?><PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata"><hasActivationRequired>false</hasActivationRequired><label>Insurance Manager Access</label><classAccesses><apexClass>ClaimsAdjusterController</apexClass><enabled>true</enabled></classAccesses><classAccesses><apexClass>ClaimApprovalAction</apexClass><enabled>true</enabled></classAccesses><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Policy__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Customer__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.VIN__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Model_Year__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Year_Built__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Beneficiary_Name__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Square_Footage__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_Term_Months__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_Start_Date__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Premium__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Policy_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Policy__c.Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>true</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Claim__c</object><viewAllRecords>false</viewAllRecords></objectPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Policy__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Senior_Adjuster__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Department_Manager__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Claim_Amount__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Date_of_Loss__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Description__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>true</editable><field>Claim__c.Policy_Account_Holder_State__c</field><readable>true</readable></fieldPermissions><fieldPermissions><editable>false</editable><field>Claim__c.Approval_Status__c</field><readable>true</readable></fieldPermissions><objectPermissions><allowCreate>false</allowCreate><allowDelete>false</allowDelete><allowEdit>false</allowEdit><allowRead>true</allowRead><modifyAllRecords>false</modifyAllRecords><object>Contact</object><viewAllRecords>false</viewAllRecords></objectPermissions><userPermissions><enabled>true</enabled><name>RunFlow</name></userPermissions><userPermissions><enabled>true</enabled><name>RunReports</name></userPermissions><recordTypeVisibilities><recordType>Policy__c.Auto</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Policy__c.Life</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Accident</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Property</recordType><visible>true</visible></recordTypeVisibilities><recordTypeVisibilities><recordType>Claim__c.Life</recordType><visible>true</visible></recordTypeVisibilities><applicationVisibilities><application>Insurance_Operations</application><visible>true</visible></applicationVisibilities></PermissionSet>
```

## metadata/queues/Auto_Claims.queue

```
<?xml version="1.0" encoding="UTF-8"?><Queue xmlns="http://soap.sforce.com/2006/04/metadata"><name>Auto Claims</name><queueSobject><sobjectType>Claim__c</sobjectType></queueSobject></Queue>
```

## metadata/queues/Life_Claims.queue

```
<?xml version="1.0" encoding="UTF-8"?><Queue xmlns="http://soap.sforce.com/2006/04/metadata"><name>Life Claims</name><queueSobject><sobjectType>Claim__c</sobjectType></queueSobject></Queue>
```

## metadata/queues/Property_Claims.queue

```
<?xml version="1.0" encoding="UTF-8"?><Queue xmlns="http://soap.sforce.com/2006/04/metadata"><name>Property Claims</name><queueSobject><sobjectType>Claim__c</sobjectType></queueSobject></Queue>
```

## metadata/quickActions/Claim__c.Approve_Reject_Claim.quickAction

```
<?xml version="1.0" encoding="UTF-8"?><QuickAction xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinition>ClaimApproverScreenFlow</flowDefinition><label>Approve / Reject Claim</label><type>Flow</type></QuickAction>
```

## metadata/sharingRules/Claim__c.sharingRules

```
<?xml version="1.0" encoding="UTF-8"?><SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingCriteriaRules><fullName>CA_Territory</fullName><accessLevel>Edit</accessLevel><criteriaItems><field>Policy_Account_Holder_State__c</field><operation>equals</operation><value>CA</value></criteriaItems><label>CA Territory</label><sharedTo><group>CA_Adjusters</group></sharedTo></sharingCriteriaRules><sharingCriteriaRules><fullName>TX_Territory</fullName><accessLevel>Edit</accessLevel><criteriaItems><field>Policy_Account_Holder_State__c</field><operation>equals</operation><value>TX</value></criteriaItems><label>TX Territory</label><sharedTo><group>TX_Adjusters</group></sharedTo></sharingCriteriaRules><sharingCriteriaRules><fullName>NY_Territory</fullName><accessLevel>Edit</accessLevel><criteriaItems><field>Policy_Account_Holder_State__c</field><operation>equals</operation><value>NY</value></criteriaItems><label>NY Territory</label><sharedTo><group>NY_Adjusters</group></sharedTo></sharingCriteriaRules></SharingRules>
```

## metadata/tabs/Claim__c.tab

```
<?xml version="1.0" encoding="UTF-8"?><CustomTab xmlns="http://soap.sforce.com/2006/04/metadata"><customObject>true</customObject><motif>Custom18: Form</motif></CustomTab>
```

## metadata/tabs/Policy__c.tab

```
<?xml version="1.0" encoding="UTF-8"?><CustomTab xmlns="http://soap.sforce.com/2006/04/metadata"><customObject>true</customObject><motif>Custom18: Form</motif></CustomTab>
```

## metadata/workflows/Claim__c.workflow

```
<?xml version="1.0" encoding="UTF-8"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><fieldUpdates><fullName>Status_Approved</fullName><field>Approval_Status__c</field><literalValue>Approved</literalValue><name>Status_Approved</name><notifyAssignee>false</notifyAssignee><operation>Literal</operation><reevaluateOnChange>false</reevaluateOnChange></fieldUpdates><fieldUpdates><fullName>Status_Rejected</fullName><field>Approval_Status__c</field><literalValue>Rejected</literalValue><name>Status_Rejected</name><notifyAssignee>false</notifyAssignee><operation>Literal</operation><reevaluateOnChange>false</reevaluateOnChange></fieldUpdates><fieldUpdates><fullName>Status_Submitted</fullName><field>Approval_Status__c</field><literalValue>Submitted for Approval</literalValue><name>Status_Submitted</name><notifyAssignee>false</notifyAssignee><operation>Literal</operation><reevaluateOnChange>false</reevaluateOnChange></fieldUpdates></Workflow>
```
