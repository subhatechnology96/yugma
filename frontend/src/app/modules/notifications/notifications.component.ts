import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { NotificationService } from '@core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, ButtonModule, PageHeaderComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Inbox" title="Notifications" subtitle="System alerts, approvals, mentions and reminders.">
      <button pButton severity="secondary" outlined label="Mark all as read" (click)="svc.markAllRead()"></button>
    </app-page-header>

    <div class="card divide-y divide-surface-200 dark:divide-surface-800">
      @for (n of svc.items(); track n.id) {
        <div class="p-4 flex gap-4 items-start" [class.opacity-70]="n.read">
          <span class="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-surface-100 dark:bg-surface-800">
            <i class="pi pi-bell"></i>
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="font-semibold">{{ n.title }}</div>
              <app-status-pill [tone]="n.kind === 'success' ? 'success' : n.kind === 'warn' ? 'warn' : n.kind === 'danger' ? 'danger' : 'info'">
                {{ n.kind | titlecase }}
              </app-status-pill>
            </div>
            <div class="text-sm text-surface-600 dark:text-surface-300 mt-0.5">{{ n.message }}</div>
            <div class="text-xs text-surface-500 mt-1">{{ n.createdAt | date: 'medium' }}</div>
          </div>
          @if (!n.read) {
            <button pButton text size="small" label="Mark read" (click)="svc.markRead(n.id)"></button>
          }
        </div>
      }
    </div>
  `
})
export class NotificationsComponent {
  protected readonly svc = inject(NotificationService);
}
