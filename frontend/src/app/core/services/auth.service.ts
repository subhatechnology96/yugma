import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AuthSession,
  LoginRequest,
  MfaVerifyRequest,
  OtpVerifyRequest
} from '../models/auth.models';

const SESSION_KEY = 'crm.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _session = signal<AuthSession | null>(this.restore());
  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly accessToken = computed(() => this._session()?.tokens.accessToken ?? null);

  login(req: LoginRequest): Observable<AuthSession> {
    // Real server-side auth: POST /api/auth/login validates the password hash and
    // returns a signed JWT carrying the user's role + tenant.
    return this.http
      .post<AuthSession>(`${environment.apiBaseUrl}/auth/login`, req)
      .pipe(tap((s) => this.persist(s)));
  }

  verifyOtp(_req: OtpVerifyRequest): Observable<AuthSession> {
    // OTP/MFA flows are not yet backed by the server; route through password login.
    return this.login({ email: _req.phone, password: '' });
  }

  verifyMfa(_req: MfaVerifyRequest): Observable<AuthSession> {
    return this.login({ email: '', password: '' });
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this._session.set(null);
    void this.router.navigate(['/auth/login']);
  }

  hasPermission(perm: string): boolean {
    const u = this.user();
    if (!u) return false;
    return u.permissions.includes('*') || u.permissions.includes(perm);
  }

  private persist(s: AuthSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    this._session.set(s);
  }

  private restore(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
