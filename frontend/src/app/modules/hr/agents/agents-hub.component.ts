import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  AgentInfo,
  AgentRun,
  AgentService,
  AgentStage,
  AgentStatus
} from './agent.service';

type ViewMode = 'cards' | 'health';

@Component({
  selector: 'app-agents-hub',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    FormsModule,
    ButtonModule,
    DialogModule,
    TextareaModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
    PageHeaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ====== Hero strip ====== -->
    <div class="relative overflow-hidden rounded-2xl border border-indigo-200/40 dark:border-indigo-500/30 mb-6">
      <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 opacity-95"></div>
      <div class="absolute inset-0 opacity-25" style="background-image: radial-gradient(circle at 15% 20%, white 1px, transparent 1px), radial-gradient(circle at 85% 80%, white 1px, transparent 1px); background-size: 28px 28px, 22px 22px;"></div>

      <div class="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-7 text-white">
        <div>
          <div class="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold bg-white/15 backdrop-blur px-3 py-1 rounded-full">
            <span class="relative flex w-2 h-2">
              <span class="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-300 opacity-75"></span>
              <span class="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"></span>
            </span>
            Yugma OS · Agents powered by GPT-5
          </div>
          <h1 class="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Your AI workforce for HR</h1>
          <p class="mt-2 text-white/85 max-w-2xl text-sm md:text-base leading-relaxed">
            Autonomous agents across the employee lifecycle. Inspect every action, swap models, pause what you don't trust.
          </p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 lg:min-w-[460px]">
          <div class="rounded-xl bg-white/10 backdrop-blur p-3">
            <div class="text-[10px] uppercase tracking-wider opacity-80">Agents</div>
            <div class="text-2xl font-semibold tabular-nums">{{ svc.stats()?.agentCount ?? '—' }}</div>
          </div>
          <div class="rounded-xl bg-white/10 backdrop-blur p-3">
            <div class="text-[10px] uppercase tracking-wider opacity-80">Runs · 24h</div>
            <div class="text-2xl font-semibold tabular-nums">{{ svc.stats()?.runs24h ?? 0 }}</div>
          </div>
          <div class="rounded-xl bg-white/10 backdrop-blur p-3">
            <div class="text-[10px] uppercase tracking-wider opacity-80">Tokens · 30d</div>
            <div class="text-2xl font-semibold tabular-nums">{{ (svc.stats()?.tokens30d ?? 0) | number }}</div>
          </div>

          <div class="col-span-2 lg:col-span-3 rounded-xl bg-white/10 backdrop-blur p-3 flex items-center gap-4 flex-wrap">
            <div class="text-[10px] uppercase tracking-wider opacity-80">Health</div>
            <div class="flex items-center gap-3 flex-wrap text-sm">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span class="tabular-nums font-semibold">{{ svc.health().online }}</span> online
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-300"></span>
                <span class="tabular-nums font-semibold">{{ svc.health().idle }}</span> idle
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                <span class="tabular-nums font-semibold">{{ svc.health().error }}</span> error
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-white/40"></span>
                <span class="tabular-nums font-semibold">{{ svc.health().disabled }}</span> paused
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <app-page-header
      eyebrow="HR · Intelligence"
      title="Agent Operations Hub"
      subtitle="Run, configure and monitor every employee-lifecycle agent."
    >
      <div class="inline-flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <button type="button"
          class="px-3 py-1.5 text-sm transition"
          [ngClass]="view() === 'cards' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800'"
          (click)="view.set('cards')"
        ><i class="pi pi-th-large text-[11px] mr-1.5"></i>Cards</button>
        <button type="button"
          class="px-3 py-1.5 text-sm transition"
          [ngClass]="view() === 'health' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800'"
          (click)="view.set('health')"
        ><i class="pi pi-shield text-[11px] mr-1.5"></i>Health</button>
      </div>
      <button pButton severity="secondary" [outlined]="true" icon="pi pi-refresh" label="Refresh" (click)="svc.refresh()"></button>
    </app-page-header>

    <!-- ====== Filter chips ====== -->
    <div class="card p-3 mb-4 flex flex-wrap items-center gap-2">
      <button type="button" class="text-sm px-3 py-1.5 rounded-full border transition"
        [ngClass]="stageFilter() === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-indigo-300'"
        (click)="setStage(null)">
        <i class="pi pi-th-large mr-1.5 text-[11px]"></i>All
        <span class="ml-1.5 text-[11px] opacity-80">{{ svc.agents().length }}</span>
      </button>
      @for (s of svc.stages; track s.key) {
        <button type="button" class="text-sm px-3 py-1.5 rounded-full border transition"
          [ngClass]="stageFilter() === s.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-indigo-300 text-surface-700 dark:text-surface-200'"
          (click)="setStage(s.key)">
          <i class="pi {{ s.emoji }} mr-1.5 text-[11px]"></i>{{ s.label }}
          <span class="ml-1.5 text-[11px] opacity-80">{{ countOf(s.key) }}</span>
        </button>
      }
      <div class="ml-auto inline-flex items-center gap-1 text-xs">
        <span class="text-surface-500">Status:</span>
        <button type="button" class="px-2 py-0.5 rounded-full border transition text-[11px]"
          [ngClass]="statusFilter() === null ? 'bg-surface-900 text-white border-surface-900 dark:bg-surface-100 dark:text-surface-900 dark:border-surface-100' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-surface-400'"
          (click)="setStatus(null)">All</button>
        @for (s of statusChips; track s.key) {
          <button type="button" class="px-2 py-0.5 rounded-full border transition text-[11px] inline-flex items-center gap-1"
            [ngClass]="statusFilter() === s.key ? 'bg-surface-900 text-white border-surface-900 dark:bg-surface-100 dark:text-surface-900 dark:border-surface-100' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-surface-400'"
            (click)="setStatus(s.key)">
            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="statusDotBg(s.key)"></span>{{ s.label }}
          </button>
        }
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
      <div class="space-y-6">
        @if (view() === 'cards') {
          @for (group of filteredGroups(); track group.stage.key) {
            @if (group.agents.length) {
              <section>
                <div class="flex items-center gap-3 mb-3">
                  <span class="w-9 h-9 rounded-lg grid place-items-center {{ stageBubble(group.stage.key) }}">
                    <i class="pi {{ group.stage.emoji }}"></i>
                  </span>
                  <div>
                    <div class="font-semibold leading-tight">{{ group.stage.label }}</div>
                    <div class="text-xs text-surface-500">{{ group.agents.length }} agent{{ group.agents.length === 1 ? '' : 's' }}</div>
                  </div>
                  <div class="ml-auto h-px flex-1 bg-gradient-to-r from-transparent via-surface-200 to-transparent dark:via-surface-800"></div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  @for (a of group.agents; track a.id) {
                    <article
                      class="group relative rounded-2xl border bg-white dark:bg-surface-900 p-4 transition hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-card overflow-hidden"
                      [class.opacity-60]="!a.enabled"
                    >
                      <div class="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition" style="background: radial-gradient(400px circle at 50% 50%, rgba(99,102,241,0.10), transparent 40%);"></div>

                      <div class="relative flex items-start gap-3">
                        <!-- Icon with live status dot -->
                        <div class="relative shrink-0">
                          <span class="w-11 h-11 rounded-2xl grid place-items-center {{ stageBubble(a.stage) }}">
                            <i class="pi {{ a.icon }} text-lg"></i>
                          </span>
                          <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-surface-900"
                            [ngClass]="statusDotBg(a.status)"
                            [pTooltip]="statusTooltip(a)"
                            tooltipPosition="top">
                            @if (a.status === 'online') {
                              <span class="absolute inset-0 inline-flex rounded-full animate-ping opacity-60" [ngClass]="statusDotBg(a.status)"></span>
                            }
                          </span>
                        </div>

                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-semibold leading-tight truncate">{{ a.name }}</h3>
                            @if (isOrchestrator(a.key)) {
                              <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white inline-flex items-center gap-1" pTooltip="Calls multiple agents">
                                <i class="pi pi-sitemap text-[9px]"></i>multi-step
                              </span>
                            }
                            <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">{{ a.model }}</span>
                          </div>
                          <div class="text-xs text-surface-500 mt-0.5 inline-flex items-center gap-2">
                            <span>{{ a.capability }}</span>
                            <span class="text-surface-300">·</span>
                            <span class="inline-flex items-center gap-1" [ngClass]="statusTextClass(a.status)">
                              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="statusDotBg(a.status)"></span>
                              {{ statusLabel(a.status) }}
                            </span>
                          </div>
                        </div>

                        <button pButton [text]="true" rounded icon="pi pi-cog" severity="secondary"
                          pTooltip="Configure model & state" tooltipPosition="top"
                          (click)="openConfig(a)" class="shrink-0 !w-8 !h-8"></button>
                      </div>

                      <p class="relative text-sm text-surface-600 dark:text-surface-300 mt-3 leading-relaxed line-clamp-3">{{ a.tagline }}</p>

                      <div class="relative mt-4 flex items-center justify-between">
                        <div class="flex items-center gap-3 text-[11px] text-surface-500">
                          <span class="inline-flex items-center gap-1" pTooltip="Avg latency · 30d">
                            <i class="pi pi-clock text-[10px]"></i>{{ a.avgLatencyMs || '—' }} ms
                          </span>
                          <span class="inline-flex items-center gap-1" pTooltip="Successful runs · 30d">
                            <i class="pi pi-check text-[10px] text-emerald-500"></i>{{ a.successes30d }}
                          </span>
                          @if (a.failures30d > 0) {
                            <span class="inline-flex items-center gap-1 text-rose-500" pTooltip="Failed runs · 30d">
                              <i class="pi pi-times text-[10px]"></i>{{ a.failures30d }}
                            </span>
                          }
                        </div>
                        <button pButton size="small" icon="pi pi-bolt" label="Run" [disabled]="!a.enabled"
                          class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-700"
                          (click)="openRunDialog(a)"></button>
                      </div>
                    </article>
                  }
                </div>
              </section>
            }
          }
        } @else {
          <!-- ============== Health table ============== -->
          <section class="card overflow-hidden">
            <header class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center gap-3">
              <span class="w-9 h-9 rounded-lg grid place-items-center bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <i class="pi pi-shield"></i>
              </span>
              <div>
                <div class="font-semibold leading-tight">Agent health &amp; configuration</div>
                <div class="text-xs text-surface-500">Live status of every agent · click the gear to change model or pause.</div>
              </div>
            </header>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-surface-50 dark:bg-surface-950/40 text-[11px] uppercase tracking-wider text-surface-500">
                  <tr>
                    <th class="text-left px-5 py-2.5">Agent</th>
                    <th class="text-left px-3 py-2.5">Stage</th>
                    <th class="text-left px-3 py-2.5">Model</th>
                    <th class="text-left px-3 py-2.5">Status</th>
                    <th class="text-right px-3 py-2.5">Runs (30d)</th>
                    <th class="text-right px-3 py-2.5">Errors</th>
                    <th class="text-right px-3 py-2.5">Avg latency</th>
                    <th class="text-right px-3 py-2.5">Last run</th>
                    <th class="text-right px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of filteredFlat(); track a.id) {
                    <tr class="border-t border-surface-100 dark:border-surface-800 hover:bg-surface-50/60 dark:hover:bg-surface-950/30 transition">
                      <td class="px-5 py-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <span class="w-9 h-9 rounded-xl grid place-items-center {{ stageBubble(a.stage) }} shrink-0">
                            <i class="pi {{ a.icon }}"></i>
                          </span>
                          <div class="min-w-0">
                            <div class="font-medium truncate">{{ a.name }}</div>
                            <div class="text-[11px] text-surface-500 truncate">{{ a.capability }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-3 py-3 text-xs">{{ stageLabel(a.stage) }}</td>
                      <td class="px-3 py-3">
                        <span class="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">{{ a.model }}</span>
                      </td>
                      <td class="px-3 py-3">
                        <span class="inline-flex items-center gap-1.5 text-xs" [ngClass]="statusTextClass(a.status)">
                          <span class="w-2 h-2 rounded-full" [ngClass]="statusDotBg(a.status)"></span>
                          {{ statusLabel(a.status) }}
                        </span>
                      </td>
                      <td class="px-3 py-3 text-right tabular-nums">{{ a.runs30d }}</td>
                      <td class="px-3 py-3 text-right tabular-nums" [class.text-rose-500]="a.failures30d > 0">{{ a.failures30d }}</td>
                      <td class="px-3 py-3 text-right tabular-nums text-xs">{{ a.avgLatencyMs || '—' }} ms</td>
                      <td class="px-3 py-3 text-right text-xs text-surface-500">{{ a.lastRunAt ? (a.lastRunAt | date: 'medium') : 'never' }}</td>
                      <td class="px-5 py-3 text-right whitespace-nowrap">
                        <button pButton [text]="true" size="small" icon="pi pi-cog" (click)="openConfig(a)" pTooltip="Configure"></button>
                        <button pButton [text]="true" size="small" icon="pi pi-bolt" [disabled]="!a.enabled" (click)="openRunDialog(a)" pTooltip="Run now"></button>
                      </td>
                    </tr>
                  }
                  @if (filteredFlat().length === 0) {
                    <tr><td colspan="9" class="px-5 py-10 text-center text-sm text-surface-500">No agents match these filters.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      </div>

      <!-- ====== Activity stream ====== -->
      <aside class="hidden xl:block sticky top-4 space-y-4">
        <div class="rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden bg-white dark:bg-surface-900">
          <header class="px-4 py-3 border-b border-surface-200 dark:border-surface-800 flex items-center gap-2">
            <span class="relative flex w-2 h-2">
              <span class="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"></span>
            </span>
            <div class="font-semibold text-sm leading-none">Agent activity</div>
            <span class="ml-auto text-[11px] text-surface-500">live · last 30</span>
          </header>
          <div class="max-h-[640px] overflow-y-auto">
            @if (svc.runs().length === 0) {
              <div class="p-6 text-center text-sm text-surface-500">
                <i class="pi pi-clock text-2xl text-surface-300"></i>
                <div class="mt-2">No runs yet. Click <span class="font-medium">Run</span> on any agent to see activity flow here.</div>
              </div>
            }
            @for (r of svc.runs(); track r.id) {
              <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-800 last:border-0 flex gap-3 hover:bg-surface-50 dark:hover:bg-surface-950/40 cursor-pointer transition"
                (click)="openExistingRun(r)">
                <span class="w-8 h-8 rounded-lg grid place-items-center text-[11px] font-bold shrink-0"
                  [ngClass]="r.status === 'succeeded' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : r.status === 'failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'">
                  <i class="pi" [ngClass]="r.status === 'succeeded' ? 'pi-check' : r.status === 'failed' ? 'pi-times' : 'pi-spinner pi-spin'"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 text-sm font-medium">
                    <span class="truncate">{{ r.agentName }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">{{ r.model }}</span>
                  </div>
                  <div class="text-xs text-surface-500 line-clamp-2 mt-0.5">{{ r.summary || r.output || '…' }}</div>
                  <div class="text-[11px] text-surface-400 mt-1 flex items-center gap-2">
                    <span>{{ r.startedAt | date: 'shortTime' }}</span>
                    <span>·</span>
                    <span>{{ r.latencyMs }} ms</span>
                    <span>·</span>
                    <span>{{ r.tokensIn + r.tokensOut | number }} tok</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </aside>
    </div>

    <!-- ===================== Run dialog ===================== -->
    <p-dialog [(visible)]="runDialogOpen" [modal]="true" [draggable]="false" [style]="{ width: '720px', 'max-width': '95vw' }" [showHeader]="false" [dismissableMask]="false">
      @if (activeAgent(); as a) {
        <div class="relative overflow-hidden rounded-t-2xl">
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 opacity-95"></div>
          <div class="relative flex items-start justify-between gap-3 p-5 text-white">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-11 h-11 rounded-2xl grid place-items-center bg-white/15 backdrop-blur shrink-0">
                <i class="pi {{ a.icon }} text-lg"></i>
              </span>
              <div class="min-w-0">
                <div class="text-[11px] uppercase tracking-wider opacity-80">{{ stageLabel(a.stage) }} · agent</div>
                <h3 class="font-semibold text-lg leading-tight truncate">{{ a.name }}</h3>
                <div class="text-[11px] mt-1 opacity-90 inline-flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-2 py-0.5">
                    <i class="pi pi-bolt text-[10px]"></i>{{ a.model }}
                  </span>
                  <span class="opacity-80">{{ a.capability }}</span>
                </div>
              </div>
            </div>
            <button pButton [text]="true" rounded icon="pi pi-times" class="!text-white" (click)="runDialogOpen = false"></button>
          </div>
        </div>

        <div class="p-5 space-y-5">
          <p class="text-sm text-surface-600 dark:text-surface-300">{{ a.description }}</p>
          <div>
            <label class="block text-xs uppercase tracking-wider text-surface-500 mb-1.5">Optional input</label>
            <textarea pTextarea [(ngModel)]="input" rows="3" class="w-full !rounded-lg" placeholder="e.g. Senior Engineer, Bengaluru, must-have Postgres at scale…"></textarea>
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
                      [ngClass]="s.status === 'succeeded' ? 'bg-emerald-500 text-white' : s.status === 'failed' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'">{{ i + 1 }}</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 text-sm font-medium flex-wrap">
                        <span class="truncate">{{ s.agentName }}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">{{ s.model }}</span>
                      </div>
                      <div class="text-xs text-surface-600 dark:text-surface-300 mt-0.5">{{ s.summary || s.agentKey }}</div>
                      <div class="text-[11px] text-surface-400 mt-0.5 inline-flex items-center gap-2">
                        <span>{{ s.latencyMs }} ms</span><span>·</span><span>{{ s.tokensIn + s.tokensOut | number }} tok</span>
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
            <div class="p-4 bg-white dark:bg-surface-900 min-h-[180px] max-h-[320px] overflow-y-auto">
              @if (running()) {
                <div class="space-y-2">
                  @for (_ of [1,2,3]; track $index) {
                    <div class="h-3 rounded bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100 dark:from-surface-800 dark:via-surface-700 dark:to-surface-800 animate-pulse"></div>
                  }
                </div>
              } @else if (lastRun()?.output) {
                <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-surface-800 dark:text-surface-100">{{ lastRun()!.output }}</pre>
              } @else {
                <div class="text-center text-sm text-surface-500 py-8">
                  <i class="pi pi-sparkles text-2xl text-indigo-300"></i>
                  <div class="mt-2">Click <span class="font-medium">Run agent</span> to invoke {{ a.name }}.</div>
                </div>
              }
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 border-t border-surface-200 dark:border-surface-800 pt-4">
            <div class="text-[11px] text-surface-500"><i class="pi pi-info-circle mr-1"></i>Runs are logged with input + output.</div>
            <div class="flex items-center gap-2">
              @if (lastRun()?.status === 'succeeded') {
                <button pButton severity="secondary" [outlined]="true" icon="pi pi-times" label="Dismiss" (click)="runDialogOpen = false"></button>
                <button pButton icon="pi pi-check" label="Accept" class="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700" (click)="runDialogOpen = false"></button>
              } @else {
                <button pButton severity="secondary" [outlined]="true" label="Close" (click)="runDialogOpen = false"></button>
                <button pButton icon="pi pi-bolt" label="Run agent" [loading]="running()" class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-700" (click)="run()"></button>
              }
            </div>
          </div>
        </div>
      }
    </p-dialog>

    <!-- ===================== Config dialog ===================== -->
    <p-dialog [(visible)]="configDialogOpen" [modal]="true" [draggable]="false" [style]="{ width: '560px', 'max-width': '95vw' }" [showHeader]="false" [dismissableMask]="true">
      @if (configAgent(); as a) {
        <div class="p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-11 h-11 rounded-2xl grid place-items-center {{ stageBubble(a.stage) }} shrink-0">
                <i class="pi {{ a.icon }}"></i>
              </span>
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wider text-surface-500">Configure agent</div>
                <h3 class="font-semibold text-lg leading-tight truncate">{{ a.name }}</h3>
                <div class="text-xs text-surface-500 truncate">{{ stageLabel(a.stage) }} · {{ a.capability }}</div>
              </div>
            </div>
            <button pButton [text]="true" rounded icon="pi pi-times" (click)="configDialogOpen = false"></button>
          </div>

          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4 flex items-center gap-3 mb-4">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shrink-0">
              <i class="pi pi-power-off"></i>
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">Agent state</div>
              <div class="text-xs text-surface-500 leading-snug">
                When paused, the agent won't run automatically and the <span class="font-medium">Run</span> action is disabled.
              </div>
            </div>
            <p-toggleswitch [(ngModel)]="configEnabled" />
          </div>

          <div class="mb-4">
            <label class="block text-xs uppercase tracking-wider text-surface-500 mb-2">Model</label>
            <p-select
              [options]="modelOptions()"
              [(ngModel)]="configModel"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              filterBy="label"
              styleClass="w-full"
            >
              <ng-template let-opt pTemplate="item">
                <div class="flex items-center gap-2 py-1">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r {{ opt.gradient }} text-white">{{ opt.label }}</span>
                  <span class="text-xs text-surface-500">{{ opt.provider }}</span>
                </div>
              </ng-template>
            </p-select>
            <div class="text-[11px] text-surface-500 mt-2">
              <i class="pi pi-info-circle mr-1"></i>
              Model change takes effect on the next run. Currently selected: <span class="font-medium">{{ configModel }}</span>.
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-surface-200 dark:border-surface-800 pt-4">
            <button pButton severity="secondary" [outlined]="true" label="Cancel" (click)="configDialogOpen = false"></button>
            <button pButton icon="pi pi-check" label="Save changes" [loading]="savingConfig()" (click)="saveConfig()"></button>
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  `]
})
export class AgentsHubComponent {
  protected readonly svc = inject(AgentService);
  private readonly messages = inject(MessageService);

  protected readonly view = signal<ViewMode>('cards');

  // Run dialog state
  protected runDialogOpen = false;
  protected input = '';
  protected readonly activeAgent = signal<AgentInfo | null>(null);
  protected readonly running = signal(false);
  protected readonly lastRun = signal<AgentRun | null>(null);

  // Config dialog state
  protected configDialogOpen = false;
  protected readonly configAgent = signal<AgentInfo | null>(null);
  protected readonly savingConfig = signal(false);
  protected configModel = '';
  protected configEnabled = true;

  protected readonly stageFilter = signal<AgentStage | null>(null);
  protected readonly statusFilter = signal<AgentStatus | null>(null);

  protected readonly statusChips: { key: AgentStatus; label: string }[] = [
    { key: 'online',   label: 'Online' },
    { key: 'idle',     label: 'Idle' },
    { key: 'error',    label: 'Error' },
    { key: 'disabled', label: 'Paused' }
  ];

  protected readonly filteredGroups = computed(() => {
    const st = this.stageFilter();
    const stat = this.statusFilter();
    return this.svc.agentsByStage().map((g) => ({
      stage: g.stage,
      agents: g.agents
        .filter((a) => !st || a.stage === st)
        .filter((a) => !stat || a.status === stat)
    }));
  });

  protected readonly filteredFlat = computed(() => {
    const st = this.stageFilter();
    const stat = this.statusFilter();
    return this.svc.agents()
      .filter((a) => !st || a.stage === st)
      .filter((a) => !stat || a.status === stat)
      .sort((a, b) => a.stage.localeCompare(b.stage) || a.name.localeCompare(b.name));
  });

  protected readonly modelOptions = computed(() => {
    return this.svc.models().map((m) => {
      let provider = 'Other';
      let gradient = 'from-slate-500 to-slate-700';
      if (m.startsWith('gpt')) { provider = 'OpenAI'; gradient = 'from-indigo-500 to-fuchsia-500'; }
      else if (m.startsWith('claude')) { provider = 'Anthropic'; gradient = 'from-amber-500 to-rose-500'; }
      else if (m.startsWith('gemini')) { provider = 'Google'; gradient = 'from-sky-500 to-cyan-500'; }
      else if (m.startsWith('llama')) { provider = 'Meta'; gradient = 'from-blue-500 to-indigo-500'; }
      else if (m === 'embedding') { provider = 'Vector', gradient = 'from-emerald-500 to-teal-500'; }
      return { label: m, value: m, provider, gradient };
    });
  });

  constructor() { this.svc.refresh(); }

  protected isOrchestrator(key: string): boolean {
    return key.endsWith('.pipeline')
        || key.endsWith('.orchestrator')
        || key === 'confirmation.decision'
        || key === 'separation.action_plan';
  }

  protected setStage(s: AgentStage | null) { this.stageFilter.set(s); }
  protected setStatus(s: AgentStatus | null) { this.statusFilter.set(s); }
  protected countOf(stage: AgentStage) { return this.svc.agents().filter((a) => a.stage === stage).length; }
  protected stageLabel(s: AgentStage) { return this.svc.stages.find((x) => x.key === s)?.label ?? s; }
  protected stageBubble(s: AgentStage): string {
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

  protected statusLabel(s: AgentStatus) {
    return s === 'disabled' ? 'Paused' : s.charAt(0).toUpperCase() + s.slice(1);
  }
  protected statusDotBg(s: AgentStatus) {
    return ({
      online:   'bg-emerald-500',
      idle:     'bg-amber-400',
      error:    'bg-rose-500',
      disabled: 'bg-surface-400 dark:bg-surface-500'
    } as Record<AgentStatus, string>)[s];
  }
  protected statusTextClass(s: AgentStatus) {
    return ({
      online:   'text-emerald-600 dark:text-emerald-400',
      idle:     'text-amber-600 dark:text-amber-400',
      error:    'text-rose-600 dark:text-rose-400',
      disabled: 'text-surface-500'
    } as Record<AgentStatus, string>)[s];
  }
  protected statusTooltip(a: AgentInfo) {
    if (a.status === 'disabled') return 'Paused — admin disabled this agent';
    if (a.status === 'error')    return `Last run failed${a.lastRunAt ? ' at ' + new Date(a.lastRunAt).toLocaleString() : ''}`;
    if (a.status === 'online')   return `Online · ${a.successes30d} success${a.successes30d === 1 ? '' : 'es'} in 30d`;
    return 'Idle — no successful runs in 30d';
  }

  protected openRunDialog(a: AgentInfo) {
    this.activeAgent.set(a);
    this.input = '';
    this.lastRun.set(null);
    this.runDialogOpen = true;
  }
  protected openExistingRun(r: AgentRun) {
    const a = this.svc.agents().find((x) => x.key === r.agentKey);
    if (!a) return;
    this.activeAgent.set(a);
    this.lastRun.set(r);
    this.runDialogOpen = true;
  }
  protected run() {
    const a = this.activeAgent();
    if (!a) return;
    this.running.set(true);
    this.svc.invoke(a.key, this.input.trim() || undefined).subscribe({
      next: (run) => { this.running.set(false); this.lastRun.set(run); },
      error: () => { this.running.set(false); this.messages.add({ severity: 'error', summary: 'Agent failed' }); }
    });
  }

  protected openConfig(a: AgentInfo) {
    this.configAgent.set(a);
    this.configModel = a.model;
    this.configEnabled = a.enabled;
    this.configDialogOpen = true;
  }
  protected saveConfig() {
    const a = this.configAgent();
    if (!a) return;
    this.savingConfig.set(true);
    this.svc.updateConfig(a.key, { model: this.configModel, enabled: this.configEnabled }).subscribe({
      next: (res) => {
        this.savingConfig.set(false);
        this.configDialogOpen = false;
        this.messages.add({
          severity: 'success',
          summary: 'Agent updated',
          detail: `${a.name} → ${res.model} · ${res.enabled ? 'active' : 'paused'}.`
        });
      },
      error: () => {
        this.savingConfig.set(false);
        this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not update agent configuration.' });
      }
    });
  }
}
