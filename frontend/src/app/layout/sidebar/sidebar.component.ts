import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { NAV_ITEMS, NavItem } from '../nav-items';
import { TenantService } from '@core/services/tenant.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="h-screen flex flex-col bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-[width] duration-200 ease-out"
      [class.w-64]="!collapsed()"
      [class.w-[72px]]="collapsed()"
    >
      <!-- Brand -->
      <div class="h-16 flex items-center gap-3 px-4 border-b border-surface-200 dark:border-surface-800">
        <div class="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold shrink-0">
          Y
        </div>
        @if (!collapsed()) {
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">{{ tenant.current().name }}</div>
            <div class="text-[11px] uppercase tracking-wider text-surface-500">
              {{ tenant.current().plan }} plan
            </div>
          </div>
        }
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        @for (group of groups(); track group.name) {
          <div>
            @if (!collapsed()) {
              <div class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
                {{ group.name }}
              </div>
            } @else {
              <div class="border-t border-surface-200 dark:border-surface-800 mx-2 my-2"></div>
            }
            <ul class="space-y-0.5">
              @for (item of group.items; track item.label) {
                <li>
                  @if (item.children?.length) {
                    <button
                      type="button"
                      (click)="toggle(item.label)"
                      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition"
                      [pTooltip]="collapsed() ? item.label : ''"
                      tooltipPosition="right"
                    >
                      <i class="pi {{ item.icon }} text-base shrink-0"></i>
                      @if (!collapsed()) {
                        <span class="flex-1 text-left">{{ item.label }}</span>
                        <i class="pi text-xs transition-transform" [class.pi-chevron-down]="isOpen(item.label)" [class.pi-chevron-right]="!isOpen(item.label)"></i>
                      }
                    </button>
                    @if (!collapsed() && isOpen(item.label)) {
                      <ul class="mt-0.5 ml-3 pl-3 border-l border-surface-200 dark:border-surface-800 space-y-0.5">
                        @for (child of item.children; track child.label) {
                          <li>
                            <a
                              [routerLink]="child.route"
                              routerLinkActive="bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold"
                              class="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition"
                            >
                              <i class="pi {{ child.icon }} text-sm"></i>
                              <span class="truncate">{{ child.label }}</span>
                            </a>
                          </li>
                        }
                      </ul>
                    }
                  } @else {
                    <a
                      [routerLink]="item.route"
                      routerLinkActive="bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200/60 dark:border-brand-500/30"
                      [routerLinkActiveOptions]="{ exact: false }"
                      class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition"
                      [pTooltip]="collapsed() ? item.label : ''"
                      tooltipPosition="right"
                    >
                      <i class="pi {{ item.icon }} text-base shrink-0"></i>
                      @if (!collapsed()) {
                        <span class="flex-1 truncate">{{ item.label }}</span>
                        @if (item.badge) {
                          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            [class]="badgeTone(item.badgeTone)">
                            {{ item.badge }}
                          </span>
                        }
                      }
                    </a>
                  }
                </li>
              }
            </ul>
          </div>
        }
      </nav>

      <!-- Footer / collapse -->
      <div class="border-t border-surface-200 dark:border-surface-800 p-3 flex" [class.justify-center]="collapsed()" [class.justify-between]="!collapsed()">
        @if (!collapsed()) {
          <div class="text-[11px] text-surface-500">v0.1 · Build 1187</div>
        }
        <button
          type="button"
          (click)="toggleCollapse.emit()"
          class="w-8 h-8 rounded-lg grid place-items-center text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
          [pTooltip]="collapsed() ? 'Expand' : 'Collapse'"
          tooltipPosition="right"
        >
          <i class="pi" [class.pi-angle-double-left]="!collapsed()" [class.pi-angle-double-right]="collapsed()"></i>
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  protected readonly tenant = inject(TenantService);
  readonly collapsed = input<boolean>(false);
  readonly toggleCollapse = output<void>();

  private readonly openGroups = signal<Set<string>>(new Set(['HR']));

  readonly groups = computed(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of NAV_ITEMS) {
      const g = item.group ?? 'General';
      const list = map.get(g) ?? [];
      list.push(item);
      map.set(g, list);
    }
    return Array.from(map, ([name, items]) => ({ name, items }));
  });

  isOpen(label: string) {
    return this.openGroups().has(label);
  }
  toggle(label: string) {
    const next = new Set(this.openGroups());
    next.has(label) ? next.delete(label) : next.add(label);
    this.openGroups.set(next);
  }

  badgeTone(tone?: 'info' | 'success' | 'warn' | 'danger') {
    switch (tone) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
      case 'warn':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
      case 'danger':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
      default:
        return 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300';
    }
  }
}
