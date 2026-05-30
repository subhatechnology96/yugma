# Employee Career Tracking System — Architecture

> Scope: a multi-tenant, role-based employee **career history** platform that keeps a complete record
> for every employee from joining date to today — projects, managers, timelines, feedback,
> performance, promotions, skills, achievements — with audit trail, reports and analytics.
>
> Stack (existing Yugma): **Angular 21** SPA · **.NET 9 / ASP.NET Core** (MediatR CQRS) ·
> **EF Core + PostgreSQL** · row-level multi-tenancy via `Entity<Guid>.TenantId` + global query filter.

---

## 1. User categories & access model

| # | Category | Tenancy scope | Primary duties | Also an employee? |
|---|----------|---------------|----------------|-------------------|
| 1 | **Super Admin** (Yugma) | **Platform** (all orgs) | Provision orgs, plans, global config, cross-org support, platform analytics | No |
| 2 | **Admin** (Org Admin) | **One organization** | Manage org settings, users, roles, billing, all employees in the org | Yes |
| 3 | **HR Admin / HR** | One organization (HR scope) | Manage employee records, projects, feedback, performance, reports | Yes |
| 4 | **User (Employee)** | **Self** | View/manage own career history, projects, timeline, managers, feedback, achievements | Yes |

**Key rule:** roles are **additive over a base Employee identity**. Everyone except Super Admin is *also*
an employee — i.e. an Org Admin or HR person has the full self-service Employee experience **plus** their
elevated scope. RBAC is therefore modelled as **(permission × data-scope)**, not a single rigid role.

```
Super Admin ───────────────► platform scope (cross-tenant)
        Admin ──────────────► org scope        ┐
        HR / HR Admin ──────► org scope (HR)    ├─ all sit on top of …
        Employee ───────────► self scope        ┘   the Employee base role
```

---

## 2. RBAC model

### 2.1 Two dimensions: Permission + Scope

A request is authorized iff the principal holds the **permission** AND the target row is within the
principal's **data scope**.

```
Permission  : WHAT you can do          e.g. career.read, project.write, report.view, tenant.manage
Scope       : WHOSE data you can touch  Self ⊂ Organization ⊂ Platform
```

### 2.2 Permission catalogue (illustrative)

```
career.read / career.write           project.read / project.write
feedback.read / feedback.write        performance.read / performance.write
promotion.manage                      skill.read / skill.write
employee.read / employee.manage       report.view / analytics.view
audit.view                            user.manage / role.assign
org.settings.manage                   tenant.manage  (platform only)
billing.manage
```

### 2.3 Role → permission/scope matrix

| Permission group | Super Admin | Admin | HR | Employee |
|---|---|---|---|---|
| Own career/projects/feedback (read+write) | – | ✅ self | ✅ self | ✅ self |
| Any employee career/projects/perf/feedback | ✅ platform | ✅ org | ✅ org | ❌ |
| Performance reviews & calibration (write) | ✅ platform | ✅ org | ✅ org | ❌ |
| Promotions / role history | ✅ platform | ✅ org | ✅ org | ❌ |
| Employee CRUD, onboarding | ✅ platform | ✅ org | ✅ org | ❌ |
| Reports & analytics | ✅ platform | ✅ org | ✅ org | ✅ self only |
| Audit trail | ✅ platform | ✅ org | ✅ org (read) | ❌ (own actions only) |
| User & role management | ✅ platform | ✅ org | ⚠️ HR roles only | ❌ |
| Org settings / branding / policies | ✅ any org | ✅ own org | ❌ | ❌ |
| Tenant lifecycle (create/suspend org), plans | ✅ | ❌ | ❌ | ❌ |
| Cross-org dashboards, platform health | ✅ | ❌ | ❌ | ❌ |

`⚠️` HR can assign/maintain HR-scoped roles but not grant Admin.

### 2.4 Enforcement (defense in depth)

1. **Authentication** → JWT with claims: `sub`, `tenant_id`, `roles[]`, `permissions[]`, `employee_id`.
2. **API policy layer** → ASP.NET Core authorization policies map 1:1 to permissions
   (extends the existing `[Authorize(Policy = "CrmView")]` pattern).
3. **Data-scope guard** → every query is filtered by the resolved scope:
   - Self → `WHERE employee_id = @me`
   - Org → global tenant filter (`TenantId = current`) — already in `YugmaDbContext`
   - Platform (Super Admin) → tenant filter bypassed / explicit tenant selection
4. **Row ownership checks** in command handlers for self-scope mutations.
5. **Audit** every state change (who/when/what/old→new).

> Today the demo gates **only in the frontend** (`AuthService.roles`). The target state enforces the
> same policies **server-side** (see §10 roadmap).

---

## 3. Multi-tenant architecture

### 3.1 Isolation strategy — **shared DB, row-level `TenantId`** (+ Postgres RLS)

Chosen because it matches the current implementation, is cheapest to operate, and scales to thousands
of small/medium orgs. Hardened with **PostgreSQL Row-Level Security** as a second wall behind the EF
global query filter.

| Strategy | Isolation | Cost | Ops | Verdict |
|---|---|---|---|---|
| Row-level `TenantId` (+ RLS) | Logical | Low | Simple | **Chosen** |
| Schema-per-tenant | Medium | Medium | Migrations × N | Future, for large/regulated tenants |
| Database-per-tenant | Strong | High | Heavy | Only for enterprise/compliance tenants |

> A **hybrid** path is viable: keep shared-DB default, promote a large/regulated tenant to its own
> schema/DB later without changing the domain model (the `TenantId` seam stays).

### 3.2 Tenant context resolution

```
Request → AuthN (JWT) → TenantMiddleware sets ITenantContext.TenantId
        → DbContext applies HasQueryFilter(e => e.TenantId == tenant)   [existing]
        → Postgres RLS policy: USING (tenant_id = current_setting('app.tenant_id'))
```

- **Super Admin**: no fixed tenant. Operates via an explicit `?tenantId=` / tenant-switcher, or a
  platform context that runs queries with `IgnoreQueryFilters()` + an explicit tenant predicate and a
  bypass RLS role. Cross-org actions are **always audited**.
- **Impersonation**: Super Admin / Admin may "view as" with a short-lived scoped token; impersonation
  is recorded in the audit trail (`acting_as`).

---

## 4. High-level system architecture

```
                         ┌──────────────────────────────────────────────┐
                         │                Angular 21 SPA                  │
                         │  Shells per persona (Super Admin / Org / Me)   │
                         │  AuthService (roles, permissions) · guards     │
                         │  Feature modules: Career, HR, Reports, Admin   │
                         └───────────────┬──────────────────────────────-┘
                                         │ HTTPS (JWT)
                         ┌───────────────▼──────────────────────────────┐
                         │              API Gateway / BFF                 │
                         │  TLS, rate limit, CORS, JWT validate, routing  │
                         └───────────────┬──────────────────────────────┘
                                         │
        ┌────────────────────────────────▼─────────────────────────────────┐
        │                    ASP.NET Core API (.NET 9)                       │
        │  Controllers → MediatR (Commands/Queries) → Validators → Handlers  │
        │  Cross-cutting: AuthZ policies · TenantMiddleware · Audit behavior │
        │                  Logging (Serilog) · Caching · OutBox              │
        ├───────────────┬───────────────┬───────────────┬───────────────────┤
        │ Identity &    │  Career &      │  HR Ops       │  Reporting &      │
        │ Tenant svc    │  Employee svc  │  svc          │  Analytics svc    │
        └───────┬───────┴───────┬───────┴───────┬───────┴─────────┬─────────┘
                │               │               │                 │
        ┌───────▼───────────────▼───────────────▼─────────────────▼─────────┐
        │   PostgreSQL (primary)  ·  read replica(s)  ·  RLS per tenant      │
        │   Object storage (documents)  ·  Redis (cache/sessions)            │
        │   Audit store (append-only)   ·  Analytics (materialized views)    │
        └───────────────────────────────────────────────────────────────────┘
                                         │
                         Background workers: notifications, report builds,
                         data retention, outbox dispatch, analytics refresh
```

Layering (Clean Architecture, already in repo): **Api → Application (MediatR) → Domain → Infrastructure**.

---

## 5. Module breakdown

| Module | Responsibility | Primary consumers |
|---|---|---|
| **Identity & Access** | Users, roles, permissions, sessions, MFA, impersonation | All |
| **Tenant / Org** | Org lifecycle, settings, branding, subscription/plan | Super Admin, Admin |
| **Employee** | Employee master, departments, employment details | Admin, HR |
| **Career History** | Role stints, reporting-line history, promotions, timeline | All (self for Employee) |
| **Projects** | Projects, assignments, responsibilities, outcomes | HR + self |
| **Performance** | Review cycles, calibration, 9-box, ratings (quarter/year) | HR/Admin write; self read |
| **Feedback** | Manager/peer feedback, 1:1 notes | HR/manager write; self read |
| **Skills & Achievements** | Skill inventory, endorsements, awards, milestones | Self + HR |
| **Documents** | Offer letters, certificates, IDs (metadata + blob ref) | HR + self |
| **Reports & Analytics** | Dashboards, exports, trends per scope | Scoped per role |
| **Audit** | Append-only change log, access log | Admin/HR read; SA platform |
| **Notifications** | Email/in-app for reviews, approvals, milestones | All |

These map to the **HR area** already in the codebase (attendance/leave/payroll/performance/recruitment/
employee-profile) plus the new **Career** module.

---

## 6. Domain & database design

### 6.1 ERD (core)

```
organizations(id, name, plan, status, created_at)                  ← tenants (Super Admin scope)
   │1                                                              
   │*                                                              
users(id, tenant_id, email, password_hash, mfa, status)           
   │1        │*                                                    
   │1   user_roles(user_id, role_id, scope)  ── roles(id, key, name, is_system)
   │1                                              │*  role_permissions(role_id, permission_id)
   │1                                              permissions(id, key)
   │
employees(id, tenant_id, user_id?, code, name, dob, doj, dept_id,
          designation, employment_type, status, manager_id?)      ← "now" snapshot
   │1
   ├─* role_history(id, employee_id, title, level, from, to?, manager_id)        (effective-dated)
   ├─* reporting_lines(id, employee_id, manager_id, from, to?)                   (effective-dated)
   ├─* promotions(id, employee_id, from_title, to_title, effective_on, by)
   ├─* project_assignments(id, project_id, employee_id, role, from, to?, alloc)  ── projects(id, tenant_id, name, domain, status, start, end, owner)
   ├─* performance_reviews(id, employee_id, year, quarter, rating, goal, status, reviewer, summary, competencies)
   ├─* feedback(id, employee_id, author_id, type, visibility, body, created_at)
   ├─* employee_skills(employee_id, skill_id, level, endorsements) ── skills(id, tenant_id, name, category)
   ├─* achievements(id, employee_id, title, category, date, description)
   └─* employee_documents(id, employee_id, name, category, blob_uri, status, uploaded_at)

audit_log(id, tenant_id, actor_user_id, acting_as?, entity, entity_id,
          action, before_json, after_json, ip, occurred_at)        ← append-only
```

### 6.2 Complete-history principle: **effective-dated + append-only**

The employee row holds the *current* snapshot; **history is never overwritten**:

- **Effective dating** (`from` / nullable `to`) on `role_history`, `reporting_lines`,
  `project_assignments` → reconstruct "who was your manager / role / project on any date".
- **Immutable events**: `promotions`, `performance_reviews`, `feedback`, `achievements` are inserts,
  not updates (corrections create a new version + audit entry).
- **Audit log** captures every change with `before`/`after` for full traceability.
- Optional: Postgres **temporal pattern** (`tstzrange` + exclusion constraints) or system-versioned
  history tables for regulated tenants.

> This is the persistence backbone for "complete employee history from joining date till current date."

### 6.3 Relationship to the implemented prototype

Already real tables: `employees`, `employee_documents`, `employee_projects`, `performance_reviews`,
`leave_requests`, `attendance_overrides`, `candidates`, `job_openings`, `module_subscriptions`,
`audit_logs`. The prototype **generates** role/manager/timeline/feedback deterministically; the target
architecture **persists** them in the effective-dated tables above (generators become seed/backfill).

---

## 7. Database flow (request lifecycle)

```
1. Client calls  GET /api/orgs/{org}/employees/{id}/career      (JWT in header)
2. Gateway       validate JWT, rate-limit, route
3. API           AuthN → claims; AuthZ policy "career.read"
4. Scope guard   Employee → must be self (employee_id == me) else 403
                 HR/Admin → tenant must match token tenant
                 Super Admin → tenant from path, RLS bypass role
5. TenantContext set tenant_id; set SQL  app.tenant_id  GUC (for RLS)
6. MediatR       GetCareerQuery → handler → repository
7. EF Core       query auto-filtered by TenantId (+ self predicate); RLS enforces again
8. Assemble      merge effective-dated history + projects + feedback + reviews
9. Audit         read-access logged for sensitive entities (configurable)
10. Response     DTO (no domain leakage); PII masked per viewer scope
```

Writes additionally run through a **MediatR audit/outbox behavior**: persist change + `audit_log`
row + emit domain event (notifications, analytics refresh) in one transaction (outbox pattern).

---

## 8. API & authorization design

RESTful, tenant-scoped, policy-protected. Suggested shape:

```
# Platform (Super Admin)
GET    /api/platform/organizations
POST   /api/platform/organizations            tenant.manage
GET    /api/platform/analytics

# Org-scoped (Admin / HR)
GET    /api/orgs/{org}/employees                employee.read   (org scope)
POST   /api/orgs/{org}/employees                employee.manage
GET    /api/orgs/{org}/employees/{id}/career    career.read
POST   /api/orgs/{org}/employees/{id}/projects  project.write
PUT    /api/orgs/{org}/employees/{id}/reviews   performance.write
GET    /api/orgs/{org}/reports/attrition        report.view
GET    /api/orgs/{org}/audit                     audit.view

# Self (any employee)
GET    /api/me/career                            career.read (self)
POST   /api/me/projects                          project.write (self)
GET    /api/me/feedback                          feedback.read (self)
```

- Policies registered centrally; controllers annotate `[Authorize(Policy = "career.write")]`.
- A `ResourceScopeHandler` resolves Self/Org/Platform from claims + route and authorizes the row.
- Versioned (`/api/v1`), paginated, idempotent writes, ETag/RowVersion for concurrency (already on
  entities).

---

## 9. Security

| Concern | Approach |
|---|---|
| AuthN | OIDC/JWT access + refresh; MFA for Admin/HR/Super Admin; SSO (SAML/OIDC) per org |
| AuthZ | Permission policies + Self/Org/Platform scope guard; **server-side enforced** |
| Tenant isolation | EF global filter **and** Postgres RLS; Super-Admin bypass is explicit + audited |
| Transport | TLS 1.2+, HSTS |
| At rest | DB encryption; document blobs in object storage with signed URLs; secrets in vault |
| PII | Field-level masking by scope (e.g., Employee sees own bank/PAN; peers don't); data-class tags |
| Audit | Append-only `audit_log`; immutable; export for compliance; access logging for sensitive reads |
| Input | FluentValidation on every command; output DTOs only (no entity leakage) |
| Abuse | Rate limiting, account lockout, anomaly alerts |
| Compliance | Data residency (per-tenant region option), retention & right-to-erasure workflows |
| Impersonation | Time-boxed, scoped, fully audited (`acting_as`) |

---

## 10. Reports & analytics

- **Per-scope dashboards**: Employee (my growth, ratings trend, project history); HR/Admin (headcount,
  attrition, 9-box, review completion, promotion velocity, skills coverage); Super Admin (cross-org KPIs,
  adoption, platform health).
- **Serving**: precompute heavy aggregates as **materialized views** / a star-schema mart refreshed by
  background jobs; read from **replicas** to protect OLTP.
- **Exports**: CSV/PDF per report (career profile export, payslip/Form-16 style), queued for large sets.
- **Streaming**: domain events → analytics pipeline for near-real-time tiles.

---

## 11. Scalability & operations

- **Stateless API** behind a load balancer → scale horizontally; sessions/cache in Redis.
- **Read replicas** for reports; **connection pooling** (PgBouncer).
- **Partitioning**: `audit_log` and time-series (attendance) partitioned by tenant/month.
- **Caching**: per-tenant reference data (departments, skills, policies) in Redis with tenant-keyed keys.
- **Background workers**: notifications, report builds, analytics refresh, retention, outbox dispatch.
- **Tenant noisy-neighbor**: per-tenant rate limits; promote heavy tenants to dedicated schema/DB.
- **Observability**: structured logs (Serilog), traces, per-tenant metrics, health checks.
- **Migrations**: EF Core migrations applied on deploy; expand-contract for zero downtime.

---

## 12. Mapping to current Yugma codebase + roadmap

**Already in place**
- Multi-tenant row filter (`Entity<Guid>.TenantId` + `YugmaDbContext` global query filter).
- Clean architecture + MediatR CQRS; FluentValidation; RowVersion concurrency.
- Auth scaffolding with `roles[]` / `permissions[]` (frontend `AuthService`); CRM endpoints already
  policy-secured (`CrmView`/`CrmEdit`).
- Career feature: `CareerFactory` + persisted `employee_projects`, performance reviews, documents,
  attendance/leave overrides — the data model seeds for the history tables.

**To build for the full architecture**
1. **Persist real Identity/RBAC**: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
   (+ `scope`); replace mock login; issue JWT with tenant/roles/permissions/employee_id claims.
2. **Server-side AuthZ**: register permission policies; add `ResourceScopeHandler` (Self/Org/Platform);
   protect all HR/career endpoints (they are currently `AllowAnonymous`).
3. **Super Admin plane**: platform controllers, tenant switcher, RLS bypass role, cross-org analytics.
4. **Effective-dated history tables**: `role_history`, `reporting_lines`, `promotions`, `feedback`,
   `project_assignments`, `skills`/`employee_skills`, `achievements` — migrate generators to persistence.
5. **Audit behavior**: MediatR pipeline writing `audit_log` (before/after) + outbox events.
6. **Postgres RLS** policies per table keyed on `app.tenant_id`.
7. **Analytics mart** + materialized views + scheduled refresh; export workers.
8. **Org settings/branding/policy** management (extends `module_subscriptions`).

> Build order recommendation: **1 → 2 → 4 → 5 → 3 → 6 → 7**. Items 1–2 close the biggest gap
> (real, enforced RBAC) without disturbing the existing UI.
