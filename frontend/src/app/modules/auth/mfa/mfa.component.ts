import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-mfa',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell
      title="Two-factor verification"
      subtitle="Open your authenticator app (Google Authenticator, Authy or 1Password) and enter the 6-digit code."
    >
      <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-4 mb-4 flex gap-3">
        <i class="pi pi-shield text-brand-600 text-xl"></i>
        <div class="text-sm">
          <div class="font-medium">Why is this needed?</div>
          <div class="text-surface-500">Your admin has enforced 2FA for all admin actions on this workspace.</div>
        </div>
      </div>
      <label class="block text-sm font-medium mb-1">Authenticator code</label>
      <input pInputText [(ngModel)]="code" class="w-full !rounded-lg !text-lg !tracking-widest text-center" inputmode="numeric" maxlength="6" placeholder="••••••" />
      <button pButton class="w-full mt-5" label="Verify" (click)="submit()" [loading]="loading()"></button>
      <button pButton text class="w-full mt-2" label="Use a backup code"></button>
    </app-auth-shell>
  `
})
export class MfaComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected code = '';
  protected readonly loading = signal(false);
  submit() {
    if (this.code.length < 6) return;
    this.loading.set(true);
    this.auth.verifyMfa({ challengeId: 'ch_demo', code: this.code }).subscribe(() => {
      this.loading.set(false);
      void this.router.navigateByUrl('/dashboard');
    });
  }
}
