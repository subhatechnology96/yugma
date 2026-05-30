# Multi-Tenant Career Tracking — Hierarchy RBAC & Team Management

> Extends [career-tracking-architecture.md](./career-tracking-architecture.md) with a **5-role,
> hierarchy-aware** access model and a centralized **Team Management** screen for assigning/changing
> employee hierarchy with effective dating, bulk ops, history and audit.
>
> Stack: Angular 21 · .NET 9 / ASP.NET Core (MediatR CQRS) · EF Core + PostgreSQL · row-level
> `TenantId` multi-tenancy + RLS.

---

## 1. Roles & data-visibility scopes

| Role | Managed by | Sees | Manages |
|---|---|---|---|
| **Super Admin** | Yugma | **All orgs, all data** | Orgs, users, hierarchy, configs (platform) |
| **Admin** | Org | **All employees in their org** | Everything in org |
| **Manager** | Org | **Self + direct & indirect reports** (subtree) | Their subtree (reassign within team, project alloc) |
| **HR / HR Admin** | Org | **Self + employees in assigned departments/teams** | Records, projects, feedback, reports for HR scope |
| **User (Employee)** | Org | **Self only** | Own profile/projects/feedback/achievements |

**Rule:** except Super Admin, every role is **also a normal employee** for their own profile. A user may
hold **multiple roles** → effective access is the **union** of their scopes.

### 1.1 Scope types (the access primitive)

```
Self        : { me }
Subtree     : me ∪ descendants(me)              ← Manager (reporting closure, effective-dated)
HrScope     : me ∪ employees in assigned depts/teams   ← HR
Organization: all employees where tenant_id = mine     ← Admin
Platform    : all employees, any tenant                ← Super Admin
```

### 1.2 Visibility resolution function

```
visibleEmployeeIds(principal):
    ids = { principal.employeeId }                       # self for everyone
    for role in principal.roles:
        match role:
            SuperAdmin → return ALL (cross-tenant; explicit tenant select)
            Admin      → ids ∪ employees(tenant = principal.tenant)
            Manager    → ids ∪ closure.descendants(principal.employeeId)
            HR         → ids ∪ employees in hr_assignments(principal.employeeId)
            Employee   → ids ∪ {}                         # self only
    return ids
```

A **read** is allowed iff `target.employeeId ∈ visibleEmployeeIds(principal)`.
A **write/reassign** is allowed iff `target ∈ writableScope(principal)` (a stricter subset, §4.2).

### 1.3 Permission × scope matrix

| Action | Super Admin | Admin | Manager | HR | Employee |
|---|---|---|---|---|---|
| View own profile/career/feedback | – | ✅ self | ✅ self | ✅ self | ✅ self |
| View team member data | all | org | **subtree** | HR scope | ❌ |
| Edit performance/feedback | all | org | subtree (reports) | HR scope | ❌ |
| **Reassign manager/team/dept** | all orgs | org | within subtree | HR scope | ❌ |
| Assign **HR** to employees | ✅ | ✅ | ❌ | ⚠️ self-scope only | ❌ |
| Project allocation | all | org | subtree | HR scope | request own |
| Bulk reassignment | ✅ | ✅ | subtree only | HR scope | ❌ |
| View reporting history & audit | all | org | subtree | HR scope | own only |
| Manage orgs/users/roles | ✅ platform | ✅ org | ❌ | HR roles only | ❌ |

---

## 2. Hierarchy data model

### 2.1 Core tables (additions to the career schema)

```
departments(id, tenant_id, name, parent_dept_id?, head_employee_id?)
teams(id, tenant_id, department_id, name, lead_employee_id?)
employees(id, tenant_id, user_id?, code, name, doj, status,
          department_id?, team_id?, manager_id?)              ← CURRENT snapshot (fast reads)

# Effective-dated reporting history (source of truth for "who reported to whom, when")
reporting_lines(id, tenant_id, employee_id, manager_id,
                effective_from, effective_to?,  reason, changed_by, created_at)

# Maintained closure for fast subtree queries (direct + indirect)
reporting_closure(tenant_id, ancestor_id, descendant_id, depth)   # depth 0 = self

# HR coverage (which employees an HR person owns)
hr_assignments(id, tenant_id, hr_employee_id, scope_type ['department'|'team'|'employee'],
               scope_ref_id, effective_from, effective_to?)

# Project allocation history (effective-dated)
project_assignments(id, tenant_id, project_id, employee_id, role,
                    allocation_pct, effective_from, effective_to?)

# Generic, append-only audit for every change
audit_log(id, tenant_id, actor_user_id, acting_as?, entity, entity_id,
          action, before_json, after_json, effective_from?, reason, ip, occurred_at)
```

### 2.2 Why effective-dating + a closure table

- **Effective-dated `reporting_lines`** = complete, queryable history ("as-of" any date) and supports
  **future-dated** changes (a transfer that takes effect next month).
- **`reporting_closure`** gives **O(1)-ish subtree reads** for Manager visibility (direct + indirect)
  without recursive scans on every request. Maintained transactionally on each hierarchy change.
  - Alternative for small orgs: recursive CTE (`WITH RECURSIVE`) or `ltree` materialized path. Closure
    table chosen for read-heavy, real-time org-chart use.
- **`current snapshot`** columns (`manager_id`, `department_id`, `team_id`) keep day-to-day reads cheap;
  history tables are the system of record.

### 2.3 Maintaining the closure on a manager change

```
reassignManager(emp, newMgr, effectiveFrom):
    assert newMgr != emp and newMgr ∉ descendants(emp)      # no cycles
    close current line:  reporting_lines.effective_to = effectiveFrom - 1 day
    insert new line:     (emp, newMgr, effectiveFrom, …)
    if effectiveFrom <= today:                              # active now
        update employees.manager_id = newMgr
        recomputeClosure(subtree(emp))                      # detach + reattach subtree
    else:
        schedule job at effectiveFrom to apply + recompute
    write audit_log(before/after, effectiveFrom, reason)
    emit HierarchyChanged event  → real-time refresh + visibility-cache invalidation
```

---

## 3. Access flow (read with hierarchy)

```
GET /api/orgs/{org}/employees/{id}/career
  1. JWT validated → claims (tenant, roles, employeeId)
  2. AuthZ policy: "career.read"
  3. scope check:  id ∈ visibleEmployeeIds(principal)?
        Employee → id == me
        Manager  → id ∈ closure.descendants(me) ∪ {me}
        HR       → id ∈ hr_scope(me) ∪ {me}
        Admin    → target.tenant == my tenant
        SuperAdmin → ok (tenant from path)
     else 403
  4. TenantContext set → EF global filter (+ RLS GUC app.tenant_id)
  5. handler returns DTO (PII masked per relationship: self > manager/HR > peer)
  6. audit sensitive read (configurable)
```

**Performance:** `visibleEmployeeIds` is cached per principal (Redis, keyed by user+tenant) and
**invalidated on any `HierarchyChanged` / `hr_assignments` change**.

---

## 4. Team Management screen

A single screen where **Super Admin, Admin, Manager, HR** assign/change hierarchy — each constrained to
their writable scope.

### 4.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Team Management                              [ Org ▼ (SA/Admin) ] [ + Assign ] │
│  Search ⌕ [ name · ID · email · department · project ............ ]  Filters ▾ │
├───────────────────────────────┬───────────────────────────────────────────────┤
│  ORG STRUCTURE (tree)          │  EMPLOYEES (table / cards)                     │
│  ▾ Engineering (Devansh)       │  ☐  Name        Dept      Manager     Team    │
│    ▾ Platform (Rahul)          │  ☐  Ananya Rao  Eng       Priya       Platform│
│      • Ananya Rao              │  ☐  …                                          │
│      • …                       │  ─────────────────────────────────────────────│
│  ▸ Sales (Vikram)              │  Selected: 3   [ Reassign ▾ ] [ Allocate ▾ ]  │
│  ▸ Finance                     │                                                │
├───────────────────────────────┴───────────────────────────────────────────────┤
│  DETAIL / DRAWER (on row click)                                                 │
│   Ananya Rao · Senior Engineer · Eng · reports to Priya Sharma                  │
│   [Change Manager] [Change HR] [Change Team] [Change Dept] [Allocate Project]   │
│   Reporting history ───────────────────────────────────────────────────────    │
│     Priya Sharma   2024-01 → present                                            │
│     Devansh Patel  2022-08 → 2023-12                                            │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Capabilities & permission validation

| Capability | Super Admin | Admin | Manager | HR |
|---|---|---|---|---|
| Search (name/ID/email/dept/project) | all orgs | org | subtree | HR scope |
| View org chart / hierarchy | all | org | subtree (rooted at self) | HR scope |
| Change **Manager** | any | any in org | reports only; new mgr in org; no cycle | HR-scope emps |
| Change **HR** | any | any | ❌ | ⚠️ within own scope |
| Change **Team / Department** | any | any in org | subtree | HR-scope emps |
| **Project allocation** | any | org | subtree | HR scope |
| **Bulk** reassign | ✅ | ✅ | subtree | HR scope |
| Effective-dated change (future) | ✅ | ✅ | ✅ | ✅ |
| View reporting history | all | org | subtree | HR scope |

**Every write is validated against `writableScope(principal)`** AND business rules:
- target ∈ writable scope; new manager ∈ same org; **no cycle** (new mgr not in target's subtree);
- effective date ≥ today (or back-dated only by Admin/SA with reason);
- HR can't elevate roles; Manager can't move someone out of their subtree.

### 4.3 Bulk assignment / reassignment

```
Select employees → "Reassign" → choose { manager? team? department? project? }
                 → set Effective date + Reason → Preview (rows + warnings: cycles, scope)
                 → Confirm → transactional batch:
                      for each emp: validate scope+cycle → close+open reporting_line
                                    → audit row → (apply now or schedule)
                      recompute closure once for all affected subtrees
                      emit HierarchyChanged (batch)
```
Large batches run **async** (job + progress), returning a batch id; small batches are synchronous.

### 4.4 APIs

```
GET  /api/orgs/{org}/team/search?q=&department=&team=&project=&page=
GET  /api/orgs/{org}/team/hierarchy?rootId=          # org chart (scoped)
GET  /api/orgs/{org}/employees/{id}/reporting-history
POST /api/orgs/{org}/team/assignments                # single OR bulk
       body: { employeeIds[], changes:{ managerId?, hrId?, teamId?, departmentId?, projectIds? },
               effectiveFrom, reason }
POST /api/orgs/{org}/team/assignments/preview         # validate + return warnings, no write
PUT  /api/orgs/{org}/team/assignments/{id}            # correct a future-dated change
DELETE /api/orgs/{org}/team/assignments/{id}          # cancel a scheduled change
```
All: tenant-scoped, policy-protected (`team.manage`), scope-validated, audited, idempotent
(`Idempotency-Key` for bulk), paginated.

### 4.5 Real-time updates

- On `HierarchyChanged`, the API publishes to **SignalR/WebSocket** (`org:{tenant}:hierarchy`).
- Connected Team Management / org-chart clients patch the tree live; visibility caches invalidated.
- Future-dated changes fire when their effective date arrives (scheduled worker).

---

## 5. Security & data isolation

- **Tenant isolation:** every table carries `tenant_id`; EF global filter **+ Postgres RLS**
  (`USING (tenant_id = current_setting('app.tenant_id'))`). Cross-tenant only for Super Admin via an
  explicit tenant context + RLS-bypass role, **always audited**.
- **AuthZ:** permission policies (`team.manage`, `career.read`, …) + a `HierarchyScopeHandler` that
  resolves Self/Subtree/HrScope/Org/Platform and authorizes the target row(s).
- **History & audit:** `reporting_lines` (effective-dated) + append-only `audit_log` (before/after,
  effective date, reason, actor, `acting_as` for impersonation). Nothing is hard-deleted.
- **PII masking** by relationship distance (self > manager/HR > peer); output DTOs only.
- **Transport/at-rest** encryption; documents in object storage with signed URLs; secrets in vault.

---

## 6. Scalability

- **Closure table** for instant subtree reads; recompute only affected subtrees on change.
- **Cached visibility sets** per principal (Redis), invalidated on hierarchy/HR-assignment events.
- **Read replicas** for org-chart/reports; OLTP protected.
- **Partition** `audit_log` and time-series by tenant/month; index `reporting_lines (tenant, employee, effective_from)`.
- **Async bulk** ops with progress; per-tenant rate limits (noisy-neighbor).
- **Stateless API** + load balancer; SignalR backplane (Redis) for multi-instance real-time.

---

## 7. Mapping to current Yugma + build roadmap

**Have:** `TenantId` row filter + global query filter; MediatR CQRS; RowVersion concurrency; employees
with `manager` (string today); frontend `AuthService` roles; CRM policy security; career/projects/
performance/feedback features (mostly generated, some persisted).

**Build (recommended order):**
1. **Identity/RBAC persisted** + real JWT (tenant, roles[], permissions[], employeeId) — replace mock.
2. **Hierarchy model**: `departments`, `teams`, `reporting_lines` (effective-dated), `reporting_closure`,
   `hr_assignments`, `project_assignments`; migrate `employee.manager` string → `manager_id` FK + history.
3. **Visibility engine**: `visibleEmployeeIds` + `HierarchyScopeHandler`; cache + invalidation.
4. **Server-side AuthZ** on all HR/career endpoints (currently `AllowAnonymous`).
5. **Team Management APIs** (search, hierarchy, assignments, preview, bulk) + audit pipeline.
6. **Team Management UI** (org tree + table + drawer + bulk + effective dating + history).
7. **Postgres RLS**; **SignalR** real-time; **Super Admin** platform plane + tenant switcher.
8. Reports/analytics mart.

> Phases 1–3 unlock everything: real enforced RBAC + hierarchy visibility. The Team Management screen
> (5–6) then has a correct foundation to assign/change hierarchy safely.
```
