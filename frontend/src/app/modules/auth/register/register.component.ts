import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell
      title="Create your workspace"
      subtitle="Start a 30-day trial. No credit card required."
      [footerLinks]="[{ lead: 'Already on Yugma?', label: 'Sign in', route: '/auth/login' }]"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">First name</label>
            <input pInputText formControlName="firstName" class="w-full !rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Last name</label>
            <input pInputText formControlName="lastName" class="w-full !rounded-lg" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Company</label>
          <input pInputText formControlName="company" class="w-full !rounded-lg" placeholder="Yugma" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Work email</label>
          <input pInputText formControlName="email" type="email" class="w-full !rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Password</label>
          <p-password formControlName="password" [toggleMask]="true" inputStyleClass="w-full !rounded-lg" styleClass="w-full" />
        </div>
        <button pButton type="submit" class="w-full" label="Create workspace"></button>
        <p class="text-xs text-surface-500 text-center">
          By continuing you agree to our <a class="text-brand-600 hover:underline" href="#">Terms</a> and
          <a class="text-brand-600 hover:underline" href="#">Privacy Policy</a>.
        </p>
      </form>
    </app-auth-shell>
  `
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    company: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    if (this.form.invalid) return;
    void this.router.navigate(['/auth/otp']);
  }
}
