import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    DividerModule,
    AuthShellComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell
      title="Welcome back"
      subtitle="Sign in to your Yugma workspace to continue."
      [footerLinks]="[{ lead: 'New here?', label: 'Create an account', route: '/auth/register' }]"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Work email</label>
          <input pInputText formControlName="email" type="email" class="w-full !rounded-lg" placeholder="you@company.com" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium">Password</label>
            <a routerLink="/auth/forgot" class="text-xs font-medium text-brand-600 hover:underline">Forgot?</a>
          </div>
          <p-password formControlName="password" [toggleMask]="true" [feedback]="false" inputStyleClass="w-full !rounded-lg" styleClass="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <p-checkbox formControlName="rememberMe" [binary]="true" inputId="rm" />
          <label for="rm" class="text-sm">Keep me signed in for 30 days</label>
        </div>
        <button pButton type="submit" class="w-full" [loading]="loading()" label="Sign in"></button>

        <p-divider align="center" styleClass="!my-5"><span class="text-xs text-surface-500">or continue with</span></p-divider>

        <div class="grid grid-cols-3 gap-2">
          <button type="button" pButton severity="secondary" outlined icon="pi pi-google" label="Google"></button>
          <button type="button" pButton severity="secondary" outlined icon="pi pi-microsoft" label="Microsoft"></button>
          <button type="button" pButton severity="secondary" outlined icon="pi pi-mobile" label="OTP" (click)="goOtp()"></button>
        </div>

        <div class="mt-5 rounded-lg bg-surface-50 dark:bg-surface-800/50 p-3 text-xs text-surface-600 dark:text-surface-400">
          <div class="font-medium mb-1.5 text-surface-700 dark:text-surface-300"><i class="pi pi-info-circle mr-1"></i>Demo logins — password <code class="bg-surface-200 dark:bg-surface-700 px-1 rounded">Yugma&#64;123</code></div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <button type="button" class="text-left hover:text-brand-600" (click)="use('owner@yugma.io')">owner&#64;yugma.io · Owner</button>
            <button type="button" class="text-left hover:text-brand-600" (click)="use('admin@yugma.io')">admin&#64;yugma.io · Admin</button>
            <button type="button" class="text-left hover:text-brand-600" (click)="use('manager@yugma.io')">manager&#64;yugma.io · Manager</button>
            <button type="button" class="text-left hover:text-brand-600" (click)="use('associate@yugma.io')">associate&#64;yugma.io · Associate</button>
          </div>
        </div>
      </form>
    </app-auth-shell>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);

  protected readonly loading = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['demo@yugma.io', [Validators.required, Validators.email]],
    password: ['demo-password', Validators.required],
    rememberMe: [true]
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const ret = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(ret);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: 'Sign-in failed', detail: 'Check your credentials and try again.' });
      }
    });
  }

  use(email: string) {
    this.form.patchValue({ email, password: 'Yugma@123' });
  }

  goOtp() {
    void this.router.navigate(['/auth/otp']);
  }
}
