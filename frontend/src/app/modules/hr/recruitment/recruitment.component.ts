import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { environment } from '@env/environment';

type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Feedback { interviewer: string; round?: string; rating: number; recommendation: string; comments?: string; at: string; }
interface Activity { kind: string; from?: string; to?: string; note?: string; by?: string; at: string; }
interface OnbDoc { name: string; status: string; note?: string | null; by?: string | null; at?: string | null; }
interface Onboarding {
  step: string;
  startedAt: string;
  documents: OnbDoc[];
  documentsVerified: number;
  documentsTotal: number;
  background: { status: string; provider?: string | null; note?: string | null; at?: string | null };
  offer: { status: string; fileName?: string | null; hasLetter: boolean; url?: string | null; joiningDate?: string | null; ctcLakhs?: number | null; releasedAt?: string | null };
  acceptance: { status: string; note?: string | null; at?: string | null };
}
interface Candidate {
  id: string; name: string; role: string; source: string; stage: Stage; rating: number;
  appliedAt: string; lastActivityAt: string; email?: string; location?: string;
  experienceYears: number; expectedCtcLakhs: number; owner?: string;
  resumeFileName?: string | null; hasResume?: boolean; resumeUrl?: string | null;
  interviewer?: string | null; interviewScheduledAt?: string | null;
  feedback: Feedback[]; activity: Activity[]; onboarding?: Onboarding | null;
}
interface Summary {
  openRoles: number; openPositions: number; departments: number; inPipeline: number;
  offersOut: number; hiredQtd: number;
  funnel: { applied: number; screening: number; interview: number; offer: number; hired: number; rejected: number };
  bySource: { source: string; count: number }[];
}
interface JobRole {
  id: string; title: string; department: string; location: string; employmentType: string;
  openings: number; status: string; priority: string; hiringManager?: string;
  budgetCtcLakhs: number; postedAt: string; applicants: number; inPipeline: number;
}

const STAGES: { key: Stage; label: string; dot: string }[] = [
  { key: 'applied', label: 'Applied', dot: 'bg-surface-400' },
  { key: 'screening', label: 'Screening', dot: 'bg-brand-400' },
  { key: 'interview', label: 'Interview', dot: 'bg-indigo-400' },
  { key: 'offer', label: 'Offer', dot: 'bg-amber-400' },
  { key: 'hired', label: 'Hired', dot: 'bg-emerald-500' },
  { key: 'rejected', label: 'Rejected', dot: 'bg-rose-400' }
];

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, DragDropModule,
    ButtonModule, TabsModule, TableModule, DialogModule, SelectModule, InputTextModule, InputNumberModule,
    TextareaModule, DatePickerModule, TooltipModule,
    PageHeaderComponent, StatusPillComponent, AvatarComponent, HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Talent" title="Recruitment" subtitle="Applicant tracking — move candidates through a guided hiring workflow: screen, assign interviewers, capture feedback and make offers.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="Add candidate" (click)="openAdd()"></button>
    </app-page-header>

    <app-hr-agent-rail stage="recruitment" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[26px] leading-tight font-semibold text-surface-800 dark:text-surface-100 mt-0.5 tabular-nums">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5 truncate">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="card">
      <p-tabs value="pipeline">
        <p-tablist>
          <p-tab value="pipeline">Pipeline</p-tab>
          <p-tab value="roles">Open roles ({{ openRolesCount() }})</p-tab>
          <p-tab value="analytics">Analytics</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- ===================== PIPELINE ===================== -->
          <p-tabpanel value="pipeline">
            <div class="pt-2">
              <div class="flex gap-4 overflow-x-auto pb-1" cdkDropListGroup>
                @for (col of stages; track col.key) {
                  <div class="min-w-[256px] flex-1 flex flex-col">
                    <div class="flex items-center gap-2 mb-3 px-1">
                      <span class="w-1.5 h-1.5 rounded-full" [class]="col.dot"></span>
                      <span class="text-[13px] font-medium text-surface-700 dark:text-surface-200">{{ col.label }}</span>
                      <span class="text-xs text-surface-400 tabular-nums">{{ lists()[col.key].length }}</span>
                    </div>
                    <div
                      class="rounded-xl p-1.5 space-y-2 flex-1 min-h-[340px] bg-surface-50/60 dark:bg-surface-900/30 transition-colors"
                      cdkDropList
                      [cdkDropListData]="lists()[col.key]"
                      (cdkDropListDropped)="drop($event, col.key)"
                    >
                      @for (c of lists()[col.key]; track c.id) {
                        <div
                          class="bg-white dark:bg-surface-900 rounded-lg p-3 border border-surface-200/80 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition cursor-pointer"
                          cdkDrag
                          (click)="openDetail(c)"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                              <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 truncate">{{ c.name }}</div>
                              <div class="text-[11px] text-surface-500 truncate mt-0.5">{{ c.role }}</div>
                            </div>
                            @if (c.hasResume) {
                              <i class="pi pi-paperclip text-[11px] text-surface-300 mt-0.5" pTooltip="Resume attached"></i>
                            }
                          </div>

                          <div class="mt-2 flex items-center gap-1.5 text-[11px] text-surface-400">
                            <i class="pi pi-briefcase text-[9px]"></i><span>{{ c.experienceYears }}y</span>
                            <span class="text-surface-300">·</span>
                            <i class="pi pi-map-marker text-[9px]"></i><span class="truncate">{{ c.location }}</span>
                          </div>

                          @if (c.stage !== 'hired' && c.interviewer) {
                            <div class="mt-2 flex items-center gap-1.5 text-[11px] text-surface-500">
                              <i class="pi pi-user text-[10px] text-surface-400"></i>
                              <span class="truncate">{{ c.interviewer }}</span>
                              @if (c.interviewScheduledAt) { <span class="text-surface-300">· {{ c.interviewScheduledAt | date: 'd MMM' }}</span> }
                            </div>
                          }
                          @if (c.stage === 'hired' && c.onboarding) {
                            <div class="mt-2 flex items-center gap-1.5 text-[11px]"
                              [class]="c.onboarding.acceptance.status === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : c.onboarding.acceptance.status === 'declined' ? 'text-rose-600 dark:text-rose-400' : 'text-surface-500'">
                              <i class="pi pi-flag text-[10px]"></i>
                              <span class="truncate">{{ onbStepLabel(c.onboarding) }}</span>
                              <span class="text-surface-300">· docs {{ c.onboarding.documentsVerified }}/{{ c.onboarding.documentsTotal }}</span>
                            </div>
                          }

                          <div class="mt-2.5 pt-2.5 border-t border-surface-100 dark:border-surface-800/70 flex items-center justify-between">
                            <span class="text-[10px] uppercase tracking-wide text-surface-400">{{ c.source }}</span>
                            <div class="flex items-center gap-2">
                              @if (c.feedback.length) {
                                <span class="text-[10px] text-surface-400" pTooltip="Interview feedback recorded">
                                  <i class="pi pi-comment text-[9px]"></i> {{ c.feedback.length }}
                                </span>
                              }
                              <div class="flex items-center gap-0.5 text-amber-400">
                                @for (s of [1,2,3,4,5]; track s) {
                                  <i class="pi text-[9px]" [class.pi-star-fill]="s <= c.rating" [class.pi-star]="s > c.rating" [class.text-surface-300]="s > c.rating"></i>
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                      @if (!lists()[col.key].length) {
                        <div class="text-center text-[11px] text-surface-300 py-8 select-none">—</div>
                      }
                    </div>
                  </div>
                }
              </div>
              <p class="text-[11px] text-surface-400 mt-2 px-1"><i class="pi pi-info-circle mr-1"></i>Drag a card to the next stage — you'll be asked to add a screening note, assign an interviewer, or record interview feedback as appropriate. Click a card for the full profile.</p>
            </div>
          </p-tabpanel>

          <!-- ===================== OPEN ROLES ===================== -->
          <p-tabpanel value="roles">
            <p-table [value]="roles()" responsiveLayout="scroll" [rowHover]="true" class="p-2">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-xs !uppercase !text-surface-500">Role</th>
                  <th class="!text-xs !uppercase !text-surface-500">Department</th>
                  <th class="!text-xs !uppercase !text-surface-500">Location</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Openings</th>
                  <th class="!text-xs !uppercase !text-surface-500 !text-right">Applicants</th>
                  <th class="!text-xs !uppercase !text-surface-500">Priority</th>
                  <th class="!text-xs !uppercase !text-surface-500">Status</th>
                  <th class="!text-xs !uppercase !text-surface-500">Hiring manager</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-r>
                <tr>
                  <td>
                    <div class="font-medium">{{ r.title }}</div>
                    <div class="text-[11px] text-surface-500">{{ r.employmentType }} · ₹{{ r.budgetCtcLakhs | number: '1.0-0' }}L · posted {{ r.postedAt | date: 'mediumDate' }}</div>
                  </td>
                  <td class="text-sm">{{ r.department }}</td>
                  <td class="text-sm">{{ r.location }}</td>
                  <td class="text-right tabular-nums">{{ r.openings }}</td>
                  <td class="text-right tabular-nums">
                    <span class="font-medium">{{ r.applicants }}</span>
                    <span class="text-[11px] text-surface-500"> · {{ r.inPipeline }} active</span>
                  </td>
                  <td>
                    <span class="text-xs font-medium" [class.text-rose-600]="r.priority === 'High'" [class.text-amber-600]="r.priority === 'Medium'" [class.text-surface-500]="r.priority === 'Low'">
                      <i class="pi pi-flag-fill text-[9px] mr-1"></i>{{ r.priority }}
                    </span>
                  </td>
                  <td><app-status-pill [tone]="roleTone(r.status)">{{ r.status }}</app-status-pill></td>
                  <td class="text-sm text-surface-500">{{ r.hiringManager || '—' }}</td>
                </tr>
              </ng-template>
            </p-table>
          </p-tabpanel>

          <!-- ===================== ANALYTICS ===================== -->
          <p-tabpanel value="analytics">
            <div class="p-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="section-title mb-3">Hiring funnel</div>
                <div class="space-y-2.5">
                  @for (f of funnelRows(); track f.label) {
                    <div>
                      <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-medium">{{ f.label }}</span>
                        <span class="text-surface-500">{{ f.count }} <span class="text-surface-400">· {{ f.pct }}%</span></span>
                      </div>
                      <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full" [class]="f.color" [style.width.%]="f.pct"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4">
                <div class="section-title mb-3">Candidates by source</div>
                <div class="space-y-2.5">
                  @for (s of summary().bySource; track s.source) {
                    <div>
                      <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-medium">{{ s.source }}</span>
                        <span class="text-surface-500">{{ s.count }}</span>
                      </div>
                      <div class="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full bg-brand-500" [style.width.%]="sourcePct(s.count)"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- ===================== Candidate detail ===================== -->
    <p-dialog [(visible)]="detailVisible" [modal]="true" [style]="{ width: '40rem' }" [header]="detail()?.name || ''" [draggable]="false" [dismissableMask]="true">
      @if (detail(); as c) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-3">
            <app-avatar [name]="c.name" size="lg" />
            <div class="min-w-0">
              <div class="font-semibold">{{ c.name }}</div>
              <div class="text-xs text-surface-500">{{ c.role }}</div>
              <div class="flex items-center gap-0.5 text-amber-500 mt-1">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="pi text-xs" [class.pi-star-fill]="s <= c.rating" [class.pi-star]="s > c.rating" [class.text-surface-300]="s > c.rating"></i>
                }
              </div>
            </div>
            <div class="ml-auto"><app-status-pill [tone]="stageTone(c.stage)">{{ stageLabel(c.stage) }}</app-status-pill></div>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt class="text-[11px] uppercase text-surface-400">Email</dt><dd class="font-medium truncate">{{ c.email || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Location</dt><dd class="font-medium">{{ c.location || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Experience</dt><dd class="font-medium">{{ c.experienceYears }} years</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Expected CTC</dt><dd class="font-medium">₹{{ c.expectedCtcLakhs | number: '1.0-0' }} L</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Source</dt><dd class="font-medium">{{ c.source }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Recruiter</dt><dd class="font-medium">{{ c.owner || '—' }}</dd></div>
          </dl>

          <!-- Resume -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="flex items-center justify-between">
              <div class="section-title">Resume</div>
              <div class="flex items-center gap-2">
                @if (c.hasResume) {
                  <button pButton size="small" text icon="pi pi-external-link" label="View" (click)="viewResume(c)"></button>
                }
                <button pButton size="small" outlined icon="pi pi-upload" [label]="c.hasResume ? 'Replace' : 'Upload'" (click)="resumeInput.click()"></button>
                <input #resumeInput type="file" accept=".pdf,.doc,.docx" class="hidden" (change)="onResumeFile($event)" />
              </div>
            </div>
            <div class="text-xs text-surface-500 mt-1">
              @if (c.hasResume) { <i class="pi pi-file-pdf mr-1"></i>{{ c.resumeFileName || 'resume' }} }
              @else { No resume attached yet. }
            </div>
          </div>

          <!-- Interviewer -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="flex items-center justify-between">
              <div class="section-title">Interviewer</div>
              <button pButton size="small" outlined icon="pi pi-user-plus" [label]="c.interviewer ? 'Reassign' : 'Assign'" (click)="openAssign(c)"></button>
            </div>
            <div class="text-sm mt-1">
              @if (c.interviewer) {
                <span class="font-medium">{{ c.interviewer }}</span>
                @if (c.interviewScheduledAt) { <span class="text-surface-500"> · scheduled {{ c.interviewScheduledAt | date: 'mediumDate' }}</span> }
              } @else { <span class="text-surface-400">Not assigned</span> }
            </div>
          </div>

          <!-- Interview feedback -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="section-title">Interview feedback</div>
              <button pButton size="small" outlined icon="pi pi-comment" label="Add feedback" (click)="openFeedback(c)"></button>
            </div>
            @if (c.feedback?.length) {
              <div class="space-y-2">
                @for (f of c.feedback; track $index) {
                  <div class="rounded-lg bg-surface-50 dark:bg-surface-900/40 p-2.5">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-medium">{{ f.interviewer }}<span class="text-surface-400 font-normal text-xs"> · {{ f.round || 'Interview' }}</span></div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-0.5 text-amber-500">
                          @for (s of [1,2,3,4,5]; track s) {
                            <i class="pi text-[10px]" [class.pi-star-fill]="s <= f.rating" [class.pi-star]="s > f.rating" [class.text-surface-300]="s > f.rating"></i>
                          }
                        </div>
                        <app-status-pill [tone]="recTone(f.recommendation)">{{ f.recommendation }}</app-status-pill>
                      </div>
                    </div>
                    @if (f.comments) { <p class="text-xs text-surface-600 dark:text-surface-300 mt-1">{{ f.comments }}</p> }
                    <div class="text-[10px] text-surface-400 mt-1">{{ f.at | date: 'medium' }}</div>
                  </div>
                }
              </div>
            } @else {
              <div class="text-xs text-surface-400">No feedback recorded yet.</div>
            }
          </div>

          <!-- Post-hire onboarding -->
          @if (c.stage === 'hired') {
            @if (c.onboarding; as ob) {
              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="section-title">Onboarding &amp; offer</div>
                  <span class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                    [class]="ob.acceptance.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : ob.acceptance.status === 'declined' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-surface-100 text-surface-500 dark:bg-surface-800'">
                    {{ onbStepLabel(ob) }}
                  </span>
                </div>

                <ol class="space-y-3.5">
                  <!-- 1. Document verification -->
                  <li class="flex gap-2.5">
                    <i class="pi mt-0.5 text-sm" [class.pi-check-circle]="onbDocsDone(ob)" [class.text-emerald-500]="onbDocsDone(ob)" [class.pi-circle]="!onbDocsDone(ob)" [class.text-surface-300]="!onbDocsDone(ob)"></i>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[13px] font-medium text-surface-800 dark:text-surface-100">Document verification</span>
                        <span class="text-[11px] text-surface-400 tabular-nums">{{ ob.documentsVerified }}/{{ ob.documentsTotal }} verified</span>
                      </div>
                      <div class="mt-1.5 space-y-1">
                        @for (d of ob.documents; track d.name) {
                          <div class="flex items-center justify-between gap-2 text-xs">
                            <span class="flex items-center gap-1.5 min-w-0">
                              <i class="pi text-[10px]"
                                [class.pi-check]="d.status === 'verified'" [class.text-emerald-500]="d.status === 'verified'"
                                [class.pi-times]="d.status === 'rejected'" [class.text-rose-500]="d.status === 'rejected'"
                                [class.pi-clock]="d.status !== 'verified' && d.status !== 'rejected'" [class.text-surface-300]="d.status !== 'verified' && d.status !== 'rejected'"></i>
                              <span class="truncate text-surface-600 dark:text-surface-300">{{ d.name }}</span>
                            </span>
                            @if (d.status === 'verified') {
                              <button pButton size="small" text class="!text-[11px] !py-0 !text-surface-400" label="Undo" (click)="setDoc(c, d.name, 'pending')"></button>
                            } @else {
                              <span class="flex items-center gap-1 shrink-0">
                                <button pButton size="small" text class="!text-[11px] !py-0 !text-rose-500" label="Reject" (click)="setDoc(c, d.name, 'rejected')"></button>
                                <button pButton size="small" outlined class="!text-[11px] !py-0.5" label="Verify" (click)="setDoc(c, d.name, 'verified')"></button>
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  </li>

                  <!-- 2. Background check -->
                  <li class="flex gap-2.5">
                    <i class="pi mt-0.5 text-sm" [class.pi-check-circle]="ob.background.status === 'cleared'" [class.text-emerald-500]="ob.background.status === 'cleared'" [class.pi-circle]="ob.background.status !== 'cleared'" [class.text-surface-300]="ob.background.status !== 'cleared'"></i>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[13px] font-medium text-surface-800 dark:text-surface-100">Background check</span>
                        <button pButton size="small" outlined class="!text-[11px] !py-0.5" [label]="ob.background.status === 'not_started' ? 'Start' : 'Update'" (click)="openBackground(c)"></button>
                      </div>
                      <div class="text-[11px] mt-0.5">
                        <span [class]="onbBgClass(ob.background.status)">{{ onbBgLabel(ob.background.status) }}</span>
                        @if (ob.background.provider) { <span class="text-surface-400"> · {{ ob.background.provider }}</span> }
                      </div>
                      @if (ob.background.note) { <div class="text-[11px] text-surface-400 mt-0.5">{{ ob.background.note }}</div> }
                    </div>
                  </li>

                  <!-- 3. Offer letter -->
                  <li class="flex gap-2.5">
                    <i class="pi mt-0.5 text-sm" [class.pi-check-circle]="ob.offer.status === 'released'" [class.text-emerald-500]="ob.offer.status === 'released'" [class.pi-circle]="ob.offer.status !== 'released'" [class.text-surface-300]="ob.offer.status !== 'released'"></i>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[13px] font-medium text-surface-800 dark:text-surface-100">Offer letter</span>
                        <div class="flex items-center gap-1">
                          @if (ob.offer.hasLetter) { <button pButton size="small" text class="!text-[11px] !py-0" icon="pi pi-external-link" label="View" (click)="viewOffer(c)"></button> }
                          <button pButton size="small" outlined class="!text-[11px] !py-0.5" [disabled]="ob.background.status !== 'cleared'" [label]="ob.offer.status === 'released' ? 'Re-issue' : 'Release'" (click)="openOffer(c)"></button>
                        </div>
                      </div>
                      @if (ob.offer.status === 'released') {
                        <div class="text-[11px] text-surface-500 mt-0.5">
                          Released<span class="text-surface-400">
                            @if (ob.offer.joiningDate) { · joining {{ ob.offer.joiningDate | date: 'mediumDate' }} }
                            @if (ob.offer.ctcLakhs) { · ₹{{ ob.offer.ctcLakhs | number: '1.0-0' }}L }
                          </span>
                        </div>
                      } @else {
                        <div class="text-[11px] text-surface-400 mt-0.5">{{ ob.background.status === 'cleared' ? 'Ready to release' : 'Awaiting background check' }}</div>
                      }
                    </div>
                  </li>

                  <!-- 4. Candidate acceptance -->
                  <li class="flex gap-2.5">
                    <i class="pi mt-0.5 text-sm" [class.pi-check-circle]="ob.acceptance.status === 'accepted'" [class.text-emerald-500]="ob.acceptance.status === 'accepted'" [class.pi-times-circle]="ob.acceptance.status === 'declined'" [class.text-rose-500]="ob.acceptance.status === 'declined'" [class.pi-circle]="ob.acceptance.status === 'pending'" [class.text-surface-300]="ob.acceptance.status === 'pending'"></i>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[13px] font-medium text-surface-800 dark:text-surface-100">Candidate acceptance</span>
                        @if (ob.acceptance.status === 'pending') {
                          <button pButton size="small" outlined class="!text-[11px] !py-0.5" [disabled]="ob.offer.status !== 'released'" label="Record response" (click)="openAcceptance(c)"></button>
                        }
                      </div>
                      <div class="text-[11px] mt-0.5">
                        <span [class]="ob.acceptance.status === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : ob.acceptance.status === 'declined' ? 'text-rose-600 dark:text-rose-400' : 'text-surface-400'">{{ onbAccLabel(ob.acceptance.status) }}</span>
                      </div>
                      @if (ob.acceptance.note) { <div class="text-[11px] text-surface-400 mt-0.5 italic">“{{ ob.acceptance.note }}”</div> }
                    </div>
                  </li>
                </ol>
              </div>
            } @else {
              <div class="rounded-xl border border-dashed border-surface-300 dark:border-surface-700 p-4 text-center">
                <div class="text-xs text-surface-500 mb-2">Begin the post-hire process for this candidate.</div>
                <button pButton size="small" outlined icon="pi pi-flag" label="Start onboarding" (click)="startOnboarding(c)"></button>
              </div>
            }
          }

          <!-- Activity timeline -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="section-title mb-2">Workflow timeline</div>
            @if (c.activity?.length) {
              <ul class="space-y-2">
                @for (a of c.activity; track $index) {
                  <li class="flex gap-2 text-xs">
                    <i class="pi mt-0.5 text-[10px]" [class]="activityIcon(a.kind)"></i>
                    <div class="min-w-0">
                      <div class="text-surface-700 dark:text-surface-200">
                        @if (a.kind === 'move') { Moved <span class="font-medium">{{ stageLabel(a.from) }}</span> → <span class="font-medium">{{ stageLabel(a.to) }}</span> }
                        @else { {{ a.note }} }
                      </div>
                      @if (a.kind === 'move' && a.note) { <div class="text-surface-500">“{{ a.note }}”</div> }
                      <div class="text-[10px] text-surface-400">{{ a.by || '—' }} · {{ a.at | date: 'medium' }}</div>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <div class="text-xs text-surface-400">No activity yet.</div>
            }
          </div>

          <!-- Move to stage -->
          <div class="rounded-xl bg-surface-50 dark:bg-surface-900/40 p-3">
            <label class="text-xs font-medium text-surface-600">Advance to stage</label>
            <div class="flex gap-2 mt-1">
              <p-select [options]="stageOptions" [(ngModel)]="moveStage" optionLabel="label" optionValue="value" styleClass="flex-1 !rounded-lg" appendTo="body" />
              <button pButton label="Go" icon="pi pi-arrow-right" [disabled]="moveStage === c.stage" (click)="beginMove(c, moveStage, c.stage)"></button>
            </div>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" text label="Edit profile" icon="pi pi-pencil" (click)="editFromDetail()"></button>
        <button pButton severity="secondary" outlined label="Close" (click)="detailVisible = false"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Workflow dialog (note / assign / feedback) ===================== -->
    <p-dialog [(visible)]="wfVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="wfTitle" [draggable]="false" [dismissableMask]="false">
      <div class="space-y-3 pt-1">
        @if (pending) {
          <p class="text-xs text-surface-500">
            {{ pending.name }}
            @if (pending.target) { — moving to <span class="font-medium">{{ stageLabel(pending.target) }}</span> }
          </p>
        }

        @if (wfMode === 'assign') {
          <div>
            <label class="text-xs font-medium text-surface-600">Interviewer</label>
            <p-select [options]="interviewerOptions()" [(ngModel)]="wfInterviewer" [editable]="true" [filter]="true" optionLabel="label" optionValue="value" placeholder="Select or type a name" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Interview date</label>
            <p-datePicker [(ngModel)]="wfDate" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Note (optional)</label>
            <textarea pTextarea [(ngModel)]="wfNote" rows="2" class="w-full mt-1 !rounded-lg" placeholder="e.g. Technical + system design round"></textarea>
          </div>
        }

        @if (wfMode === 'feedback') {
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Interviewer</label>
              <p-select [options]="interviewerOptions()" [(ngModel)]="wfInterviewer" [editable]="true" [filter]="true" optionLabel="label" optionValue="value" placeholder="Who interviewed?" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Round</label>
              <p-select [options]="roundOptions" [(ngModel)]="wfRound" [editable]="true" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Rating</label>
              <p-select [options]="ratingOptions" [(ngModel)]="wfRating" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Recommendation</label>
              <p-select [options]="recommendationOptions" [(ngModel)]="wfRecommendation" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Comments</label>
              <textarea pTextarea [(ngModel)]="wfComments" rows="3" class="w-full mt-1 !rounded-lg" placeholder="Strengths, concerns, overall verdict…"></textarea>
            </div>
          </div>
        }

        @if (wfMode === 'note') {
          <div>
            <label class="text-xs font-medium text-surface-600">{{ wfNoteLabel }}</label>
            <textarea pTextarea [(ngModel)]="wfNote" rows="3" class="w-full mt-1 !rounded-lg" [placeholder]="wfNotePlaceholder"></textarea>
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="cancelWorkflow()"></button>
        <button pButton [label]="wfConfirmLabel" icon="pi pi-check" [loading]="saving()" [disabled]="!workflowValid()" (click)="confirmWorkflow()"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Onboarding action (background / offer / acceptance) ===================== -->
    <p-dialog [(visible)]="obVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="obTitle" [draggable]="false" [dismissableMask]="false">
      <div class="space-y-3 pt-1">
        @if (obMode === 'background') {
          <div>
            <label class="text-xs font-medium text-surface-600">Outcome</label>
            <p-select [options]="bgStatusOptions" [(ngModel)]="obStatus" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Agency / provider</label>
            <input pInputText [(ngModel)]="obProvider" class="w-full mt-1 !rounded-lg" placeholder="e.g. AuthBridge, HireRight" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Notes</label>
            <textarea pTextarea [(ngModel)]="obNote" rows="2" class="w-full mt-1 !rounded-lg" placeholder="Checks performed, findings…"></textarea>
          </div>
        }
        @if (obMode === 'offer') {
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Offer letter (PDF)</label>
              <div class="flex items-center gap-2 mt-1">
                <button pButton size="small" outlined icon="pi pi-upload" [label]="obOfferFileName || 'Upload file'" (click)="offerInput.click()"></button>
                <input #offerInput type="file" accept=".pdf,.doc,.docx" class="hidden" (change)="onOfferFile($event)" />
                @if (obOfferFileName) { <i class="pi pi-check text-emerald-500 text-xs"></i> }
              </div>
              <div class="text-[11px] text-surface-400 mt-1">Or paste a link below.</div>
              <input pInputText [(ngModel)]="obOfferUrl" class="w-full mt-1 !rounded-lg" placeholder="https://…  (optional if a file is uploaded)" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Joining date</label>
              <p-datePicker [(ngModel)]="obJoining" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">CTC (₹L)</label>
              <p-inputNumber [(ngModel)]="obCtc" [min]="0" [max]="500" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
            </div>
          </div>
        }
        @if (obMode === 'acceptance') {
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-medium text-surface-600">Response</label>
              <p-select [options]="acceptanceOptions" [(ngModel)]="obStatus" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Confirmed joining date</label>
              <p-datePicker [(ngModel)]="obJoining" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
            </div>
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Note</label>
              <textarea pTextarea [(ngModel)]="obNote" rows="2" class="w-full mt-1 !rounded-lg" placeholder="Candidate's message, conditions…"></textarea>
            </div>
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="obVisible = false"></button>
        <button pButton [label]="obConfirmLabel" icon="pi pi-check" [loading]="saving()" (click)="confirmOnboarding()"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Add / Edit candidate ===================== -->
    <p-dialog [(visible)]="formVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="editId ? 'Edit candidate' : 'Add candidate'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Full name</label>
          <input pInputText [(ngModel)]="form.name" class="w-full mt-1 !rounded-lg" placeholder="Candidate name" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Role</label>
          <p-select [options]="roleOptions()" [(ngModel)]="form.role" [editable]="true" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" placeholder="Role" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Source</label>
          <p-select [options]="sourceOptions" [(ngModel)]="form.source" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Email</label>
          <input pInputText [(ngModel)]="form.email" class="w-full mt-1 !rounded-lg" placeholder="name@email.com" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Location</label>
          <input pInputText [(ngModel)]="form.location" class="w-full mt-1 !rounded-lg" placeholder="City" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Experience (years)</label>
          <p-inputNumber [(ngModel)]="form.experienceYears" [min]="0" [max]="40" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Expected CTC (₹L)</label>
          <p-inputNumber [(ngModel)]="form.expectedCtcLakhs" [min]="0" [max]="500" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Rating</label>
          <p-select [options]="ratingOptions" [(ngModel)]="form.rating" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Stage</label>
          <p-select [options]="stageOptions" [(ngModel)]="form.stage" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" [disabled]="!!editId" appendTo="body" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Recruiter</label>
          <input pInputText [(ngModel)]="form.owner" class="w-full mt-1 !rounded-lg" placeholder="Owner" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="formVisible = false"></button>
        <button pButton [label]="editId ? 'Save' : 'Add candidate'" [disabled]="!form.name.trim() || !form.role.trim()" (click)="submit()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class RecruitmentComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work`;

  protected readonly stages = STAGES;
  protected readonly lists = signal<Record<Stage, Candidate[]>>({ applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [] });
  protected readonly roles = signal<JobRole[]>([]);
  protected readonly summary = signal<Summary>({ openRoles: 0, openPositions: 0, departments: 0, inPipeline: 0, offersOut: 0, hiredQtd: 0, funnel: { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 }, bySource: [] });

  protected readonly openRolesCount = computed(() => this.roles().filter((r) => r.status === 'Open').length);
  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Open roles', value: s.openRoles, caption: `${s.openPositions} positions · ${s.departments} departments` },
      { label: 'In pipeline', value: s.inPipeline, caption: 'active candidates' },
      { label: 'Offers out', value: s.offersOut, caption: 'awaiting decision' },
      { label: 'Hired (QTD)', value: s.hiredQtd, caption: 'this quarter' }
    ];
  });
  protected readonly roleOptions = computed(() => {
    const titles = Array.from(new Set(this.roles().map((r) => r.title)));
    return titles.map((t) => ({ label: t, value: t }));
  });

  protected readonly stageOptions = STAGES.map((s) => ({ label: s.label, value: s.key }));
  protected readonly sourceOptions = ['Referral', 'LinkedIn', 'Naukri', 'Inbound', 'Hackathon', 'Indeed', 'Instahyre'];
  protected readonly ratingOptions = [1, 2, 3, 4, 5].map((n) => ({ label: n + ' ★', value: n }));
  protected readonly roundOptions = ['Screening', 'Technical', 'System design', 'Hiring manager', 'HR', 'Bar raiser'];
  protected readonly recommendationOptions = ['Strong yes', 'Proceed', 'Hold', 'Reject'];
  protected readonly interviewerOptions = signal<{ label: string; value: string }[]>([]);

  detailVisible = false;
  protected readonly detail = signal<Candidate | null>(null);
  moveStage: Stage = 'applied';

  // workflow dialog state
  wfVisible = false;
  wfMode: 'note' | 'assign' | 'feedback' = 'note';
  wfTitle = '';
  wfNoteLabel = 'Note';
  wfNotePlaceholder = '';
  wfConfirmLabel = 'Confirm';
  protected readonly saving = signal(false);
  pending: { id: string; name: string; target?: Stage; from?: Stage; standalone?: 'assign' | 'feedback' } | null = null;
  wfNote = '';
  wfInterviewer = '';
  wfDate: Date | null = null;
  wfRound = 'Technical';
  wfRating = 4;
  wfRecommendation = 'Proceed';
  wfComments = '';

  // onboarding dialog state
  obVisible = false;
  obMode: 'background' | 'offer' | 'acceptance' = 'background';
  obTitle = '';
  obConfirmLabel = 'Save';
  obCandidateId: string | null = null;
  obStatus = 'cleared';
  obProvider = '';
  obNote = '';
  obJoining: Date | null = null;
  obCtc: number | null = null;
  obOfferFileName = '';
  obOfferUrl = '';
  protected readonly bgStatusOptions = [
    { label: 'In progress', value: 'in_progress' },
    { label: 'Cleared', value: 'cleared' },
    { label: 'Flagged', value: 'flagged' }
  ];
  protected readonly acceptanceOptions = [
    { label: 'Accepted', value: 'accepted' },
    { label: 'Declined', value: 'declined' }
  ];

  formVisible = false;
  editId: string | null = null;
  form = this.blank();

  constructor() {
    this.reload();
    this.loadInterviewers();
  }

  reload() {
    forkJoin({
      candidates: this.http.get<Candidate[]>(`${this.base}/candidates`),
      roles: this.http.get<JobRole[]>(`${this.base}/roles`),
      summary: this.http.get<Summary>(`${this.base}/candidates/summary`)
    }).subscribe((r) => {
      this.roles.set(r.roles);
      this.summary.set(r.summary);
      this.group(r.candidates);
    });
  }

  private loadInterviewers() {
    this.http.get<{ items: { fullName: string; designation: string }[] }>(`${this.base}/employees`, { params: { page: '1', pageSize: '200', sortBy: 'fullName', sortDir: 'asc' } })
      .subscribe({
        next: (r) => this.interviewerOptions.set((r.items ?? []).map((e) => ({ label: `${e.fullName} · ${e.designation}`, value: e.fullName }))),
        error: () => { /* free-text entry still works */ }
      });
  }

  private group(candidates: Candidate[]) {
    const map: Record<Stage, Candidate[]> = { applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [] };
    for (const c of candidates) (map[c.stage] ?? map.applied).push(c);
    this.lists.set(map);
  }

  // ---- drag & drop → routes through the guided workflow (no immediate persist) ----
  drop(event: CdkDragDrop<Candidate[]>, target: Stage) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.lists.set({ ...this.lists() });
      return;
    }
    // Do NOT transfer the card yet — the CDK preview snaps back and we apply the move
    // only after the workflow dialog is confirmed.
    const moved = event.previousContainer.data[event.previousIndex];
    this.beginMove(moved, target, moved.stage);
  }

  // ---- guided stage move ----
  beginMove(c: Candidate, target: Stage, from: Stage) {
    if (target === from) { this.detailVisible = false; return; }
    this.pending = { id: c.id, name: c.name, target, from };
    this.resetWorkflowFields(c);

    if (target === 'interview') {
      this.wfMode = 'assign';
      this.wfTitle = 'Assign an interviewer';
      this.wfConfirmLabel = 'Assign & move to Interview';
    } else if (target === 'offer' || target === 'hired') {
      this.wfMode = 'feedback';
      this.wfTitle = 'Record interview feedback';
      this.wfConfirmLabel = `Save feedback & move to ${this.stageLabel(target)}`;
    } else {
      this.wfMode = 'note';
      this.wfTitle = `Move to ${this.stageLabel(target)}`;
      this.wfConfirmLabel = `Move to ${this.stageLabel(target)}`;
      this.wfNoteLabel = target === 'screening' ? 'Screening notes' : target === 'rejected' ? 'Reason for rejection' : 'Note (optional)';
      this.wfNotePlaceholder = target === 'screening'
        ? 'Phone-screen summary, fit, salary expectations…'
        : target === 'rejected' ? 'Why is this candidate not moving forward?' : 'Optional note for the timeline';
    }
    this.detailVisible = false;
    this.wfVisible = true;
  }

  // ---- standalone actions from the detail dialog ----
  openAssign(c: Candidate) {
    this.pending = { id: c.id, name: c.name, standalone: 'assign' };
    this.resetWorkflowFields(c);
    this.wfMode = 'assign';
    this.wfTitle = 'Assign an interviewer';
    this.wfConfirmLabel = 'Save';
    this.wfVisible = true;
  }
  openFeedback(c: Candidate) {
    this.pending = { id: c.id, name: c.name, standalone: 'feedback' };
    this.resetWorkflowFields(c);
    this.wfMode = 'feedback';
    this.wfTitle = 'Record interview feedback';
    this.wfConfirmLabel = 'Save feedback';
    this.wfVisible = true;
  }

  private resetWorkflowFields(c: Candidate) {
    this.wfNote = '';
    this.wfInterviewer = c.interviewer ?? '';
    this.wfDate = c.interviewScheduledAt ? new Date(c.interviewScheduledAt) : null;
    this.wfRound = 'Technical';
    this.wfRating = 4;
    this.wfRecommendation = 'Proceed';
    this.wfComments = '';
  }

  workflowValid(): boolean {
    if (this.wfMode === 'assign') return !!this.wfInterviewer?.trim();
    if (this.wfMode === 'feedback') return !!this.wfInterviewer?.trim();
    return true; // note is optional
  }

  cancelWorkflow() {
    this.wfVisible = false;
    this.pending = null;
  }

  confirmWorkflow() {
    const p = this.pending;
    if (!p || !this.workflowValid()) return;
    this.saving.set(true);

    const fmt = (d: Date | null) => (d ? this.toIsoDate(d) : null);
    let req;
    if (p.standalone === 'assign') {
      req = this.http.post(`${this.base}/candidates/${p.id}/assign-interviewer`, { interviewer: this.wfInterviewer.trim(), interviewAt: fmt(this.wfDate), note: this.wfNote?.trim() || null });
    } else if (p.standalone === 'feedback') {
      req = this.http.post(`${this.base}/candidates/${p.id}/feedback`, { interviewer: this.wfInterviewer.trim(), round: this.wfRound, rating: this.wfRating, recommendation: this.wfRecommendation, comments: this.wfComments?.trim() || null });
    } else {
      const body: Record<string, unknown> = { stage: p.target, note: this.wfNote?.trim() || null };
      if (this.wfMode === 'assign') { body['interviewer'] = this.wfInterviewer.trim(); body['interviewAt'] = fmt(this.wfDate); }
      if (this.wfMode === 'feedback') { body['feedback'] = { interviewer: this.wfInterviewer.trim(), round: this.wfRound, rating: this.wfRating, recommendation: this.wfRecommendation, comments: this.wfComments?.trim() || null }; }
      req = this.http.post(`${this.base}/candidates/${p.id}/stage`, body);
    }

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.wfVisible = false;
        const wasDetail = this.detail()?.id === p.id;
        const verb = p.target ? `→ ${this.stageLabel(p.target)}` : (p.standalone === 'feedback' ? 'feedback saved' : 'interviewer assigned');
        this.messages.add({ severity: 'success', summary: 'Done', detail: `${p.name} ${verb}` });
        this.pending = null;
        this.reload();
        if (wasDetail) this.refreshDetail(p.id);
      },
      error: (e) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: 'Action failed', detail: e?.error?.message ?? 'Could not complete the workflow step.' });
      }
    });
  }

  // ---- resume ----
  onResumeFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const c = this.detail();
    if (!file || !c) return;
    if (file.size > 4_000_000) {
      this.messages.add({ severity: 'warn', summary: 'File too large', detail: 'Please use a file under ~4 MB.' });
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.http.post(`${this.base}/candidates/${c.id}/resume`, { fileName: file.name, url: reader.result as string }).subscribe({
        next: () => {
          this.messages.add({ severity: 'success', summary: 'Resume attached', detail: file.name });
          this.refreshDetail(c.id);
          this.reload();
        },
        error: () => this.messages.add({ severity: 'error', summary: 'Upload failed', detail: 'Could not attach the resume.' })
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  viewResume(c: Candidate) { this.openDoc(c.resumeUrl); }

  // ---- post-hire onboarding ----
  startOnboarding(c: Candidate) {
    this.http.post(`${this.base}/candidates/${c.id}/onboarding/start`, {}).subscribe(() => {
      this.messages.add({ severity: 'success', summary: 'Onboarding started' });
      this.refreshDetail(c.id); this.reload();
    });
  }

  setDoc(c: Candidate, name: string, status: string) {
    this.http.post(`${this.base}/candidates/${c.id}/onboarding/document`, { name, status, note: null }).subscribe({
      next: () => { this.refreshDetail(c.id); this.reload(); },
      error: () => this.messages.add({ severity: 'error', summary: 'Could not update document' })
    });
  }

  openBackground(c: Candidate) {
    this.obCandidateId = c.id;
    this.obMode = 'background';
    this.obTitle = 'Background check';
    this.obConfirmLabel = 'Save outcome';
    this.obStatus = c.onboarding?.background.status && c.onboarding.background.status !== 'not_started' ? c.onboarding.background.status : 'cleared';
    this.obProvider = c.onboarding?.background.provider ?? '';
    this.obNote = c.onboarding?.background.note ?? '';
    this.obVisible = true;
  }

  openOffer(c: Candidate) {
    this.obCandidateId = c.id;
    this.obMode = 'offer';
    this.obTitle = 'Release offer letter';
    this.obConfirmLabel = 'Release offer';
    this.obOfferFileName = c.onboarding?.offer.fileName ?? '';
    this.obOfferUrl = '';
    this.obJoining = c.onboarding?.offer.joiningDate ? new Date(c.onboarding.offer.joiningDate) : null;
    this.obCtc = c.onboarding?.offer.ctcLakhs ?? c.expectedCtcLakhs ?? null;
    this.obVisible = true;
  }

  openAcceptance(c: Candidate) {
    this.obCandidateId = c.id;
    this.obMode = 'acceptance';
    this.obTitle = 'Record candidate response';
    this.obConfirmLabel = 'Save response';
    this.obStatus = 'accepted';
    this.obNote = '';
    this.obJoining = c.onboarding?.offer.joiningDate ? new Date(c.onboarding.offer.joiningDate) : null;
    this.obVisible = true;
  }

  onOfferFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) { this.messages.add({ severity: 'warn', summary: 'File too large', detail: 'Use a file under ~4 MB.' }); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { this.obOfferUrl = reader.result as string; this.obOfferFileName = file.name; };
    reader.readAsDataURL(file);
    input.value = '';
  }

  viewOffer(c: Candidate) { this.openDoc(c.onboarding?.offer.url ?? null); }

  confirmOnboarding() {
    const id = this.obCandidateId;
    if (!id) return;
    const fmt = (d: Date | null) => (d ? this.toIsoDate(d) : null);
    let req;
    if (this.obMode === 'background') {
      req = this.http.post(`${this.base}/candidates/${id}/onboarding/background-check`, { status: this.obStatus, provider: this.obProvider?.trim() || null, note: this.obNote?.trim() || null });
    } else if (this.obMode === 'offer') {
      req = this.http.post(`${this.base}/candidates/${id}/onboarding/offer-letter`, { fileName: this.obOfferFileName || null, url: this.obOfferUrl || null, joiningDate: fmt(this.obJoining), ctcLakhs: this.obCtc });
    } else {
      req = this.http.post(`${this.base}/candidates/${id}/onboarding/acceptance`, { status: this.obStatus, note: this.obNote?.trim() || null, joiningDate: fmt(this.obJoining) });
    }
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.obVisible = false;
        this.messages.add({ severity: 'success', summary: 'Onboarding updated' });
        this.refreshDetail(id); this.reload();
      },
      error: (e) => { this.saving.set(false); this.messages.add({ severity: 'error', summary: 'Update failed', detail: e?.error?.message ?? 'Could not save.' }); }
    });
  }

  private openDoc(url: string | null | undefined) {
    if (!url) return;
    if (url.startsWith('data:')) {
      const w = window.open();
      if (w) w.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100%"></iframe>`);
    } else {
      window.open(url, '_blank');
    }
  }

  // onboarding display helpers
  onbDocsDone(ob: Onboarding): boolean { return ob.documentsTotal > 0 && ob.documentsVerified === ob.documentsTotal; }
  onbStepLabel(ob: Onboarding): string {
    if (ob.acceptance.status === 'accepted') return 'Joined';
    if (ob.acceptance.status === 'declined') return 'Declined';
    return ({ Documents: 'Documents', BackgroundCheck: 'Background', OfferLetter: 'Offer', Acceptance: 'Awaiting acceptance', Completed: 'Completed' } as Record<string, string>)[ob.step] ?? ob.step;
  }
  onbBgLabel(s: string): string { return ({ not_started: 'Not started', in_progress: 'In progress', cleared: 'Cleared', flagged: 'Flagged' } as Record<string, string>)[s] ?? s; }
  onbBgClass(s: string): string { return s === 'cleared' ? 'text-emerald-600 dark:text-emerald-400' : s === 'flagged' ? 'text-rose-600 dark:text-rose-400' : 'text-surface-500'; }
  onbAccLabel(s: string): string { return ({ pending: 'Awaiting candidate response', accepted: 'Offer accepted', declined: 'Offer declined' } as Record<string, string>)[s] ?? s; }

  // ---- detail ----
  openDetail(c: Candidate) {
    this.detail.set(c);          // show the card data immediately…
    this.moveStage = c.stage;
    this.detailVisible = true;
    this.refreshDetail(c.id);    // …then load the full record (resume url, fresh feedback/activity)
  }
  private refreshDetail(id: string) {
    this.http.get<Candidate>(`${this.base}/candidates/${id}`).subscribe((full) => {
      if (this.detail()?.id === id || this.detailVisible) this.detail.set(full);
      this.moveStage = full.stage;
    });
  }

  // ---- add / edit ----
  openAdd() {
    this.editId = null;
    this.form = this.blank();
    this.formVisible = true;
  }
  editFromDetail() {
    const c = this.detail();
    if (!c) return;
    this.editId = c.id;
    this.form = { name: c.name, role: c.role, source: c.source, email: c.email ?? '', location: c.location ?? '', experienceYears: c.experienceYears, expectedCtcLakhs: c.expectedCtcLakhs, rating: c.rating, stage: c.stage, owner: c.owner ?? '' };
    this.detailVisible = false;
    this.formVisible = true;
  }
  submit() {
    const body = { ...this.form };
    const req = this.editId
      ? this.http.put(`${this.base}/candidates/${this.editId}`, body)
      : this.http.post(`${this.base}/candidates`, body);
    req.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: this.editId ? 'Candidate updated' : 'Candidate added', detail: body.name });
        this.formVisible = false;
        this.reload();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save the candidate.' })
    });
  }

  // ---- helpers ----
  protected readonly funnelRows = computed(() => {
    const f = this.summary().funnel;
    const max = Math.max(f.applied, f.screening, f.interview, f.offer, f.hired, 1);
    const mk = (label: string, count: number, color: string) => ({ label, count, color, pct: Math.round((count / max) * 100) });
    return [
      mk('Applied', f.applied, 'bg-brand-200'),
      mk('Screening', f.screening, 'bg-brand-300'),
      mk('Interview', f.interview, 'bg-brand-400'),
      mk('Offer', f.offer, 'bg-brand-500'),
      mk('Hired', f.hired, 'bg-brand-600')
    ];
  });

  sourcePct(count: number): number {
    const max = Math.max(...this.summary().bySource.map((s) => s.count), 1);
    return Math.round((count / max) * 100);
  }

  private toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  stageLabel(s?: Stage | string): string { return STAGES.find((x) => x.key === s)?.label ?? (s ?? ''); }
  stageTone(s: Stage): StatusTone {
    return ({ applied: 'neutral', screening: 'info', interview: 'info', offer: 'warn', hired: 'success', rejected: 'danger' } as Record<Stage, StatusTone>)[s];
  }
  recTone(r: string): StatusTone {
    const k = (r || '').toLowerCase();
    if (k.includes('strong') || k.includes('yes') || k.includes('proceed')) return 'success';
    if (k.includes('hold')) return 'warn';
    if (k.includes('reject')) return 'danger';
    return 'neutral';
  }
  activityIcon(kind: string): string {
    const icon = ({ move: 'pi-arrow-right', assign: 'pi-user-plus', feedback: 'pi-comment', resume: 'pi-paperclip', note: 'pi-pencil' } as Record<string, string>)[kind] ?? 'pi-circle-fill';
    return `${icon} text-surface-400`;
  }
  roleTone(s: string): StatusTone { return s === 'Open' ? 'success' : s === 'OnHold' ? 'warn' : 'neutral'; }

  private blank() {
    return { name: '', role: '', source: 'Inbound', email: '', location: 'Bengaluru', experienceYears: 3, expectedCtcLakhs: 12, rating: 3, stage: 'applied' as Stage, owner: 'Niharika Joshi' };
  }
}
