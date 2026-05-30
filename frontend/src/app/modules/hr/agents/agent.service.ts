import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export type AgentStage =
  | 'recruitment' | 'offer' | 'onboarding' | 'confirmation'
  | 'active'      | 'separation' | 'exit' | 'alumni';

export type AgentStatus = 'online' | 'idle' | 'error' | 'disabled';

export interface AgentInfo {
  id: string;
  key: string;
  stage: AgentStage;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  model: string;
  capability: string;
  enabled: boolean;
  status: AgentStatus;
  runs30d: number;
  successes30d: number;
  failures30d: number;
  lastRunAt: string | null;
  lastRunStatus: 'succeeded' | 'failed' | 'running' | null;
  avgLatencyMs: number;
  tokens30d: number;
}

export interface AgentRun {
  id: string;
  agentKey: string;
  agentName: string;
  stage: AgentStage;
  model: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  summary: string | null;
  output: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  triggeredBy: string | null;
  startedAt: string;
  completedAt: string | null;
  /** Immediate child runs when the agent orchestrated others. */
  steps?: AgentRunStep[];
}

export interface AgentRunStep {
  id: string;
  agentKey: string;
  agentName: string;
  model: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  summary: string | null;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentTraceNode {
  id: string;
  parentRunId: string | null;
  depth: number;
  agentKey: string;
  agentName: string;
  stage: AgentStage;
  model: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  summary: string | null;
  output: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentStats {
  agentCount: number;
  runs24h: number;
  runs30d: number;
  tokens30d: number;
  avgLatencyMs: number;
  perStage: { stage: AgentStage; count: number }[];
}

export interface AgentConfigPatch {
  model?: string;
  enabled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr/agents`;

  private readonly _agents = signal<AgentInfo[]>([]);
  private readonly _runs = signal<AgentRun[]>([]);
  private readonly _stats = signal<AgentStats | null>(null);
  private readonly _models = signal<string[]>([]);

  readonly agents = this._agents.asReadonly();
  readonly runs = this._runs.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly models = this._models.asReadonly();

  readonly stages: { key: AgentStage; label: string; emoji: string }[] = [
    { key: 'recruitment', label: 'Recruitment',    emoji: 'pi-search'           },
    { key: 'offer',       label: 'Offer',          emoji: 'pi-file-check'       },
    { key: 'onboarding',  label: 'Onboarding',     emoji: 'pi-user-plus'        },
    { key: 'confirmation',label: 'Confirmation',   emoji: 'pi-check-circle'     },
    { key: 'active',      label: 'Active employment', emoji: 'pi-bolt'          },
    { key: 'separation',  label: 'Separation',     emoji: 'pi-arrow-right-arrow-left' },
    { key: 'exit',        label: 'Exit clearance', emoji: 'pi-sign-out'         },
    { key: 'alumni',      label: 'Alumni',         emoji: 'pi-users'            }
  ];

  readonly agentsByStage = computed(() => {
    const map = new Map<AgentStage, AgentInfo[]>();
    for (const a of this._agents()) {
      const list = map.get(a.stage) ?? [];
      list.push(a);
      map.set(a.stage, list);
    }
    return this.stages.map((s) => ({ stage: s, agents: map.get(s.key) ?? [] }));
  });

  readonly health = computed(() => {
    const items = this._agents();
    return {
      online:   items.filter((a) => a.status === 'online').length,
      idle:     items.filter((a) => a.status === 'idle').length,
      error:    items.filter((a) => a.status === 'error').length,
      disabled: items.filter((a) => a.status === 'disabled').length
    };
  });

  refresh() {
    this.http.get<AgentInfo[]>(this.base).subscribe((rows) => this._agents.set(rows));
    this.http.get<AgentRun[]>(`${this.base}/runs`).subscribe((rows) => this._runs.set(rows));
    this.http.get<AgentStats>(`${this.base}/stats`).subscribe((s) => this._stats.set(s));
    if (this._models().length === 0) {
      this.http.get<string[]>(`${this.base}/models`).subscribe((m) => this._models.set(m));
    }
  }

  invoke(key: string, input?: string) {
    return this.http.post<AgentRun>(`${this.base}/${key}/invoke`, { input, triggeredBy: 'demo' }).pipe(
      tap((run) => {
        this._runs.update((list) => [run, ...list].slice(0, 50));
        this._agents.update((list) =>
          list.map((a) =>
            a.key === key
              ? {
                  ...a,
                  runs30d: a.runs30d + 1,
                  successes30d: a.successes30d + (run.status === 'succeeded' ? 1 : 0),
                  failures30d: a.failures30d + (run.status === 'failed' ? 1 : 0),
                  lastRunAt: run.startedAt,
                  lastRunStatus: run.status === 'failed' ? 'failed' : 'succeeded',
                  avgLatencyMs: run.latencyMs,
                  status: !a.enabled ? 'disabled' : run.status === 'failed' ? 'error' : 'online'
                }
              : a
          )
        );
      })
    );
  }

  fetchTrace(runId: string): Observable<AgentTraceNode[]> {
    return this.http.get<AgentTraceNode[]>(`${this.base}/runs/${runId}/trace`);
  }

  updateConfig(key: string, patch: AgentConfigPatch): Observable<{ id: string; key: string; model: string; enabled: boolean }> {
    return this.http
      .put<{ id: string; key: string; model: string; enabled: boolean }>(`${this.base}/${key}/config`, patch)
      .pipe(
        tap((res) => {
          this._agents.update((list) =>
            list.map((a) => {
              if (a.key !== key) return a;
              const enabled = res.enabled;
              let nextStatus: AgentStatus;
              if (!enabled) nextStatus = 'disabled';
              else if (a.lastRunStatus === 'failed') nextStatus = 'error';
              else if (a.successes30d > 0) nextStatus = 'online';
              else nextStatus = 'idle';
              return { ...a, model: res.model, enabled, status: nextStatus };
            })
          );
        })
      );
  }
}
