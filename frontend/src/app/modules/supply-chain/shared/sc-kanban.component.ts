import { ChangeDetectionStrategy, Component, ContentChild, EventEmitter, Input, Output, TemplateRef, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

export interface KanbanStage { key: string; label: string; dot: string; bar: string; }

/**
 * Generic supply-chain kanban board. Pass stages + items (each with `id` and a stage field),
 * project a card template (let-item), and listen for stage moves and card clicks.
 */
@Component({
  selector: 'app-sc-kanban',
  standalone: true,
  imports: [DragDropModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-2">
      <div class="flex gap-4 overflow-x-auto pb-1" cdkDropListGroup>
        @for (col of stages; track col.key) {
          <div class="min-w-[270px] flex-1 flex flex-col">
            <div class="px-1 mb-2 flex items-center justify-between">
              <span class="text-[13px] font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full" [class]="col.dot"></span>{{ col.label }}<span class="text-xs text-surface-400 tabular-nums">{{ board()[col.key]?.length || 0 }}</span></span>
            </div>
            <div class="rounded-xl p-1.5 space-y-2 flex-1 min-h-[340px] bg-surface-50/60 dark:bg-surface-900/30"
              cdkDropList [cdkDropListData]="board()[col.key]" (cdkDropListDropped)="drop($event, col.key)">
              @for (item of board()[col.key]; track item.id) {
                <div class="bg-white dark:bg-surface-900 rounded-lg p-3 border border-surface-200/80 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition cursor-pointer"
                  cdkDrag (click)="cardClick.emit(item)">
                  <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: item }"></ng-container>
                </div>
              }
              @if (!board()[col.key]?.length) { <div class="text-center text-[11px] text-surface-300 py-10 select-none">—</div> }
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ScKanbanComponent {
  @Input({ required: true }) stages: KanbanStage[] = [];
  @Input() stageField = 'stage';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() set items(v: any[]) { this._items.set(v ?? []); }
  @ContentChild(TemplateRef) cardTemplate!: TemplateRef<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() stageChange = new EventEmitter<{ item: any; stage: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() cardClick = new EventEmitter<any>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _items = signal<any[]>([]);
  protected readonly board = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: Record<string, any[]> = {};
    for (const s of this.stages) b[s.key] = [];
    for (const it of this._items()) {
      const k = String(it[this.stageField]);
      (b[k] ?? (b[k] = [])).push(it);
    }
    return b;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drop(event: CdkDragDrop<any[]>, target: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const item = event.previousContainer.data[event.previousIndex];
    if (String(item[this.stageField]) === target) return;
    event.previousContainer.data.splice(event.previousIndex, 1);
    event.container.data.splice(event.currentIndex, 0, item);
    this.stageChange.emit({ item, stage: target });
  }
}
