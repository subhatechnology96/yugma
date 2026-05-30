import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';

@Component({
  selector: 'app-forgot',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell
      title="Reset your password"
      subtitle="Enter your work email and we'll send a secure link to reset your password."
      [footerLinks]="[{ lead: 'Remembered it?', label: 'Back to sign in', route: '/auth/login' }]"
    >
      @if (!sent()) {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Work email</label>
            <input pInputText formControlName="email" type="email" class="w-full !rounded-lg" placeholder="you@company.com" />
          </div>
          <button pButton type="submit" class="w-full" label="Send reset link"></button>
        </form>
      } @else {
        <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-5">
          <div class="flex gap-3">
            <i class="pi pi-check-circle text-2xl text-emerald-600"></i>
            <div>
              <div class="font-semibold">Check your inbox</div>
              <div class="text-sm text-surface-600 dark:text-surface-300 mt-1">
                If <b>{{ form.value.email }}</b> matches an account, you'll receive a reset link within a minute.
              </div>
            </div>
          </div>
        </div>
      }
    </app-auth-shell>
  `
})
export class ForgotComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly sent = signal(false);
  protected readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  submit() {
    if (this.form.invalid) return;
    this.sent.set(true);
  }
}
