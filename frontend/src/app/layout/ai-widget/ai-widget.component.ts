import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

interface ChatMsg {
  who: 'user' | 'ai';
  text: string;
  at: Date;
}

const STARTERS = [
  'Summarise today’s key approvals',
  'Why is gross margin down vs last month?',
  'Forecast headcount needs for Q3'
];

@Component({
  selector: 'app-ai-widget',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed bottom-24 right-6 z-30 w-[22rem] max-w-[calc(100vw-2rem)] h-[28rem] flex flex-col rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl overflow-hidden">
        <div class="px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white flex items-center gap-2">
          <i class="pi pi-sparkles"></i>
          <span class="font-semibold text-sm">Yugma AI Assistant</span>
          <span class="ml-auto text-[10px] uppercase tracking-wider opacity-80">Beta</span>
          <button class="ml-2 opacity-90 hover:opacity-100" (click)="close()">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50 dark:bg-surface-950/40">
          @for (m of messages(); track $index) {
            <div [class]="m.who === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div [class]="
                m.who === 'user'
                  ? 'bg-brand-600 text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[80%] text-sm'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] text-sm'
              ">
                {{ m.text }}
              </div>
            </div>
          }
          @if (messages().length === 0) {
            <div class="text-xs text-surface-500 mb-2">Try one of these:</div>
            <div class="flex flex-col gap-2">
              @for (s of starters; track s) {
                <button class="text-left text-xs px-3 py-2 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-brand-300"
                  (click)="send(s)">
                  {{ s }}
                </button>
              }
            </div>
          }
        </div>
        <div class="p-3 border-t border-surface-200 dark:border-surface-800 flex gap-2">
          <input
            pInputText
            class="flex-1 !rounded-lg"
            placeholder="Ask anything…"
            [(ngModel)]="draft"
            (keydown.enter)="send(draft)"
          />
          <button pButton icon="pi pi-send" (click)="send(draft)"></button>
        </div>
      </div>
    }

    <button
      type="button"
      (click)="toggle()"
      class="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full shadow-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white grid place-items-center hover:scale-105 transition"
      aria-label="Open AI assistant"
    >
      <i class="pi pi-sparkles text-xl"></i>
    </button>
  `
})
export class AiWidgetComponent {
  protected readonly open = signal(false);
  protected readonly messages = signal<ChatMsg[]>([]);
  protected readonly starters = STARTERS;
  protected draft = '';

  toggle() {
    this.open.update((v) => !v);
  }
  close() {
    this.open.set(false);
  }
  send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.messages.update((m) => [...m, { who: 'user', text: trimmed, at: new Date() }]);
    this.draft = '';
    // Mocked AI reply — wire to backend /ai/chat
    setTimeout(() => {
      const reply = this.fakeAnswer(trimmed);
      this.messages.update((m) => [...m, { who: 'ai', text: reply, at: new Date() }]);
    }, 450);
  }

  private fakeAnswer(q: string): string {
    if (/margin/i.test(q))
      return 'Gross margin is down 2.4 pp month-over-month, driven mainly by a 6% rise in raw-material costs in the Pune warehouse. Consider renegotiating the MAT-019x SKU group with Vendor V-014.';
    if (/headcount|hire|hiring/i.test(q))
      return 'Based on current pipeline velocity and a 7% attrition trend, you’ll need ~12 additional FTEs by end of Q3 — predominantly Engineering (8) and Customer Success (3).';
    if (/approval/i.test(q))
      return 'You have 4 pending approvals: 1 PO above your auto-approve threshold, 2 leave requests, and 1 vendor onboarding. Open the Workflows page for details.';
    return 'I can help with KPIs, approvals, forecasts and policy lookups. Connect me to the /ai/chat endpoint for live answers.';
  }
}
