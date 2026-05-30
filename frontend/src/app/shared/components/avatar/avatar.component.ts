import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (image()) {
      <img
        [src]="image()!"
        [alt]="name()"
        [class]="sizeClass() + ' rounded-full object-cover'"
      />
    } @else {
      <span [class]="sizeClass() + ' rounded-full grid place-items-center font-semibold ' + bgClass()">
        {{ initials() }}
      </span>
    }
  `
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly image = input<string | undefined>(undefined);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('md');

  initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  sizeClass = computed(
    () =>
      ({
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base'
      }[this.size()])
  );

  bgClass = computed(() => {
    const palette = [
      'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
      'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
      'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200'
    ];
    let hash = 0;
    for (const c of this.name()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  });
}
