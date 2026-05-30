import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div class="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 grid place-items-center mb-4">
        <i class="pi {{ icon }} text-2xl text-surface-500 dark:text-surface-400"></i>
      </div>
      <h3 class="text-base font-semibold text-surface-800 dark:text-surface-100">{{ title }}</h3>
      @if (description) {
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1 max-w-md">{{ description }}</p>
      }
      <div class="mt-4">
        <ng-content />
      </div>
    </div>
  `
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() icon = 'pi-inbox';
}
