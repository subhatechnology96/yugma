# How to add a new module end-to-end

This is the recipe used to build the **Employee** feature. Use it as a template for any new aggregate (Invoice, Vendor, PurchaseOrder, …).

## 1) Domain — the aggregate (Yugma.Crm.Domain)

```
src/Yugma.Crm.Domain/<Bounded-Context>/
├── <Aggregate>.cs                # inherits Entity<Guid>, IAggregateRoot
├── ValueObjects/
│   └── <Vo>.cs                   # inherits ValueObject
├── Events/
│   └── <Aggregate>Events.cs      # records inheriting DomainEvent
└── I<Aggregate>Repository.cs     # tight, aggregate-specific interface
```

Pin the **invariants** into the aggregate's static `Create` factory and behaviour methods (no public setters).

## 2) Application — commands, queries, validators (Yugma.Crm.Application)

```
src/Yugma.Crm.Application/<Bounded-Context>/<Aggregates>/
├── <Aggregate>Dto.cs
├── <Aggregate>Mapping.cs
├── Commands/
│   ├── Create<Aggregate>.cs      # IRequest + IRequestHandler + Validator
│   ├── Update<Aggregate>.cs
│   └── …
└── Queries/
    ├── Get<Aggregate>ById.cs
    └── List<Aggregates>.cs
```

Handlers receive `I<Aggregate>Repository` and `IUnitOfWork` via DI. Return `Result<T>`.

## 3) Infrastructure — persistence (Yugma.Crm.Infrastructure)

```
src/Yugma.Crm.Infrastructure/Persistence/
├── Configurations/<Aggregate>Configuration.cs   # IEntityTypeConfiguration<T>
└── Repositories/<Aggregate>Repository.cs        # implements interface
```

Then register the repository in `Infrastructure.DependencyInjection.AddInfrastructure`:

```csharp
services.AddScoped<I<Aggregate>Repository, <Aggregate>Repository>();
```

Add the `DbSet` to `YugmaDbContext` and generate the migration:

```powershell
dotnet ef migrations add Add<Aggregate> --project src/Yugma.Crm.Infrastructure --startup-project src/Yugma.Crm.Api
dotnet ef database update --project src/Yugma.Crm.Infrastructure --startup-project src/Yugma.Crm.Api
```

## 4) API — controller (Yugma.Crm.Api)

```csharp
[ApiController]
[Route("api/<area>/<plural>")]
[Authorize]
public sealed class <Plural>Controller(ISender mediator) : ControllerBase { … }
```

Translate `Result<T>.Error.Type` to HTTP status codes (200/201/400/404/409).

## 5) Frontend — Angular feature module

```
src/app/modules/<feature>/
├── <feature>.routes.ts            # lazy routes for list / new / :id
├── models/<entity>.models.ts
├── services/<entity>.service.ts   # signal store + HttpClient
└── <entity-name>/
    ├── <entity>-list.component.ts/html
    ├── <entity>-form.component.ts
    └── <entity>-detail.component.ts
```

Register:

- The lazy route in `app.routes.ts`
- A nav entry in `layout/nav-items.ts`

## 6) AuthZ — gate the routes

Add `permissionGuard('<area>.<entity>.read')` (and `.write`, `.admin`) to feature routes and stamp the corresponding `permission` claims into JWTs.

## 7) Tests — the minimum viable pyramid

- **Domain tests** (xUnit) for invariants in `Create`/behaviour methods — no mocks needed.
- **Handler tests** (xUnit + NSubstitute) for commands/queries against `Mock<IRepository>` and an in-memory `IUnitOfWork`.
- **Integration tests** (`WebApplicationFactory<Program>` + `Testcontainers.PostgreSQL`) for the HTTP surface.
- **Frontend** unit tests for services (mock `HttpClient`) and component smoke tests with `TestBed`.
