import { ChangeDetectionStrategy, Component, Input, computed, input } from '@angular/core';

export type StatusTone = 'success' | 'warn' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="pillClass()">
      <span class="w-1.5 h-1.5 rounded-full" [class]="dotClass()"></span>
      <ng-content />
    </span>
  `
})
export class StatusPillComponent {
  readonly tone = input<StatusTone>('neutral');

  pillClass = computed(() => {
    const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';
    return base + ' ' + this.toneColors()[0];
  });
  dotClass = computed(() => this.toneColors()[1]);

  private toneColors(): [string, string] {
    switch (this.tone()) {
      case 'success':
        return ['bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', 'bg-emerald-500'];
      case 'warn':
        return ['bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300', 'bg-amber-500'];
      case 'danger':
        return ['bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300', 'bg-rose-500'];
      case 'info':
        return ['bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300', 'bg-brand-500'];
      default:
        return ['bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300', 'bg-surface-500'];
    }
  }
}
