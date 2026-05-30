import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid lg:grid-cols-2 bg-surface-50 dark:bg-surface-950">
      <!-- Left brand panel -->
      <div class="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 text-white relative overflow-hidden">
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 20% 20%, white 1px, transparent 1px); background-size: 22px 22px;"></div>
        <div class="relative flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center font-bold">Y</div>
          <div class="font-semibold text-lg">Yugma</div>
        </div>
        <div class="relative max-w-md space-y-4">
          <h1 class="text-4xl font-bold leading-tight">The enterprise OS<br/>your business deserves.</h1>
          <p class="text-white/80">
            HR, accounts, materials, workflows and AI insights — unified into one
            premium SaaS console used by 4,200+ teams globally.
          </p>
          <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2"><i class="pi pi-check-circle"></i> SOC 2 Type II certified</li>
            <li class="flex items-center gap-2"><i class="pi pi-check-circle"></i> GDPR & DPDP compliant</li>
            <li class="flex items-center gap-2"><i class="pi pi-check-circle"></i> AI-powered insights, on by default</li>
          </ul>
        </div>
        <div class="relative text-xs text-white/60">© 2026 Yugma Technologies Pvt. Ltd.</div>
      </div>

      <!-- Right form panel -->
      <div class="flex flex-col items-center justify-center p-6 sm:p-10">
        <div class="w-full max-w-md">
          <div class="lg:hidden flex items-center gap-3 mb-8">
            <div class="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">Y</div>
            <div class="font-semibold text-lg">Yugma</div>
          </div>
          <div class="mb-6">
            <h2 class="text-2xl font-semibold tracking-tight">{{ title }}</h2>
            @if (subtitle) {
              <p class="mt-1 text-sm text-surface-600 dark:text-surface-400">{{ subtitle }}</p>
            }
          </div>
          <ng-content />
          @if (footerLinks?.length) {
            <div class="mt-6 text-center text-sm text-surface-500">
              @for (l of footerLinks!; track l.label) {
                <span>
                  {{ l.lead }}
                  <a [routerLink]="l.route" class="font-medium text-brand-600 hover:underline">{{ l.label }}</a>
                </span>
                @if (!$last) { <span class="mx-2 text-surface-300">·</span> }
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class AuthShellComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() footerLinks?: { lead: string; label: string; route: string }[];
}
