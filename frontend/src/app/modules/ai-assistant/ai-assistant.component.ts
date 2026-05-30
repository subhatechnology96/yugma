import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

interface Msg {
  who: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="AI · Beta" title="AI Assistant" subtitle="Ask anything about your business — KPIs, approvals, policies, forecasts."></app-page-header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Conversation -->
      <div class="card flex flex-col h-[70vh] lg:col-span-2 overflow-hidden">
        <div class="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-50 dark:bg-surface-950/40">
          @for (m of messages(); track $index) {
            <div [class]="m.who === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div [class]="
                m.who === 'user'
                  ? 'bg-brand-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]'
              ">
                {{ m.text }}
              </div>
            </div>
          }
          @if (messages().length === 0) {
            <div class="h-full grid place-items-center text-center">
              <div>
                <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white grid place-items-center mb-3">
                  <i class="pi pi-sparkles text-xl"></i>
                </div>
                <div class="font-semibold">Yugma AI Assistant</div>
                <div class="text-sm text-surface-500 mt-1 max-w-sm">
                  I can summarise dashboards, draft emails, explain variances or forecast outcomes. Start with a question below.
                </div>
              </div>
            </div>
          }
        </div>
        <div class="p-3 border-t border-surface-200 dark:border-surface-800 flex gap-2">
          <input pInputText class="flex-1 !rounded-lg" placeholder="Ask anything…" [(ngModel)]="draft" (keydown.enter)="send(draft)" />
          <button pButton icon="pi pi-send" (click)="send(draft)"></button>
        </div>
      </div>

      <!-- Suggestions -->
      <div class="space-y-4">
        <div class="card p-5">
          <div class="section-title mb-3">Suggested for you</div>
          <ul class="space-y-2">
            @for (s of suggestions; track s) {
              <li>
                <button class="w-full text-left text-sm px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-800 hover:border-brand-300 transition"
                  (click)="send(s)">
                  {{ s }}
                </button>
              </li>
            }
          </ul>
        </div>
        <div class="card p-5">
          <div class="section-title mb-2">Capabilities</div>
          <ul class="text-sm space-y-2 text-surface-600 dark:text-surface-300">
            <li>📊 Live KPI summaries</li>
            <li>🔮 Predictive forecasts</li>
            <li>📝 Draft policies and emails</li>
            <li>⚠️ Anomaly detection</li>
            <li>🎯 Smart recommendations</li>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class AiAssistantComponent {
  protected readonly messages = signal<Msg[]>([]);
  protected draft = '';
  protected readonly suggestions = [
    'Summarise revenue performance vs target this quarter.',
    'Which 3 employees are most at risk of attrition?',
    'Why did inventory holding cost increase last month?',
    'Draft a policy reminder about expense reimbursements.'
  ];

  send(t: string) {
    const v = t.trim();
    if (!v) return;
    this.messages.update((m) => [...m, { who: 'user', text: v }]);
    this.draft = '';
    setTimeout(() => {
      this.messages.update((m) => [
        ...m,
        { who: 'ai', text: 'Connected to /ai/chat — this is a mocked response. Wire to the backend AI service to enable live answers.' }
      ]);
    }, 350);
  }
}
