import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const THEME_KEY = 'crm.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.restore());
  readonly mode = this._mode.asReadonly();
  readonly isDark = computed(() => this.resolve(this._mode()) === 'dark');

  constructor() {
    effect(() => {
      const mode = this._mode();
      const dark = this.resolve(mode) === 'dark';
      document.documentElement.classList.toggle('app-dark', dark);
      localStorage.setItem(THEME_KEY, mode);
    });

    // React to OS theme changes while in 'system' mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (this._mode() === 'system') {
        document.documentElement.classList.toggle('app-dark', mq.matches);
      }
    });
  }

  set(mode: ThemeMode) {
    this._mode.set(mode);
  }

  toggle() {
    this._mode.set(this.isDark() ? 'light' : 'dark');
  }

  private resolve(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }

  private restore(): ThemeMode {
    const v = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return v ?? 'system';
  }
}
