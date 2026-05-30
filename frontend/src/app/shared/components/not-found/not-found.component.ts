import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid place-items-center bg-surface-50 dark:bg-surface-950 px-4">
      <div class="text-center max-w-md">
        <div class="text-7xl font-bold tracking-tight text-brand-600">404</div>
        <h1 class="mt-2 text-2xl font-semibold text-surface-900 dark:text-surface-50">
          We can't find that page
        </h1>
        <p class="mt-2 text-surface-600 dark:text-surface-400">
          The link may be broken, or the page may have been moved.
        </p>
        <a routerLink="/dashboard" class="mt-6 inline-block">
          <button pButton label="Back to dashboard" icon="pi pi-arrow-left"></button>
        </a>
      </div>
    </div>
  `
})
export class NotFoundComponent {}
