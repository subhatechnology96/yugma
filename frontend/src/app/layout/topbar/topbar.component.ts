import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MenuItem } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';

import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { TenantService } from '@core/services/tenant.service';
import { NotificationService } from '@core/services/notification.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    NgClass,
    ButtonModule,
    InputTextModule,
    PopoverModule,
    MenuModule,
    TooltipModule,
    DividerModule,
    AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="h-16 sticky top-0 z-20 flex items-center gap-3 px-4 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
      <button
        type="button"
        (click)="toggleSidebar.emit()"
        class="w-10 h-10 rounded-lg grid place-items-center text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 lg:hidden"
      >
        <i class="pi pi-bars"></i>
      </button>

      <!-- Global search -->
      <div class="flex-1 max-w-xl">
        <span class="p-input-icon-left w-full block relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
          <input
            pInputText
            [(ngModel)]="query"
            (keydown.enter)="onSearch()"
            type="text"
            placeholder="Search employees, invoices, vendors, workflows…   ⌘K"
            class="w-full !pl-10 !rounded-xl !bg-surface-100 dark:!bg-surface-800 !border-transparent focus:!bg-white dark:focus:!bg-surface-900"
          />
        </span>
      </div>

      <!-- Tenant switcher -->
      <button
        type="button"
        (click)="tenantPanel.toggle($event)"
        class="hidden md:flex items-center gap-2 px-3 h-10 rounded-lg border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800"
      >
        <span class="w-6 h-6 rounded-md bg-brand-600 text-white grid place-items-center text-[10px] font-bold">
          {{ tenant.current().shortName }}
        </span>
        <span class="text-sm font-medium">{{ tenant.current().name }}</span>
        <i class="pi pi-chevron-down text-xs text-surface-400"></i>
      </button>
      <p-popover #tenantPanel styleClass="!rounded-xl">
        <div class="w-72 p-1">
          <div class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-surface-500">
            Switch tenant
          </div>
          @for (t of tenant.tenants(); track t.id) {
            <button
              type="button"
              (click)="tenant.switch(t.id); tenantPanel.hide()"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-left"
            >
              <span class="w-7 h-7 rounded-md bg-brand-600 text-white grid place-items-center text-[10px] font-bold">{{ t.shortName }}</span>
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-medium truncate">{{ t.name }}</span>
                <span class="block text-[11px] text-surface-500 uppercase tracking-wider">{{ t.plan }}</span>
              </span>
              @if (t.id === tenant.current().id) {
                <i class="pi pi-check text-brand-600"></i>
              }
            </button>
          }
        </div>
      </p-popover>

      <!-- Theme toggle -->
      <button
        type="button"
        (click)="theme.toggle()"
        class="w-10 h-10 rounded-lg grid place-items-center text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
        pTooltip="Toggle theme"
        tooltipPosition="bottom"
      >
        <i class="pi" [ngClass]="theme.isDark() ? 'pi-sun' : 'pi-moon'"></i>
      </button>

      <!-- AI assistant -->
      <button
        type="button"
        [routerLink]="['/ai-assistant']"
        class="hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-sm font-medium shadow-soft hover:opacity-95"
      >
        <i class="pi pi-sparkles"></i>
        <span>Ask AI</span>
      </button>

      <!-- Notifications -->
      <button
        type="button"
        (click)="notifPanel.toggle($event)"
        class="relative w-10 h-10 rounded-lg grid place-items-center text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
        pTooltip="Notifications"
        tooltipPosition="bottom"
      >
        <i class="pi pi-bell"></i>
        @if (notifications.unreadCount() > 0) {
          <span class="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-semibold grid place-items-center px-1">
            {{ notifications.unreadCount() }}
          </span>
        }
      </button>
      <p-popover #notifPanel styleClass="!rounded-xl">
        <div class="w-96 max-h-[28rem] overflow-y-auto p-1">
          <div class="flex items-center justify-between px-3 py-2">
            <div class="text-sm font-semibold">Notifications</div>
            <button (click)="notifications.markAllRead()" class="text-xs font-medium text-brand-600 hover:underline">
              Mark all as read
            </button>
          </div>
          @for (n of notifications.items(); track n.id) {
            <a [routerLink]="n.link" (click)="notifPanel.hide(); notifications.markRead(n.id)"
              class="block px-3 py-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition">
              <div class="flex gap-3">
                <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" [ngClass]="dot(n.kind)"></span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium" [class.text-surface-500]="n.read">{{ n.title }}</div>
                  <div class="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{{ n.message }}</div>
                  <div class="text-[10px] uppercase tracking-wider text-surface-400 mt-1">{{ n.createdAt | date: 'short' }}</div>
                </div>
              </div>
            </a>
          }
        </div>
      </p-popover>

      <!-- Profile -->
      <button
        type="button"
        (click)="profileMenu.toggle($event)"
        class="flex items-center gap-2 h-10 pl-1 pr-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800"
      >
        <app-avatar [name]="user()?.fullName ?? 'User'" size="sm" />
        <span class="hidden md:block text-sm font-medium">{{ user()?.fullName }}</span>
        <i class="pi pi-chevron-down text-xs text-surface-400 hidden md:block"></i>
      </button>
      <p-menu #profileMenu [model]="profileMenuItems()" [popup]="true" styleClass="!rounded-xl !min-w-[14rem]" />
    </header>
  `
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly tenant = inject(TenantService);
  protected readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();
  protected readonly user = this.auth.user;
  protected query = '';

  readonly profileMenuItems = computed<MenuItem[]>(() => [
    { label: this.user()?.email, disabled: true, styleClass: 'opacity-60 !text-xs' },
    { separator: true },
    { label: 'My profile', icon: 'pi pi-user', routerLink: ['/settings'] },
    { label: 'Preferences', icon: 'pi pi-sliders-h', routerLink: ['/settings'] },
    { label: 'API keys', icon: 'pi pi-key', routerLink: ['/configuration'] },
    { separator: true },
    {
      label: 'Sign out',
      icon: 'pi pi-sign-out',
      styleClass: '!text-rose-600',
      command: () => this.auth.logout()
    }
  ]);

  onSearch() {
    const q = this.query.trim();
    if (!q) return;
    void this.router.navigate(['/reports'], { queryParams: { q } });
  }

  dot(kind: 'info' | 'success' | 'warn' | 'danger') {
    return {
      info: 'bg-brand-500',
      success: 'bg-emerald-500',
      warn: 'bg-amber-500',
      danger: 'bg-rose-500'
    }[kind];
  }
}
