import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { EmployeeService } from '../services/employee.service';
import { Employee, EmploymentType } from '../models/hr.models';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    AutoCompleteModule,
    InputNumberModule,
    TextareaModule,
    DividerModule,
    PageHeaderComponent,
    AvatarComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="My Work · People"
      title="Add new employee"
      subtitle="Onboard a new team member. They'll receive a welcome email with login instructions."
    >
      <a routerLink="/my-work/employees">
        <button pButton severity="secondary" [outlined]="true" icon="pi pi-arrow-left" label="Cancel"></button>
      </a>
    </app-page-header>

    <app-hr-agent-rail stage="onboarding" title="Onboarding co-pilots" />

    <form [formGroup]="form" (ngSubmit)="submit()" class="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
      <!-- ============ Form sections ============ -->
      <div class="space-y-5">
        <!-- Personal -->
        <section class="card overflow-hidden">
          <header class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start gap-3">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 shrink-0">
              <i class="pi pi-user"></i>
            </span>
            <div>
              <h3 class="font-semibold leading-tight">Personal information</h3>
              <p class="text-xs text-surface-500 mt-0.5">Identity, contact details and basic profile.</p>
            </div>
          </header>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1">Full name <span class="text-rose-500">*</span></label>
              <input pInputText formControlName="fullName" class="w-full !rounded-lg" placeholder="e.g. Anita Desai" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Work email <span class="text-rose-500">*</span></label>
              <input pInputText formControlName="email" type="email" class="w-full !rounded-lg" placeholder="name@yugma.io" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Phone <span class="text-rose-500">*</span></label>
              <input pInputText formControlName="phone" class="w-full !rounded-lg" placeholder="+91 ..." />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Date of birth</label>
              <p-datepicker
                formControlName="dateOfBirth"
                appendTo="body"
                dateFormat="dd M yy"
                [showIcon]="true"
                [maxDate]="today"
                styleClass="w-full"
                inputStyleClass="!rounded-lg w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Gender</label>
              <p-select
                [options]="genderOptions"
                formControlName="gender"
                placeholder="Prefer not to say"
                [showClear]="true"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1">Employee photo (optional)</label>
              <div class="flex items-start gap-4">
                <app-avatar
                  [name]="form.controls.fullName.value || 'New Employee'"
                  [image]="form.controls.avatarUrl.value || undefined"
                  size="lg"
                />
                <div class="flex-1 space-y-2">
                  <input
                    #photoInput
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden"
                    (change)="onPhotoSelected($event)"
                  />
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      pButton
                      severity="secondary"
                      [outlined]="true"
                      size="small"
                      icon="pi pi-upload"
                      label="Upload photo"
                      (click)="photoInput.click()"
                    ></button>
                    @if (form.controls.avatarUrl.value) {
                      <button
                        type="button"
                        pButton
                        severity="danger"
                        [text]="true"
                        size="small"
                        icon="pi pi-times"
                        label="Remove"
                        (click)="clearPhoto(photoInput)"
                      ></button>
                    }
                  </div>
                  <input
                    pInputText
                    formControlName="avatarUrl"
                    class="w-full !rounded-lg"
                    placeholder="…or paste an image URL (https://...)"
                  />
                  <p class="text-[11px] text-surface-500">PNG, JPG, WEBP or GIF up to 2 MB.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Employment -->
        <section class="card overflow-hidden">
          <header class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start gap-3">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shrink-0">
              <i class="pi pi-briefcase"></i>
            </span>
            <div>
              <h3 class="font-semibold leading-tight">Employment</h3>
              <p class="text-xs text-surface-500 mt-0.5">Department, role, reporting line and work arrangement.</p>
            </div>
          </header>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Department <span class="text-rose-500">*</span></label>
              <p-select
                [options]="departments"
                formControlName="department"
                placeholder="Select department"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Designation <span class="text-rose-500">*</span></label>
              <input pInputText formControlName="designation" class="w-full !rounded-lg" placeholder="e.g. Senior Engineer" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-medium">Reporting manager</label>
                <span class="text-[11px] text-surface-500">
                  {{ managerOptions().length }} eligible in
                  {{ form.controls.department.value || 'all departments' }}
                </span>
              </div>
              <p-select
                [options]="managerOptions()"
                formControlName="manager"
                [placeholder]="managerOptions().length ? 'Choose a manager' : 'No employees in this department yet'"
                [disabled]="!managerOptions().length"
                [showClear]="true"
                optionLabel="label"
                optionValue="value"
                [filter]="true"
                filterBy="label"
                styleClass="w-full !rounded-lg"
              >
                <ng-template let-opt pTemplate="item">
                  <div class="flex items-center gap-2 py-1">
                    <app-avatar [name]="opt.label" size="xs" />
                    <div>
                      <div class="text-sm font-medium">{{ opt.label }}</div>
                      <div class="text-[11px] text-surface-500">{{ opt.designation }} · {{ opt.department }}</div>
                    </div>
                  </div>
                </ng-template>
              </p-select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Employment type <span class="text-rose-500">*</span></label>
              <p-select
                [options]="employmentTypes"
                formControlName="employmentType"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Work arrangement</label>
              <p-select
                [options]="worksiteOptions"
                formControlName="worksite"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Office location</label>
              <p-select
                [options]="locationOptions"
                formControlName="location"
                placeholder="Pick office / city"
                [editable]="true"
                [showClear]="true"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Date of joining <span class="text-rose-500">*</span></label>
              <p-datepicker
                formControlName="joinedAt"
                appendTo="body"
                dateFormat="dd M yy"
                [showIcon]="true"
                styleClass="w-full"
                inputStyleClass="!rounded-lg w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Probation period</label>
              <p-select
                [options]="probationOptions"
                formControlName="probationMonths"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
          </div>
        </section>

        <!-- Compensation -->
        <section class="card overflow-hidden">
          <header class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start gap-3">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 shrink-0">
              <i class="pi pi-wallet"></i>
            </span>
            <div>
              <h3 class="font-semibold leading-tight">Compensation</h3>
              <p class="text-xs text-surface-500 mt-0.5">Annual cost-to-company and payout cadence.</p>
            </div>
          </header>
          <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">CTC (₹ in lakhs)</label>
              <p-inputNumber
                formControlName="ctcLakhs"
                mode="decimal"
                [min]="0"
                [minFractionDigits]="1"
                [maxFractionDigits]="2"
                styleClass="w-full"
                inputStyleClass="!rounded-lg w-full text-right"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Currency</label>
              <p-select
                [options]="currencyOptions"
                formControlName="currency"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Payout cycle</label>
              <p-select
                [options]="payCycleOptions"
                formControlName="payCycle"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full !rounded-lg"
              />
            </div>
          </div>
        </section>

        <!-- Skills & notes -->
        <section class="card overflow-hidden">
          <header class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start gap-3">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 shrink-0">
              <i class="pi pi-sparkles"></i>
            </span>
            <div>
              <h3 class="font-semibold leading-tight">Skills &amp; notes</h3>
              <p class="text-xs text-surface-500 mt-0.5">Tag technical/functional strengths and add a short bio.</p>
            </div>
          </header>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Skills</label>
              <p-autoComplete
                formControlName="skills"
                [multiple]="true"
                [typeahead]="false"
                placeholder="Type a skill and press Enter"
                styleClass="w-full"
              />
              <p class="text-[11px] text-surface-500 mt-1">Used for matching to projects and the resource planner.</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Internal notes</label>
              <textarea
                pTextarea
                formControlName="notes"
                rows="3"
                class="w-full !rounded-lg"
                placeholder="Hiring context, references, special considerations…"
              ></textarea>
            </div>
          </div>
        </section>

        <!-- Footer actions -->
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="text-xs text-surface-500 hidden sm:block">
            <i class="pi pi-info-circle mr-1"></i>
            Fields marked <span class="text-rose-500">*</span> are required.
          </div>
          <div class="flex gap-2">
            <a routerLink="/my-work/employees">
              <button type="button" pButton severity="secondary" [outlined]="true" label="Cancel"></button>
            </a>
            <button type="submit" pButton icon="pi pi-check" label="Create employee" [disabled]="form.invalid"></button>
          </div>
        </div>
      </div>

      <!-- ============ Live preview / hints sidebar ============ -->
      <aside class="hidden xl:block sticky top-4 space-y-4">
        <div class="card p-5">
          <div class="section-title mb-3">Live preview</div>
          <div class="flex items-center gap-3">
            <app-avatar
              [name]="(form.controls.fullName.value || 'New Employee')"
              [image]="form.controls.avatarUrl.value || undefined"
              size="lg"
            />
            <div class="min-w-0">
              <div class="font-semibold truncate">{{ form.controls.fullName.value || 'Full name' }}</div>
              <div class="text-xs text-surface-500 truncate">{{ form.controls.designation.value || 'Designation' }}</div>
            </div>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt class="text-surface-500 uppercase tracking-wider text-[10px]">Department</dt>
              <dd class="font-medium mt-0.5 truncate">{{ form.controls.department.value || '—' }}</dd>
            </div>
            <div>
              <dt class="text-surface-500 uppercase tracking-wider text-[10px]">Manager</dt>
              <dd class="font-medium mt-0.5 truncate">{{ form.controls.manager.value || '—' }}</dd>
            </div>
            <div>
              <dt class="text-surface-500 uppercase tracking-wider text-[10px]">Type</dt>
              <dd class="font-medium mt-0.5">{{ form.controls.employmentType.value }}</dd>
            </div>
            <div>
              <dt class="text-surface-500 uppercase tracking-wider text-[10px]">Worksite</dt>
              <dd class="font-medium mt-0.5">{{ form.controls.worksite.value }}</dd>
            </div>
            <div class="col-span-2">
              <dt class="text-surface-500 uppercase tracking-wider text-[10px]">Compensation</dt>
              <dd class="font-medium mt-0.5 tabular-nums">
                {{ form.controls.currency.value }} {{ form.controls.ctcLakhs.value || 0 }} L &middot;
                {{ form.controls.payCycle.value }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="card p-5">
          <div class="section-title mb-2">Onboarding checklist</div>
          <ul class="space-y-2 text-sm text-surface-700 dark:text-surface-200">
            <li class="flex items-start gap-2"><i class="pi pi-circle-fill text-[6px] mt-2 text-brand-500"></i> Welcome email with login link</li>
            <li class="flex items-start gap-2"><i class="pi pi-circle-fill text-[6px] mt-2 text-brand-500"></i> Assign default permissions (member)</li>
            <li class="flex items-start gap-2"><i class="pi pi-circle-fill text-[6px] mt-2 text-brand-500"></i> Add to department channel</li>
            <li class="flex items-start gap-2"><i class="pi pi-circle-fill text-[6px] mt-2 text-brand-500"></i> Manager 1:1 scheduled</li>
          </ul>
          <p class="text-[11px] text-surface-500 mt-3">These steps fire automatically after creation.</p>
        </div>
      </aside>
    </form>
  `
})
export class EmployeeFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly svc = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly today = new Date();

  protected readonly departments = [
    'Engineering', 'Sales', 'Customer Success', 'Finance', 'HR',
    'Operations', 'Procurement', 'Marketing', 'Product', 'People'
  ].map((d) => ({ label: d, value: d }));

  protected readonly employmentTypes: { label: string; value: EmploymentType }[] = [
    { label: 'Full-time', value: 'Full-time' },
    { label: 'Part-time', value: 'Part-time' },
    { label: 'Contract', value: 'Contract' },
    { label: 'Intern', value: 'Intern' }
  ];

  protected readonly worksiteOptions = [
    { label: 'On-site', value: 'On-site' },
    { label: 'Hybrid', value: 'Hybrid' },
    { label: 'Remote', value: 'Remote' }
  ];

  protected readonly genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Non-binary', value: 'nb' },
    { label: 'Prefer not to say', value: 'na' }
  ];

  protected readonly locationOptions = [
    'Bengaluru', 'Mumbai', 'Pune', 'Delhi', 'Hyderabad', 'Chennai', 'Remote'
  ].map((l) => ({ label: l, value: l }));

  protected readonly probationOptions = [
    { label: 'No probation', value: 0 },
    { label: '1 month', value: 1 },
    { label: '3 months', value: 3 },
    { label: '6 months', value: 6 }
  ];

  protected readonly currencyOptions = [
    { label: '₹ INR', value: 'INR' },
    { label: '$ USD', value: 'USD' },
    { label: '€ EUR', value: 'EUR' },
    { label: '£ GBP', value: 'GBP' }
  ];

  protected readonly payCycleOptions = [
    { label: 'Monthly', value: 'Monthly' },
    { label: 'Bi-weekly', value: 'Bi-weekly' },
    { label: 'Weekly', value: 'Weekly' }
  ];

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    dateOfBirth: [null as Date | null],
    gender: ['' as string],
    avatarUrl: [''],
    department: ['Engineering', Validators.required],
    designation: ['', Validators.required],
    manager: [''],
    employmentType: ['Full-time' as EmploymentType, Validators.required],
    worksite: ['On-site'],
    location: ['Bengaluru'],
    joinedAt: [new Date() as Date | string, Validators.required],
    probationMonths: [3 as number],
    ctcLakhs: [12 as number | null],
    currency: ['INR'],
    payCycle: ['Monthly'],
    skills: [[] as string[]],
    notes: ['']
  });

  // Reactive signal mirror of the department field
  private readonly departmentSignal = toSignal(
    this.form.controls.department.valueChanges,
    { initialValue: this.form.controls.department.value }
  );

  // Manager options derived from employees in the currently-selected department.
  protected readonly managerOptions = computed(() => {
    const dept = this.departmentSignal();
    const employees = this.svc.all();
    const filtered = dept ? employees.filter((e) => e.department === dept) : employees;
    return filtered.map((e) => ({
      label: e.fullName,
      value: e.fullName,
      designation: e.designation,
      department: e.department
    }));
  });

  constructor() {
    // Reset manager whenever department changes if the current manager isn't in the new department.
    this.form.controls.department.valueChanges.subscribe((newDept) => {
      const current = this.form.controls.manager.value;
      if (!current) return;
      const stillValid = this.svc.all().some(
        (e) => e.fullName === current && e.department === newDept
      );
      if (!stillValid) this.form.controls.manager.setValue('');
    });
  }

  /** Reads the chosen image into the form as a base64 data URL (no separate upload endpoint needed). */
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.messages.add({ severity: 'warn', summary: 'Invalid file', detail: 'Please choose an image file.' });
      input.value = '';
      return;
    }
    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      this.messages.add({ severity: 'warn', summary: 'Image too large', detail: 'Please choose an image under 2 MB.' });
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.form.controls.avatarUrl.setValue(String(reader.result));
      this.cdr.markForCheck(); // FileReader resolves outside the template event, so refresh the OnPush view.
    };
    reader.onerror = () => {
      this.messages.add({ severity: 'error', summary: 'Upload failed', detail: 'Could not read the selected image.' });
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(input: HTMLInputElement) {
    this.form.controls.avatarUrl.setValue('');
    input.value = '';
  }

  submit() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload: Omit<Employee, 'id' | 'code'> = {
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      avatarUrl: v.avatarUrl || undefined,
      location: v.location,
      department: v.department,
      designation: v.designation,
      manager: v.manager || undefined,
      employmentType: v.employmentType,
      status: 'active',
      joinedAt: (v.joinedAt instanceof Date ? v.joinedAt : new Date(v.joinedAt))
        .toISOString()
        .slice(0, 10),
      ctcLakhs: v.ctcLakhs ?? 0,
      performance: 3,
      skills: v.skills ?? []
    };
    this.svc.create(payload).subscribe({
      next: (emp) => {
        this.messages.add({
          severity: 'success',
          summary: 'Employee created',
          detail: `${emp.fullName} (${emp.code}) · provisioning request opened for IT.`,
          life: 5000
        });
        void this.router.navigate(['/my-work/employees', emp.id]);
      },
      error: (err) => {
        const detail =
          err?.error?.message ??
          err?.error?.title ??
          (typeof err?.error === 'string' ? err.error : 'Could not create employee. Check the form and try again.');
        this.messages.add({ severity: 'error', summary: 'Create failed', detail, life: 8000 });
        console.error('Create employee failed', err);
      }
    });
  }
}
