namespace Yugma.Crm.Domain.Crm;

public enum LeadSource { Website, Referral, Campaign, Event, ColdCall, Partner, Inbound, Other }
public enum LeadStatus { New, Working, Qualified, Unqualified, Converted }
public enum AccountStatus { Prospect, Customer, Churned }
public enum DealStatus { Open, Won, Lost }
public enum ActivityType { Call, Email, Meeting, Task }
public enum ActivityStatus { Open, Done }

// Polymorphic link target for activities & notes.
public enum CrmEntityType { Lead, Account, Contact, Deal }
