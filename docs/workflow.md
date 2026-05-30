# Workflow engine

The workflow engine drives multi-step approvals across modules: Purchase Orders, leave requests, vendor onboarding, expenses, employee changes, and any custom flow.

## Concepts

| Term | Meaning |
|---|---|
| **Process definition** | The template — a directed graph of stages with conditions and SLAs. |
| **Process instance** | A live execution of a definition against a specific resource (e.g. `PO-7782`). |
| **Stage** | A node — `manual_approval`, `auto_route`, `notify`, `wait`, `webhook`. |
| **Actor** | Who must act — user, role, position-relative-to-requester (`manager+1`), or service. |
| **Transition** | An edge with an optional guard expression (JSON path / scriptable). |
| **SLA** | Per-stage time-to-action; on breach → escalate or auto-decide. |

## Reference flow — Purchase Order approval

```
[ Requester ]                          (PO submitted)
       │
       ▼
[ Manager approval ]                   (actor = manager+1)
       │ if amount > ₹50,000
       ▼
[ Finance review ]                     (actor = role:finance)
       │ if amount > ₹3,00,000
       ▼
[ CFO approval ]                       (actor = role:cfo, SLA 24h)
       │ on breach → escalate to CEO
       ▼
[ Vendor notification ]                (auto, via email/webhook)
       │
       ▼
[ PO issued ]
```

The visual stepper at `/workflow` renders this exact shape.

## Data model (PostgreSQL)

```sql
-- Templates
CREATE TABLE yugma.workflow_definitions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  code text NOT NULL,                 -- 'po-approval'
  name text NOT NULL,
  version int NOT NULL,
  spec jsonb NOT NULL,                -- stages, transitions, guards, SLAs
  is_active boolean NOT NULL,
  UNIQUE (tenant_id, code, version)
);

-- Instances
CREATE TABLE yugma.workflow_instances (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES yugma.workflow_definitions(id),
  resource_type text NOT NULL,         -- 'purchase_order'
  resource_id uuid NOT NULL,
  status text NOT NULL,                -- running | completed | rejected | cancelled
  current_stage text,                  -- references stage id in spec
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);

-- Stage history (immutable, append-only)
CREATE TABLE yugma.workflow_stage_events (
  id bigserial PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES yugma.workflow_instances(id),
  stage text NOT NULL,
  event text NOT NULL,                 -- entered | approved | rejected | escalated | timed_out
  actor text,
  comment text,
  at timestamptz NOT NULL,
  payload jsonb
);
```

## Execution

- Domain layer raises an integration event (`PurchaseOrderSubmitted`).
- The workflow engine subscribes, instantiates the right definition, advances stages on `Approve` / `Reject` / `Escalate` commands.
- Long-running work (waits, SLAs, retries) moves to **Hangfire** or **Azure Durable Functions** — the in-process engine remains the source of truth for *current state*.
- All actions append to `workflow_stage_events`, which feeds the **Audit Logs** screen.

## Notifications

Each stage transition fires a notification through:

- In-app (the bell icon, fed by `NotificationService`)
- Email (`IEmailService`)
- Slack / Teams / WhatsApp via webhook adapters

## Custom flows

Admins build flows from the **Configuration → Approval policies** screen — the spec is serialized JSON and stored as a new `workflow_definitions` row (incremented `version`). Existing running instances continue under the old version; new instances pick up the latest active version.
