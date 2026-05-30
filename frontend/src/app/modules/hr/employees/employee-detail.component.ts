import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { EmployeeService } from '../services/employee.service';
import { EmployeeProfileService } from '../services/employee-profile.service';
import { AuthService } from '@core/services/auth.service';
import { Employee } from '../models/hr.models';
import {
  AttendanceOverview,
  Career,
  CareerProject,
  EmployeeDocument,
  EmployeeOverview,
  LeaveOverview,
  PayrollOverview
} from '../models/employee-profile.models';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    ButtonModule,
    TabsModule,
    TagModule,
    TooltipModule,
    TableModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    FormsModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    EmptyStateComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-detail.component.html'
})
export class EmployeeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(EmployeeService);
  private readonly profile = inject(EmployeeProfileService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);

  protected readonly loading = signal(true);
  protected readonly employee = signal<Employee | null>(null);
  private employeeId = '';

  protected readonly overview = signal<EmployeeOverview | null>(null);
  protected readonly attendance = signal<AttendanceOverview | null>(null);
  protected readonly leave = signal<LeaveOverview | null>(null);
  protected readonly payroll = signal<PayrollOverview | null>(null);
  protected readonly documents = signal<EmployeeDocument[] | null>(null);
  protected readonly career = signal<Career | null>(null);

  /** Admin / HR / manager can add & edit tracked projects. */
  protected readonly canEdit = computed(() => {
    const roles = (this.auth.user()?.roles ?? []).map((r) => r.toLowerCase());
    return roles.some((r) => r === 'admin' || r === 'hr' || r === 'manager');
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.employeeId = id;
    this.svc.byId(id).subscribe((e) => {
      this.employee.set(e ?? null);
      this.loading.set(false);
    });

    // Load the rich profile sections in parallel so tab switches are instant.
    this.profile.overview(id).subscribe((d) => this.overview.set(d));
    this.profile.attendance(id).subscribe((d) => this.attendance.set(d));
    this.profile.leave(id).subscribe((d) => this.leave.set(d));
    this.profile.payroll(id).subscribe((d) => this.payroll.set(d));
    this.profile.documents(id).subscribe((d) => this.documents.set(d));
    this.loadCareer();
  }

  private loadCareer() {
    this.profile.career(this.employeeId).subscribe((d) => this.career.set(d));
  }

  tenureYears(iso: string): number {
    const yrs = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(yrs * 10) / 10;
  }

  // ---- presentation helpers ----
  attendanceTone(status: string): StatusTone {
    switch (status) {
      case 'Present': return 'success';
      case 'Wfh': return 'info';
      case 'Late': return 'warn';
      case 'Absent': return 'danger';
      default: return 'neutral';
    }
  }
  attendanceLabel(status: string): string {
    return status === 'Wfh' ? 'WFH' : status === 'Leave' ? 'On leave' : status;
  }

  leaveTone(status: string): StatusTone {
    return status === 'Approved' ? 'success' : status === 'Pending' ? 'warn' : 'danger';
  }

  docTone(status: string): StatusTone {
    return status === 'Verified' ? 'success' : status === 'Pending' ? 'warn' : 'danger';
  }

  docIcon(fileType: string): string {
    const t = fileType.toUpperCase();
    if (t === 'PDF') return 'pi-file-pdf';
    if (t === 'JPG' || t === 'JPEG' || t === 'PNG') return 'pi-image';
    if (t === 'DOC' || t === 'DOCX') return 'pi-file-word';
    return 'pi-file';
  }

  fileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  usedPct(used: number, entitled: number): number {
    return entitled <= 0 ? 0 : Math.min(100, Math.round((used / entitled) * 100));
  }

  // ---- career helpers ----
  projectTone(status: string): StatusTone {
    return status === 'Completed' ? 'success' : status === 'Ongoing' ? 'info' : 'warn';
  }
  eventIconBg(type: string): string {
    switch (type) {
      case 'joined': return 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300';
      case 'promotion': return 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
      case 'award': return 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300';
      default: return 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300';
    }
  }

  // ---- project dialogs ----
  protected projectVisible = false;
  protected readonly selectedProject = signal<CareerProject | null>(null);
  protected formVisible = false;
  protected editId: string | null = null;
  protected pform = this.blankProject();
  protected readonly statusOptions = ['Completed', 'Ongoing', 'On hold'];

  openProject(p: CareerProject) {
    this.selectedProject.set(p);
    this.projectVisible = true;
  }

  openAddProject() {
    this.editId = null;
    this.pform = this.blankProject();
    this.formVisible = true;
  }

  editProject(p: CareerProject) {
    this.projectVisible = false;
    this.editId = p.id;
    this.pform = {
      name: p.name, domain: p.domain, role: p.role, manager: p.manager,
      startDate: p.startDate.slice(0, 10), endDate: p.endDate ? p.endDate.slice(0, 10) : '',
      status: p.status, rating: p.rating, responsibilities: p.responsibilities.join('\n'),
      outcome: p.outcome, feedback: p.feedback, skills: p.skills.join(', '), teamSize: p.teamSize
    };
    this.formVisible = true;
  }

  saveProject() {
    const f = this.pform;
    const body = {
      name: f.name, domain: f.domain, role: f.role, manager: f.manager,
      startDate: f.startDate, endDate: f.endDate || null, status: f.status, rating: f.rating,
      responsibilities: f.responsibilities, outcome: f.outcome, feedback: f.feedback, skills: f.skills, teamSize: f.teamSize
    };
    const req = this.editId
      ? this.profile.updateProject(this.editId, body)
      : this.profile.addProject(this.employeeId, body);
    req.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: this.editId ? 'Project updated' : 'Project added', detail: f.name });
        this.formVisible = false;
        this.loadCareer();
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save the project.' })
    });
  }

  deleteProject(p: CareerProject) {
    this.profile.deleteProject(p.id).subscribe(() => {
      this.messages.add({ severity: 'info', summary: 'Project removed', detail: p.name });
      this.projectVisible = false;
      this.loadCareer();
    });
  }

  private blankProject() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name: '', domain: 'Project', role: this.employee()?.designation ?? '', manager: this.employee()?.manager ?? '',
      startDate: today, endDate: '', status: 'Completed', rating: 4,
      responsibilities: '', outcome: '', feedback: '', skills: '', teamSize: 5
    };
  }
}
