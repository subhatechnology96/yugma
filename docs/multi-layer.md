# Multi-layer architecture

Beyond the four-circle Clean Architecture, Yugma is organised into the following horizontal slices:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI LAYER (Angular 21)                                                  │
│  • Standalone components, signals, Tailwind + PrimeNG                   │
│  • Route guards, HTTP interceptors, theme/tenant services               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ HTTPS + JWT
┌──────────────────────▼──────────────────────────────────────────────────┐
│  API GATEWAY LAYER                                                      │
│  • TLS termination, rate limiting, request shaping                      │
│  • Replaceable: YARP, Azure API Mgmt, AWS API Gateway, NGINX            │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  AUTHENTICATION LAYER                                                   │
│  • JWT (HS256) issuer + validator                                       │
│  • OAuth2 / OIDC ready (Google, Microsoft)                              │
│  • Phone OTP + TOTP MFA                                                 │
│  • Tenant claim → ITenantContext                                        │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  BUSINESS LOGIC LAYER (CQRS handlers in Yugma.Crm.Application)           │
│  • Commands / Queries via MediatR                                       │
│  • FluentValidation pipeline                                            │
│  • Use-case orchestration only — no persistence concerns                │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  WORKFLOW ENGINE LAYER                                                  │
│  • Multi-level approvals (PO, leave, vendor onboarding, expenses)       │
│  • Threshold + role-based routing                                       │
│  • SLA timers, escalation, notifications                                │
│  • Pluggable: in-process + Hangfire/Temporal/Azure Durable for long-run │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  SERVICE LAYER (Infrastructure adapters)                                │
│  • EmailService, SmsService, StorageService, GstService, AiService      │
│  • Implements interfaces declared in Application                        │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  DATA ACCESS LAYER (EF Core 9)                                          │
│  • YugmaDbContext with per-aggregate IEntityTypeConfiguration            │
│  • Owned value objects, row-version concurrency, tenant query filters   │
│  • Repository implementations (IEmployeeRepository → EmployeeRepository)│
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│  DATABASE LAYER (PostgreSQL 16+)                                        │
│  • Schema `Yugma.*`                                                      │
│  • Optional: per-tenant schemas or row-level security policies          │
│  • Outbox table for at-least-once integration events                    │
└─────────────────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────────────────┐
       │  REPORTING & ANALYTICS LAYER                                   │
       │  • Read replicas + materialized views for heavy aggregates     │
       │  • OLAP exports to ClickHouse / BigQuery / Snowflake           │
       │  • Excel / PDF export via QuestPDF + ClosedXML                 │
       └────────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────────────────┐
       │  AI INTEGRATION LAYER                                          │
       │  • Tool-calling agent: KPI summarization, anomaly detection    │
       │  • Forecasts (revenue, attrition, demand)                      │
       │  • Embeddings + pgvector for semantic search                   │
       │  • Adapter pattern — swap Anthropic / OpenAI / Bedrock         │
       └────────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────────────────┐
       │  AUDIT & LOGGING LAYER                                         │
       │  • Append-only audit log (actor, action, resource, outcome)    │
       │  • Serilog → console / Seq / Elasticsearch / Datadog           │
       │  • OpenTelemetry traces (extend Program.cs)                    │
       └────────────────────────────────────────────────────────────────┘
```

## Cross-cutting concerns

| Concern        | Mechanism                                                      |
|----------------|----------------------------------------------------------------|
| Multi-tenancy  | Tenant claim in JWT → `ITenantContext` → EF global query filter|
| AuthN          | JWT bearer, refresh tokens, BCrypt password hashing            |
| AuthZ          | Role + permission claims, policy-based + per-resource checks   |
| Validation     | FluentValidation pipeline behavior (Application)               |
| Logging        | Serilog request logging + MediatR `LoggingBehavior`            |
| Error handling | `ExceptionHandlingMiddleware` → RFC 7807 problem-details JSON  |
| Audit          | Outbox-style trail written from domain events                  |
| Caching        | `CachingBehavior` (extend) over queries, Redis-backed          |
| Idempotency    | Idempotency-Key header → `IdempotencyBehavior` (extend)        |
