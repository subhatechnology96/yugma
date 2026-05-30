# Diagrams

ASCII / Mermaid diagrams. Paste any block into <https://mermaid.live> to render.

## Solution map

```mermaid
flowchart LR
  subgraph FE["Angular 21 (frontend)"]
    AC[AuthComponents] --> AS[AuthService]
    DS[Dashboard / HR / Accounts / …] --> HS[HttpClient + Interceptors]
    HS --> AS
  end

  subgraph API["Yugma.Crm.Api (.NET 9)"]
    CT[Controllers] --> ME[MediatR]
  end

  subgraph APP["Yugma.Crm.Application"]
    H[Command/Query Handlers]
    V[FluentValidation]
    B[Pipeline Behaviors]
  end

  subgraph DOM["Yugma.Crm.Domain"]
    EN[Entities + ValueObjects]
    DE[DomainEvents]
    IR[IRepositories]
  end

  subgraph INF["Yugma.Crm.Infrastructure"]
    EF[YugmaDbContext]
    RP[Repositories]
    JW[JwtTokenService]
  end

  PG[(PostgreSQL)]

  FE -- HTTPS + JWT --> API
  ME --> H
  H --> IR
  RP -. implements .-> IR
  EF -- maps --> EN
  RP --> EF
  EF --> PG
```

## Tenant request

```mermaid
sequenceDiagram
  participant U as User (Angular)
  participant FE as Angular App
  participant API as ASP.NET Core
  participant Auth as JwtBearer
  participant Tenant as ITenantContext
  participant H as Handler
  participant DB as PostgreSQL

  U->>FE: clicks "Save employee"
  FE->>FE: authInterceptor adds Bearer
  FE->>FE: tenantInterceptor adds X-Tenant-Id
  FE->>API: POST /api/hr/employees
  API->>Auth: validate token
  Auth->>Tenant: TenantId from claim
  API->>H: Send(CreateEmployeeCommand)
  H->>DB: INSERT with tenant_id (global filter)
  DB-->>H: row
  H-->>API: Result<EmployeeDto>
  API-->>FE: 201 Created
```

## Workflow lifecycle

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted: submit()
  Submitted --> ManagerApproval
  ManagerApproval --> FinanceReview: approved & amount>50k
  ManagerApproval --> Issued: approved & amount<=50k
  ManagerApproval --> Rejected: reject()
  FinanceReview --> CFOApproval: amount>3L
  FinanceReview --> Issued: amount<=3L
  CFOApproval --> Issued: approved
  CFOApproval --> Escalated: SLA breach
  Escalated --> Issued: CEO approves
  Rejected --> [*]
  Issued --> [*]
```

## Frontend route tree

```mermaid
flowchart TB
  R[/] --> A[/auth]
  A --> Login[login]
  A --> Reg[register]
  A --> Fp[forgot]
  A --> Otp[otp]
  A --> Mfa[mfa]
  R --> Shell[AppShell (guard: auth)]
  Shell --> D[/dashboard]
  Shell --> HR[/hr]
  HR --> Emps[/employees]
  Emps --> EmpsNew[/new]
  Emps --> EmpDet[/:id]
  HR --> Att[/attendance]
  HR --> Lv[/leave]
  HR --> Pr[/payroll]
  HR --> Rc[/recruitment]
  HR --> Pf[/performance]
  HR --> HrA[/analytics]
  Shell --> Acc[/accounts]
  Shell --> Mat[/material]
  Shell --> Wf[/workflow]
  Shell --> Rep[/reports]
  Shell --> Not[/notifications]
  Shell --> Us[/users]
  Shell --> Cfg[/configuration]
  Shell --> Au[/audit]
  Shell --> AI[/ai-assistant]
  Shell --> St[/settings]
```
