import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export type KpiTrend = 'up' | 'down' | 'flat';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="card p-5 flex flex-col gap-3 h-full transition-all"
      [class.cursor-pointer]="interactive"
      [class.hover:shadow-md]="interactive"
      [class.hover:-translate-y-0.5]="interactive"
      [class.ring-2]="interactive && active"
      [class.ring-brand-500]="interactive && active"
      [class.ring-offset-1]="interactive && active"
      [attr.role]="interactive ? 'button' : null"
      [attr.tabindex]="interactive ? 0 : null"
      [attr.aria-pressed]="interactive ? active : null"
      (click)="onActivate()"
      (keydown.enter)="onActivate()"
      (keydown.space)="onActivate(); $event.preventDefault()"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-surface-600 dark:text-surface-400">{{ label }}</span>
        <span
          class="w-9 h-9 rounded-xl grid place-items-center"
          [class]="iconBgClass()"
        >
          <i class="pi {{ icon }} text-base" [class]="iconColorClass()"></i>
        </span>
      </div>
      <div class="flex items-end justify-between gap-3">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-surface-900 dark:text-surface-50">
            {{ prefix }}{{ value | number: format }}{{ suffix }}
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{{ caption }}</div>
        </div>
        @if (delta !== undefined) {
          <div
            class="text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-full"
            [class]="trendBadgeClass()"
          >
            <i class="pi" [class.pi-arrow-up-right]="trend === 'up'" [class.pi-arrow-down-right]="trend === 'down'" [class.pi-minus]="trend === 'flat'"></i>
            {{ delta | number: '1.0-2' }}%
          </div>
        }
      </div>
    </div>
  `
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() caption = '';
  @Input() icon = 'pi-chart-line';
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() format = '1.0-0';
  @Input() delta?: number;
  @Input() trend: KpiTrend = 'up';
  @Input() tone: 'brand' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky' = 'brand';
  /** When true, the card is rendered as a clickable button and emits `cardClick`. */
  @Input() interactive = false;
  /** Highlights the card with a ring to show it's the current selection. */
  @Input() active = false;
  @Output() cardClick = new EventEmitter<void>();

  onActivate() {
    if (this.interactive) this.cardClick.emit();
  }

  iconBgClass() {
    return {
      brand: 'bg-brand-50 dark:bg-brand-500/15',
      emerald: 'bg-emerald-50 dark:bg-emerald-500/15',
      amber: 'bg-amber-50 dark:bg-amber-500/15',
      rose: 'bg-rose-50 dark:bg-rose-500/15',
      indigo: 'bg-indigo-50 dark:bg-indigo-500/15',
      sky: 'bg-sky-50 dark:bg-sky-500/15'
    }[this.tone];
  }
  iconColorClass() {
    return {
      brand: 'text-brand-600 dark:text-brand-300',
      emerald: 'text-emerald-600 dark:text-emerald-300',
      amber: 'text-amber-600 dark:text-amber-300',
      rose: 'text-rose-600 dark:text-rose-300',
      indigo: 'text-indigo-600 dark:text-indigo-300',
      sky: 'text-sky-600 dark:text-sky-300'
    }[this.tone];
  }
  trendBadgeClass() {
    if (this.trend === 'up') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (this.trend === 'down') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300';
    return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300';
  }
}
