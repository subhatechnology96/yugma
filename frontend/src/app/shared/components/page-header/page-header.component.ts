import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div class="text-xs font-medium uppercase tracking-wider text-surface-500 dark:text-surface-400">
          {{ eyebrow }}
        </div>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-surface-900 dark:text-surface-50">
          {{ title }}
        </h1>
        @if (subtitle) {
          <p class="mt-1 text-sm text-surface-600 dark:text-surface-400 max-w-2xl">{{ subtitle }}</p>
        }
      </div>
      <div class="flex items-center gap-2">
        <ng-content />
      </div>
    </div>
  `
})
export class PageHeaderComponent {
  @Input() eyebrow = '';
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
