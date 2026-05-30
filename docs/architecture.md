# Clean Architecture

The backend follows Robert C. Martin's Clean Architecture: dependencies point **inward** only. The Domain knows nothing about EF, ASP.NET, or any framework — it's pure C#.

```
┌────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION                          │
│  Yugma.Crm.Api  →  Controllers, middleware, OpenAPI, JWT bearer     │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ uses
┌──────────────────────▼─────────────────────────────────────────────┐
│                            APPLICATION                             │
│  Yugma.Crm.Application  →  CQRS handlers, validators, DTOs,         │
│                            MediatR pipeline (logging, validation)  │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ uses                                ▲
                       │                                     │ implements
┌──────────────────────▼─────────────────────────────────────┴───────┐
│                              DOMAIN                                │
│  Yugma.Crm.Domain  →  Entities, aggregates, value objects,          │
│                       domain events, repository interfaces         │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ depends on
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                              │
│  Yugma.Crm.Infrastructure  →  EF Core DbContext, repositories,      │
│                              JWT issuance, tenant resolution,      │
│                              email/SMS/storage providers           │
└────────────────────────────────────────────────────────────────────┘
```

## Project responsibilities

### Domain (`Yugma.Crm.Domain`)
- **Entities & aggregates** (`Employee`, `Invoice`, `PurchaseOrder` …) inheriting `Entity<TId>` and `IAggregateRoot`
- **Value objects** (`PersonName`, `Email`, `PhoneNumber`) — immutable, equality by value
- **Domain events** (`EmployeeCreated`, `EmployeeStatusChanged`) raised inside the aggregate
- **Repository interfaces** (`IEmployeeRepository`) — the **interface** lives in Domain, the implementation in Infrastructure
- **Abstractions** (`IUnitOfWork`, `ITenantContext`, `IClock`) — boundaries to the outside world

**Rule:** zero NuGet references except for utilities. No EF, no ASP.NET, no MediatR.

### Application (`Yugma.Crm.Application`)
- **Commands** (state-changing, return `Result<T>`): `CreateEmployeeCommand`, `UpdateEmployeeCommand`, `ChangeEmployeeStatusCommand`
- **Queries** (read-only, return DTOs): `GetEmployeeByIdQuery`, `ListEmployeesQuery`
- **DTOs** and **mapping**: explicit, no AutoMapper unless complexity demands it
- **Validators** (FluentValidation): one per command/query, runs in the MediatR pipeline
- **Pipeline behaviors**: `LoggingBehavior`, `ValidationBehavior` (extend with `TransactionBehavior`, `CachingBehavior`)

**Rule:** depends on Domain and Shared only.

### Infrastructure (`Yugma.Crm.Infrastructure`)
- **Persistence**: `YugmaDbContext`, `IEntityTypeConfiguration<T>` per aggregate, repository implementations
- **Identity/Auth**: `JwtTokenService`, `HttpTenantContext`, BCrypt password hashing
- **External providers** (email, SMS, S3, AI): adapters that implement Application abstractions
- **Multi-tenancy**: global query filters in `YugmaDbContext` driven by `ITenantContext`

### API (`Yugma.Crm.Api`)
- **Controllers**: thin shells that dispatch to MediatR and translate `Result<T>` to HTTP status codes
- **Middleware**: global exception handling → RFC 7807 problem-details
- **Composition root**: `Program.cs` wires `AddApplication()` + `AddInfrastructure(config)`
- **Cross-cutting**: CORS, Serilog request logging, Swagger, JWT bearer auth

### Shared (`Yugma.Crm.Shared`)
- `Result` / `Error` discriminated outcome type
- `PagedResult<T>` / `PageRequest`
- Anything pure that both Application and Infrastructure need

## SOLID applied

- **S** — Each MediatR handler does one thing. Controllers do not orchestrate business logic.
- **O** — New features arrive as new handlers without modifying existing ones.
- **L** — Repository interfaces in Domain; any storage tech can substitute (EF, Dapper, in-memory tests).
- **I** — Tight, per-aggregate repository interfaces — not a giant `IGenericRepository`.
- **D** — Domain depends on no implementation; Infrastructure implements Domain abstractions.

## Request lifecycle

```
HTTP request
   │
   ▼
[Middleware: exception, auth, CORS]
   │
   ▼
Controller  ──►  IMediator.Send(Command)
                      │
                      ▼
              ValidationBehavior  ──► fails → throws ValidationException → middleware → 400
                      │ passes
                      ▼
                LoggingBehavior
                      │
                      ▼
              CommandHandler
                ├─ load aggregate via IRepository
                ├─ mutate aggregate (raises domain events)
                ├─ IUnitOfWork.SaveChangesAsync → YugmaDbContext.SaveChangesAsync
                └─ return Result<DTO>
                      │
                      ▼
Controller maps Result → 200/201/400/404/409
```
