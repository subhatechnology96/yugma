import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { AiWidgetComponent } from '../ai-widget/ai-widget.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, AiWidgetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-surface-50 dark:bg-surface-950">
      <!-- Desktop sidebar -->
      <div class="hidden lg:block sticky top-0 self-start">
        <app-sidebar
          [collapsed]="collapsed()"
          (toggleCollapse)="toggleCollapse()"
        />
      </div>

      <!-- Mobile sidebar overlay -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden">
          <div class="absolute inset-0 bg-black/40" (click)="mobileOpen.set(false)"></div>
          <div class="absolute left-0 top-0 h-full">
            <app-sidebar [collapsed]="false" (toggleCollapse)="mobileOpen.set(false)" />
          </div>
        </div>
      }

      <div class="flex-1 min-w-0 flex flex-col">
        <app-topbar (toggleSidebar)="mobileOpen.set(true)" />
        <main class="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          <router-outlet />
        </main>
      </div>

      <app-ai-widget />
    </div>
  `
})
export class AppShellComponent {
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  toggleCollapse() {
    this.collapsed.update((c) => !c);
  }
}
