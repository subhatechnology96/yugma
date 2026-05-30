# Frontend folder structure

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── index.html
│   ├── main.ts                       # bootstrapApplication(AppComponent, appConfig)
│   ├── styles.scss                   # Tailwind layers + global component classes
│   ├── environments/                 # environment.ts, environment.prod.ts
│   └── app/
│       ├── app.component.ts          # router-outlet + global Toast/ConfirmDialog
│       ├── app.config.ts             # providers: router, http, primeng, animations
│       ├── app.routes.ts             # top-level lazy routes + auth/guest guards
│       │
│       ├── core/                     # cross-feature singletons — only imported once
│       │   ├── guards/               # authGuard, guestGuard, permissionGuard
│       │   ├── interceptors/         # auth, tenant, error
│       │   ├── models/               # api & auth types (no UI)
│       │   └── services/             # AuthService, ThemeService, TenantService, NotificationService
│       │
│       ├── shared/                   # dumb, reusable UI — no business logic
│       │   └── components/
│       │       ├── avatar/
│       │       ├── empty-state/
│       │       ├── kpi-card/
│       │       ├── not-found/
│       │       ├── page-header/
│       │       └── status-pill/
│       │
│       ├── layout/                   # app chrome (sidebar, topbar, AI widget)
│       │   ├── app-shell/
│       │   ├── ai-widget/
│       │   ├── nav-items.ts
│       │   ├── sidebar/
│       │   └── topbar/
│       │
│       └── modules/                  # feature modules (one folder per route)
│           ├── auth/                 # login, register, forgot, otp, mfa + AuthShell
│           ├── dashboard/
│           ├── hr/                   # employees, attendance, leave, payroll, recruitment, performance, analytics
│           ├── accounts/
│           ├── material/
│           ├── workflow/
│           ├── reports/
│           ├── notifications/
│           ├── users/
│           ├── configuration/
│           ├── audit/
│           ├── ai-assistant/
│           └── settings/
├── angular.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.app.json
└── tsconfig.json
```

## Conventions

| Rule | Why |
|---|---|
| All components are **standalone** + `ChangeDetectionStrategy.OnPush` | Tree-shakable, fast change detection |
| Feature modules are **lazy-loaded** via `loadComponent`/`loadChildren` | Smaller initial bundle |
| Path aliases: `@core/*`, `@shared/*`, `@layout/*`, `@modules/*`, `@env/*` | Stable imports as files move |
| State via **Angular signals**, store-like services live next to the feature | Avoids premature NgRx complexity |
| **HttpClient** with three functional interceptors — `auth`, `tenant`, `error` | Auth headers, tenant scoping, global error UX |
| Tailwind + PrimeNG `Aura` preset; dark mode toggled via the `.app-dark` class | Aligns the two style systems through `tailwindcss-primeui` |
| Forms use **typed Reactive Forms** (`fb.nonNullable.group`) with **FluentValidation-mirrored** rules | Single source of truth between FE/BE shapes |

## Adding a new feature module — 5-step recipe

1. **Route** — register `modules/<feature>/<feature>.routes.ts` and `loadChildren` from `app.routes.ts`.
2. **Service** — `modules/<feature>/services/<entity>.service.ts` with signal-based store and `HttpClient` calls.
3. **List + detail + form** — copy the pattern from `modules/hr/employees`.
4. **Shared bits** — reuse `page-header`, `kpi-card`, `status-pill`, `avatar`, `empty-state`.
5. **Nav** — add an entry in `layout/nav-items.ts`.

## Notes on PrimeNG + Tailwind

Both libraries control styling. `tailwindcss-primeui` plugin maps Tailwind colour utilities (`bg-primary-500`) to PrimeNG CSS variables so they share a palette. PrimeNG's `cssLayer` is configured in `app.config.ts` to order CSS as:

```
tailwind-base, primeng, tailwind-utilities
```

so utility classes (the ones starting with `!`) override PrimeNG component defaults — that's why you see `!rounded-lg` sprinkled in templates.
