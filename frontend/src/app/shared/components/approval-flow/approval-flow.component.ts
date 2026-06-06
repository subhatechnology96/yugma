import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';

/**
 * Status of a single node in an approval flow.
 * - submitted → the requester filed it (always the first node)
 * - approved / rejected → this approver acted
 * - current → awaiting this approver right now
 * - pending → not yet reached (an upstream step is still open)
 * - skipped → not required (the decision was already final below this level)
 */
export type ApprovalStepStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'current'
  | 'pending'
  | 'skipped';

export interface ApprovalStep {
  /** Step heading, e.g. "Submitted", "Manager approval", "VP review". */
  label: string;
  /** Person who owns this step. */
  actor: string;
  /** Hierarchy band code (L1..L10), if known. */
  levelCode?: string | null;
  designation?: string | null;
  avatarUrl?: string | null;
  status: ApprovalStepStatus;
  /** ISO timestamp of when this step was acted on. */
  at?: string | null;
  /** Caption shown when there is no timestamp (e.g. "Awaiting decision"). */
  note?: string | null;
}

interface StepMeta {
  node: string;
  icon: string;
  text: string;
  label: string;
  done: boolean;
}

/**
 * Reusable vertical approval-flow visualizer: a connected timeline of who has acted,
 * who it is pending with and which levels remain. Drives any multi-step approval
 * (leave, expenses, provisioning, …) from a plain {@link ApprovalStep} list.
 */
@Component({
  selector: 'app-approval-flow',
  standalone: true,
  imports: [DatePipe, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="relative flex flex-col">
      @for (s of steps(); track $index; let last = $last) {
        @let m = meta(s);
        <li class="relative flex gap-3 pb-5 last:pb-0">
          @if (!last) {
            <span class="absolute left-[15px] top-9 bottom-0 w-px"
              [class]="m.done ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-surface-200 dark:bg-surface-800'"></span>
          }
          <span
            class="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-4 ring-white dark:ring-surface-900"
            [class]="m.node">
            <i class="pi {{ m.icon }}"></i>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold">{{ s.label }}</span>
              @if (s.levelCode) {
                <span class="rounded-full bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-semibold text-surface-500">{{ s.levelCode }}</span>
              }
              <span class="text-[11px] font-semibold" [class]="m.text">{{ m.label }}</span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <app-avatar [name]="s.actor" [image]="s.avatarUrl ?? undefined" size="xs" />
              <span class="truncate text-sm text-surface-700 dark:text-surface-300">{{ s.actor }}</span>
              @if (s.designation) {
                <span class="truncate text-xs text-surface-400">· {{ s.designation }}</span>
              }
            </div>
            @if (s.at) {
              <div class="mt-0.5 text-xs text-surface-500">{{ s.at | date: 'd MMM y, h:mm a' }}</div>
            } @else if (s.note) {
              <div class="mt-0.5 text-xs text-surface-400">{{ s.note }}</div>
            }
          </div>
        </li>
      }
    </ol>
  `
})
export class ApprovalFlowComponent {
  readonly steps = input.required<ApprovalStep[]>();

  protected meta(s: ApprovalStep): StepMeta {
    switch (s.status) {
      case 'submitted':
        return { node: 'bg-brand-600 text-white', icon: 'pi-flag', text: 'text-brand-600 dark:text-brand-400', label: 'Submitted', done: true };
      case 'approved':
        return { node: 'bg-emerald-500 text-white', icon: 'pi-check', text: 'text-emerald-600 dark:text-emerald-400', label: 'Approved', done: true };
      case 'rejected':
        return { node: 'bg-rose-500 text-white', icon: 'pi-times', text: 'text-rose-600 dark:text-rose-400', label: 'Rejected', done: false };
      case 'current':
        return { node: 'bg-amber-500 text-white', icon: 'pi-hourglass', text: 'text-amber-600 dark:text-amber-400', label: 'Pending', done: false };
      case 'pending':
        return { node: 'bg-surface-200 dark:bg-surface-800 text-surface-500', icon: 'pi-ellipsis-h', text: 'text-surface-400', label: 'Upcoming', done: false };
      case 'skipped':
        return { node: 'bg-surface-100 dark:bg-surface-800 text-surface-400', icon: 'pi-minus', text: 'text-surface-400', label: s.note ?? 'Not required', done: false };
    }
  }
}
