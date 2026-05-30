import { ChangeDetectionStrategy, Component, ElementRef, ViewChildren, QueryList, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [FormsModule, ButtonModule, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell
      title="Verify your phone"
      subtitle="We sent a 6-digit code to +91 ••••• 12233. It expires in 5 minutes."
      [footerLinks]="[{ lead: 'Didn’t get it?', label: 'Resend code', route: '/auth/otp' }]"
    >
      <div class="flex gap-2 justify-between">
        @for (i of [0,1,2,3,4,5]; track i) {
          <input
            #cell
            class="w-12 h-14 text-center text-lg font-semibold rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            maxlength="1"
            inputmode="numeric"
            pattern="[0-9]"
            [(ngModel)]="digits[i]"
            (keydown)="onKey($event, i)"
            (input)="onInput($event, i)"
          />
        }
      </div>
      <button pButton class="w-full mt-6" label="Verify and continue" (click)="submit()" [loading]="loading()"></button>
    </app-auth-shell>
  `
})
export class OtpComponent {
  @ViewChildren('cell') cells!: QueryList<ElementRef<HTMLInputElement>>;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected digits: string[] = ['', '', '', '', '', ''];
  protected readonly loading = signal(false);

  onInput(e: Event, idx: number) {
    const v = (e.target as HTMLInputElement).value;
    if (v && idx < 5) this.cells.toArray()[idx + 1].nativeElement.focus();
  }
  onKey(e: KeyboardEvent, idx: number) {
    if (e.key === 'Backspace' && !this.digits[idx] && idx > 0) {
      this.cells.toArray()[idx - 1].nativeElement.focus();
    }
  }
  submit() {
    if (this.digits.join('').length < 6) return;
    this.loading.set(true);
    this.auth.verifyOtp({ phone: '+919820312233', code: this.digits.join('') }).subscribe(() => {
      this.loading.set(false);
      void this.router.navigateByUrl('/dashboard');
    });
  }
}
