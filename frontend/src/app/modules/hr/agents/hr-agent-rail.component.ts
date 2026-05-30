import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { AgentInfo, AgentRun, AgentService, AgentStage, AgentStatus } from './agent.service';

/**
 * Drop-in horizontal "agent strip" for any HR module page.
 * Pass either a `stage` to show all agents in that lifecycle stage, or an explicit
 * `keys` array to pin specific agents to this page.
 */
@Component({
  selector: 'app-hr-agent-rail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    TextareaModule,
    TooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleAgents().length) {
      <!-- ===== Strip ===== -->
      <div class="relative rounded-2xl overflow-hidden mb-5"
           style="background: linear-gradient(135deg, rgba(99,102,241,0.10), rgba(168,85,247,0.08) 50%, rgba(236,72,153,0.10));">
        <!-- holographic border -->
        <div class="absolute inset-0 rounded-2xl pointer-events-none"
             style="padding: 1px;
                    background: linear-gradient(135deg, rgba(99,102,241,0.6), rgba(168,85,247,0.5), rgba(236,72,153,0.6));
                    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                    -webkit-mask-composite: xor; mask-composite: exclude;"></div>

        <div class="relative p-4 flex items-start gap-4 flex-wrap">
          <div class="flex items-center gap-2 shrink-0 mt-1">
            <span class="relative inline-flex w-7 h-7 rounded-xl grid place-items-center bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
              <i class="pi pi-sparkles text-xs"></i>
              <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-surface-950"></span>
            </span>
            <div class="leading-tight">
              <div class="text-[10px] uppercase tracking-[0.18em] font-semibold text-indigo-700 dark:text-indigo-300">
                Yugma agents · {{ stageTitle() }}
              </div>
              <a routerLink="/hr/agents" class="text-xs text-surface-500 hover:text-indigo-500 inline-flex items-center gap-1">
                Open Agent Hub <i class="pi pi-arrow-up-right text-[10px]"></i>
              </a>
            </div>
          </div>

          <div class="flex-1 min-w-0 flex flex-wrap gap-2">
            @for (a of visibleAgents(); track a.id) {
              <button
                type="button"
                class="group relative inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border bg-white/85 dark:bg-surface-900/70 backdrop-blur transition shadow-sm"
                [ngClass]="{
                  'border-surface-200 dark:border-surface-700 hover:border-indigo-300 dark:hover:border-indigo-500/50': a.enabled,
                  'border-surface-200 dark:border-surface-800 opacity-60': !a.enabled
                }"
                [disabled]="!a.enabled"
                (click)="openAgent(a)"
              >
                <span class="relative w-7 h-7 rounded-lg grid place-items-center shrink-0" [ngClass]="bubble(a.stage)">
                  <i class="pi {{ a.icon }} text-xs"></i>
                  <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-surface-900" [ngClass]="statusBg(a.status)"></span>
                </span>
                <span class="text-xs font-medium leading-tight text-surface-800 dark:text-surface-100">{{ a.name }}</span>
                @if (isOrchestrator(a.key)) {
                  <span class="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white inline-flex items-center gap-1" pTooltip="Calls multiple agents">
                    <i class="pi pi-sitemap text-[8px]"></i>multi-step
                  </span>
                }
                <span class="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">{{ a.model }}</span>
                <i class="pi pi-bolt text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition"></i>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- ===== Run dialog ===== -->
      <p-dialog [(visible)]="dialogOpen" [modal]="true" [draggable]="false" [style]="{ width: '680px', 'max-width': '95vw' }" [showHeader]="false" [dismissableMask]="false">
        @if (activeAgent(); as a) {
          <div class="relative overflow-hidden rounded-t-2xl">
            <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 opacity-95"></div>
            <div class="relative flex items-start justify-between gap-3 p-5 text-white">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-11 h-11 rounded-2xl grid place-items-center bg-white/15 backdrop-blur shrink-0">
                  <i class="pi {{ a.icon }} text-lg"></i>
                </span>
                <div class="min-w-0">
                  <div class="text-[11px] uppercase tracking-wider opacity-80">{{ a.stage }} · agent</div>
                  <h3 class="font-semibold text-lg leading-tight truncate">{{ a.name }}</h3>
                  <div class="text-[11px] mt-1 opacity-90 inline-flex items-center gap-2">
                    <span class="inline-flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-2 py-0.5">
                      <i class="pi pi-bolt text-[10px]"></i>{{ a.model }}
                    </span>
                    <span class="opacity-80">{{ a.capability }}</span>
                  </div>
                </div>
              </div>
              <button pButton [text]="true" rounded icon="pi pi-times" class="!text-white" (click)="dialogOpen = false"></button>
            </div>
          </div>

          <div class="p-5 space-y-4">
            <p class="text-sm text-surface-600 dark:text-surface-300">{{ a.description }}</p>

            <div>
              <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Optional input</label>
              <textarea pTextarea [(ngModel)]="input" rows="3" class="w-full !rounded-lg" [placeholder]="defaultPlaceholder()"></textarea>
            </div>

            @if (lastRun()?.steps?.length) {
              <div class="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-500/5 overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2 border-b border-amber-200 dark:border-amber-700/50">
                  <i class="pi pi-sitemap text-amber-600 dark:text-amber-400"></i>
                  <span class="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Orchestrated {{ lastRun()!.steps!.length }} agent call{{ lastRun()!.steps!.length === 1 ? '' : 's' }}
                  </span>
                </div>
                <ol class="p-3 space-y-2">
                  @for (s of lastRun()!.steps!; track s.id; let i = $index) {
                    <li class="flex items-start gap-3">
                      <span class="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 mt-0.5"
                        [ngClass]="s.status === 'succeeded' ? 'bg-emerald-500 text-white'
                                  : s.status === 'failed' ? 'bg-rose-500 text-white'
                                  : 'bg-amber-500 text-white'">{{ i + 1 }}</span>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 text-sm font-medium flex-wrap">
                          <span class="truncate">{{ s.agentName }}</span>
                          <span class="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">{{ s.model }}</span>
                          @if (s.status !== 'succeeded') {
                            <span class="text-[10px] px-1.5 py-0.5 rounded"
                                  [ngClass]="s.status === 'failed' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">
                              {{ s.status }}
                            </span>
                          }
                        </div>
                        <div class="text-xs text-surface-600 dark:text-surface-300 mt-0.5">{{ s.summary || s.agentKey }}</div>
                        <div class="text-[11px] text-surface-400 mt-0.5 inline-flex items-center gap-2">
                          <span>{{ s.latencyMs }} ms</span>
                          <span>·</span>
                          <span>{{ s.tokensIn + s.tokensOut | number }} tok</span>
                        </div>
                      </div>
                    </li>
                  }
                </ol>
              </div>
            }

            <div class="rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
              <div class="flex items-center gap-2 px-3 py-2 bg-surface-50 dark:bg-surface-950/40 border-b border-surface-200 dark:border-surface-800">
                <i class="pi pi-bolt text-indigo-500"></i>
                <span class="text-xs font-semibold uppercase tracking-wider text-surface-500">Agent output</span>
                @if (running()) {
                  <span class="text-[11px] text-indigo-500 inline-flex items-center gap-1 ml-auto"><i class="pi pi-spin pi-spinner"></i>thinking…</span>
                } @else if (lastRun()) {
                  <span class="ml-auto text-[11px] text-surface-500 inline-flex items-center gap-3">
                    <span>{{ lastRun()!.latencyMs }} ms</span>
                    <span>{{ lastRun()!.tokensIn + lastRun()!.tokensOut | number }} tokens</span>
                  </span>
                }
              </div>
              <div class="p-4 bg-white dark:bg-surface-900 min-h-[160px] max-h-[300px] overflow-y-auto">
                @if (running()) {
                  <div class="space-y-2">
                    @for (_ of [1,2,3]; track $index) {
                      <div class="h-3 rounded bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100 dark:from-surface-800 dark:via-surface-700 dark:to-surface-800 animate-pulse"></div>
                    }
                  </div>
                } @else if (lastRun()?.output) {
                  <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-surface-800 dark:text-surface-100">{{ lastRun()!.output }}</pre>
                } @else {
                  <div class="text-center text-sm text-surface-500 py-6">
                    <i class="pi pi-sparkles text-2xl text-indigo-300"></i>
                    <div class="mt-2">Press <span class="font-medium">Run agent</span> to invoke {{ a.name }}.</div>
                  </div>
                }
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 border-t border-surface-200 dark:border-surface-800 pt-4">
              <div class="text-[11px] text-surface-500"><i class="pi pi-info-circle mr-1"></i>Runs are logged in the Agent Hub &amp; audit trail.</div>
              <div class="flex items-center gap-2">
                @if (lastRun()?.status === 'succeeded') {
                  <button pButton severity="secondary" [outlined]="true" icon="pi pi-times" label="Dismiss" (click)="dialogOpen = false"></button>
                  <button pButton icon="pi pi-check" label="Apply" class="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700" (click)="apply()"></button>
                } @else {
                  <button pButton severity="secondary" [outlined]="true" label="Close" (click)="dialogOpen = false"></button>
                  <button pButton icon="pi pi-bolt" label="Run agent" [loading]="running()" class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-700" (click)="run()"></button>
                }
              </div>
            </div>
          </div>
        }
      </p-dialog>
    }
  `,
  styles: [`:host { display: block; }`]
})
export class HrAgentRailComponent {
  /** Filter by lifecycle stage (e.g. 'recruitment', 'active'). */
  readonly stage = input<AgentStage | null>(null);
  /** Or pin specific agents by key, in display order. */
  readonly keys = input<string[] | null>(null);
  /** Optional custom title for the rail eyebrow. Defaults to stage label. */
  readonly title = input<string | null>(null);

  protected readonly svc = inject(AgentService);
  private readonly messages = inject(MessageService);

  protected dialogOpen = false;
  protected input = '';
  protected readonly activeAgent = signal<AgentInfo | null>(null);
  protected readonly running = signal(false);
  protected readonly lastRun = signal<AgentRun | null>(null);

  protected readonly visibleAgents = computed<AgentInfo[]>(() => {
    const all = this.svc.agents();
    if (!all.length) return [];
    const k = this.keys();
    if (k && k.length) {
      const map = new Map(all.map((a) => [a.key, a]));
      return k.map((key) => map.get(key)).filter((a): a is AgentInfo => !!a);
    }
    const s = this.stage();
    return s ? all.filter((a) => a.stage === s) : [];
  });

  protected readonly stageTitle = computed(() => {
    if (this.title()) return this.title()!;
    const s = this.stage();
    if (s) return this.svc.stages.find((x) => x.key === s)?.label ?? s;
    return 'Suggested agents';
  });

  constructor() {
    // Service caches; first refresh from anywhere populates all rails.
    if (this.svc.agents().length === 0) this.svc.refresh();
  }

  protected isOrchestrator(key: string): boolean {
    return key.endsWith('.pipeline')
        || key.endsWith('.orchestrator')
        || key === 'confirmation.decision'
        || key === 'separation.action_plan';
  }

  protected bubble(s: AgentStage): string {
    return ({
      recruitment:  'bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-300',
      offer:        'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300',
      onboarding:   'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      confirmation: 'bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300',
      active:       'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
      separation:   'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300',
      exit:         'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300',
      alumni:       'bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300'
    } as Record<AgentStage, string>)[s];
  }
  protected statusBg(s: AgentStatus): string {
    return ({
      online:   'bg-emerald-500',
      idle:     'bg-amber-400',
      error:    'bg-rose-500',
      disabled: 'bg-surface-400 dark:bg-surface-500'
    } as Record<AgentStatus, string>)[s];
  }

  protected openAgent(a: AgentInfo) {
    if (!a.enabled) return;
    this.activeAgent.set(a);
    this.input = '';
    this.lastRun.set(null);
    this.dialogOpen = true;
  }

  protected defaultPlaceholder() {
    const a = this.activeAgent();
    if (!a) return '';
    return ({
      recruitment: 'Role brief, must-haves, location…',
      offer:       'Candidate level, base offer, location…',
      onboarding:  'New hire context (role, team, manager)…',
      confirmation:'Probation cycle, sample feedback…',
      active:      'Question, employee, or date range…',
      separation:  'Employee + signals to consider…',
      exit:        'Exit transcript or asset list…',
      alumni:      'Alumnus name + last role…'
    } as Record<AgentStage, string>)[a.stage] ?? '';
  }

  protected run() {
    const a = this.activeAgent();
    if (!a) return;
    this.running.set(true);
    this.svc.invoke(a.key, this.input.trim() || undefined).subscribe({
      next: (run) => { this.running.set(false); this.lastRun.set(run); },
      error: () => {
        this.running.set(false);
        this.messages.add({ severity: 'error', summary: 'Agent failed', detail: 'Could not run. Check API logs.' });
      }
    });
  }

  protected apply() {
    const a = this.activeAgent();
    this.messages.add({
      severity: 'success',
      summary: 'Suggestion applied',
      detail: `${a?.name}'s output is queued for action.`
    });
    this.dialogOpen = false;
  }
}
