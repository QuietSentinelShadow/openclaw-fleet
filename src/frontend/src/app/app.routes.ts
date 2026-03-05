import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InstancesComponent } from './components/instances/instances.component';
import { InstanceDetailComponent } from './components/instance-detail/instance-detail.component';
import { AuditLogsComponent } from './components/audit-logs/audit-logs.component';
import { TasksComponent } from './components/tasks/tasks.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'instances', component: InstancesComponent },
  { path: 'instances/:id', component: InstanceDetailComponent },
  { path: 'tasks', component: TasksComponent },
  { path: 'audit', component: AuditLogsComponent },
  { path: '**', redirectTo: '' }
];