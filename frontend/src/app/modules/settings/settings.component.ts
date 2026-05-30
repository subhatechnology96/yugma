import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ThemeService, ThemeMode } from '@core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    TabsModule,
    ToggleSwitchModule,
    PageHeaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Account" title="Settings" subtitle="Personal preferences, security and notification controls."></app-page-header>

    <div class="card overflow-hidden">
      <p-tabs value="appearance">
        <p-tablist>
          <p-tab value="appearance">Appearance</p-tab>
          <p-tab value="notifications">Notifications</p-tab>
          <p-tab value="security">Security</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="appearance">
            <div class="p-2 space-y-6 max-w-2xl">
              <div>
                <div class="font-semibold mb-1">Theme</div>
                <div class="text-sm text-surface-500 mb-3">Choose how Yugma looks. System follows your OS setting.</div>
                <p-selectButton
                  [options]="themeOptions"
                  [ngModel]="theme.mode()"
                  (ngModelChange)="theme.set($event)"
                  optionLabel="label"
                  optionValue="value"
                />
              </div>
              <div>
                <div class="font-semibold mb-1">Density</div>
                <div class="text-sm text-surface-500 mb-3">Adjust spacing for tables and forms.</div>
                <p-selectButton
                  [options]="densityOptions"
                  [(ngModel)]="density"
                  optionLabel="label"
                  optionValue="value"
                />
              </div>
            </div>
          </p-tabpanel>
          <p-tabpanel value="notifications">
            <div class="p-2 space-y-4 max-w-2xl">
              @for (g of notifGroups; track g.key) {
                <div class="flex items-center justify-between py-2 border-b border-surface-200 dark:border-surface-800 last:border-0">
                  <div>
                    <div class="font-medium">{{ g.title }}</div>
                    <div class="text-sm text-surface-500">{{ g.subtitle }}</div>
                  </div>
                  <p-toggleswitch [(ngModel)]="g.enabled" />
                </div>
              }
            </div>
          </p-tabpanel>
          <p-tabpanel value="security">
            <div class="p-2 space-y-4 max-w-2xl">
              <div class="flex items-center justify-between py-3 border-b border-surface-200 dark:border-surface-800">
                <div>
                  <div class="font-medium">Two-factor authentication</div>
                  <div class="text-sm text-surface-500">Add a second step when signing in.</div>
                </div>
                <button pButton size="small" label="Configure"></button>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-surface-200 dark:border-surface-800">
                <div>
                  <div class="font-medium">Active sessions</div>
                  <div class="text-sm text-surface-500">3 devices · review and revoke access.</div>
                </div>
                <button pButton size="small" severity="secondary" [outlined]="true" label="Manage"></button>
              </div>
              <div class="flex items-center justify-between py-3">
                <div>
                  <div class="font-medium">API keys</div>
                  <div class="text-sm text-surface-500">Personal access tokens for the Yugma API.</div>
                </div>
                <button pButton size="small" severity="secondary" [outlined]="true" label="Create token"></button>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>
  `
})
export class SettingsComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly themeOptions: { label: string; value: ThemeMode }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' }
  ];
  protected readonly densityOptions = [
    { label: 'Comfortable', value: 'comfortable' },
    { label: 'Compact', value: 'compact' }
  ];
  protected density = 'comfortable';

  protected notifGroups = [
    { key: 'approvals', title: 'Approvals & assignments', subtitle: 'Workflow steps that need your action.', enabled: true },
    { key: 'mentions', title: 'Mentions', subtitle: 'When someone @-mentions you in a record.', enabled: true },
    { key: 'digests', title: 'Daily digest', subtitle: 'A summary of activity every morning.', enabled: false },
    { key: 'security', title: 'Security alerts', subtitle: 'New device sign-ins and policy changes.', enabled: true }
  ];
}
