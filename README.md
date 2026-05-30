# Yugma

A modern, multi-tenant SaaS CRM/ERP platform built on **Angular 21** (PrimeNG + Tailwind) and **.NET 9** with **Clean Architecture + CQRS** on **PostgreSQL**.

```
d:/Sanjay/CRM
├── frontend/   Angular 21 application (standalone components, signals)
├── backend/    .NET 9 solution (Clean Architecture: Domain → Application → Infrastructure → API)
└── docs/       Architecture diagrams, ADRs, extension guides
```

## What is built

**Frontend (Angular 21):**
- Layout shell with collapsible sidebar, top bar (global search, tenant switcher, notifications, theme toggle, profile, AI assistant)
- Dashboard with KPI cards, revenue/headcount/inventory charts, approvals queue, activity timeline, calendar, AI insights
- Full HR module: Employees (list with filters + sorting + pagination, detail, create), Attendance, Leave (with approval), Payroll (with cycle stepper), Recruitment (kanban), Performance, HR Analytics
- Stubs for Accounts, Material Management, Workflows (with approval-chain visualizer), Reports, Notifications, User Management, Configuration, Audit Logs, AI Assistant, Settings
- Full authentication flow screens: Login, Register, Forgot password, OTP verification, MFA verification
- Core infrastructure: auth/tenant/error HTTP interceptors, route guards (auth, guest, permission), theme service (light/dark/system), tenant service, signal-based state
- Shared UI library: page-header, kpi-card, status-pill, avatar, empty-state, not-found

**Backend (.NET 9):**
- 5-project Clean Architecture solution (Domain, Application, Infrastructure, Api, Shared)
- Employee aggregate with value objects (PersonName, Email, PhoneNumber), domain events
- MediatR-based CQRS with FluentValidation pipeline behavior and request logging behavior
- Multi-tenant EF Core (`YugmaDbContext` with global tenant query filters, JSON/array conversion for skills)
- JWT-based authentication issuer (BCrypt-ready password verification stub)
- Tenant resolution: JWT claim → `X-Tenant-Id` header → dev default
- Swagger + Serilog + problem-details error middleware
- Full CRUD for `Employee`: `GET /api/hr/employees`, `GET /{id}`, `POST`, `PUT /{id}`, `POST /{id}/status`

## Get started

### Frontend
```powershell
cd d:\Sanjay\CRM\frontend
npm install
npm start
# → http://localhost:4200
```

The frontend ships with mocked services so it runs without a backend. Sign in with any email + password to access the app.

### Backend
```powershell
cd d:\Sanjay\CRM\backend
# 1) Make sure PostgreSQL is running, then update appsettings.json connection string
# 2) Initialize the database
dotnet ef migrations add Init --project src/Yugma.Crm.Infrastructure --startup-project src/Yugma.Crm.Api
dotnet ef database update --project src/Yugma.Crm.Infrastructure --startup-project src/Yugma.Crm.Api
# 3) Run
dotnet run --project src/Yugma.Crm.Api
# → https://localhost:7148/swagger
```

> **Secret management:** before deploying, replace the `Jwt:Secret` in `appsettings.json` with a 32+ character value from User Secrets / Azure Key Vault / AWS Secrets Manager:
> ```powershell
> dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)" --project src/Yugma.Crm.Api
> ```

## Docs

- [Clean Architecture overview](docs/architecture.md)
- [Multi-layer architecture diagram](docs/multi-layer.md)
- [Frontend folder structure](docs/frontend.md)
- [How to add a new module](docs/extend.md)
- [Workflow engine model](docs/workflow.md)

## Tech stack

| Layer | Choices |
|------|--------|
| UI | Angular 21 standalone components, signals, PrimeNG 18 (Aura preset), Tailwind 3.4 |
| State | Angular signals + service-as-store; ready to swap in NgRx Signals where needed |
| Charts | Chart.js via `primeng/chart` |
| API client | `HttpClient` with auth + tenant + error interceptors |
| Server | ASP.NET Core 9 minimal hosting, Controllers, MediatR 12 |
| Validation | FluentValidation pipeline behavior |
| Persistence | EF Core 9 + Npgsql, owned value objects, row-version optimistic concurrency |
| Identity | JWT bearer (HS256), BCrypt password hashing, OAuth2-ready, phone OTP + MFA flows |
| Observability | Serilog console (extend to OpenTelemetry / Seq / Datadog) |
| Docs | Swashbuckle/Swagger UI |
