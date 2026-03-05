import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FleetService } from '../../services/fleet.service';
import { FleetStats, OpenClawInstance, SystemStatus, AgentRole } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="fade-in">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem;">Dashboard</h1>
        <p style="color: var(--text-secondary);">Overview of your OpenClaw fleet</p>
      </div>

      <!-- System Status -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">System Status</h2>
          <button class="btn btn-sm btn-outline" (click)="loadSystemStatus()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--success-color);" 
                 [style.background]="systemStatus?.docker?.available ? 'var(--success-color)' : 'var(--error-color)'"></div>
            <span><strong>Docker:</strong> {{ systemStatus?.docker?.available ? 'Connected' : 'Not Available' }}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 12px; height: 12px; border-radius: 50%;" 
                 [style.background]="systemStatus?.ollama?.available ? 'var(--success-color)' : 'var(--error-color)'"></div>
            <span><strong>Ollama:</strong> {{ systemStatus?.ollama?.available ? 'Connected' : 'Not Available' }}</span>
          </div>
          @if (systemStatus?.ollama?.available && systemStatus?.ollama?.models?.length) {
            <div>
              <strong>Models:</strong>
              @for (model of systemStatus?.ollama?.models; track model.name) {
                <code style="background: var(--bg-color); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.25rem;">
                  {{ model.name }}
                </code>
              }
            </div>
          }
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-4">
        <div class="card stat-card">
          <div class="stat-value">{{ stats?.instances?.total ?? 0 }}</div>
          <div class="stat-label">Total Instances</div>
        </div>
        <div class="card stat-card" style="border-left: 4px solid var(--success-color);">
          <div class="stat-value" style="color: var(--success-color);">{{ stats?.instances?.running ?? 0 }}</div>
          <div class="stat-label">Running</div>
        </div>
        <div class="card stat-card" style="border-left: 4px solid var(--warning-color);">
          <div class="stat-value" style="color: var(--warning-color);">{{ stats?.tasks?.pending ?? 0 }}</div>
          <div class="stat-label">Pending Tasks</div>
        </div>
        <div class="card stat-card" style="border-left: 4px solid var(--error-color);">
          <div class="stat-value" style="color: var(--error-color);">{{ stats?.instances?.error ?? 0 }}</div>
          <div class="stat-label">Errors</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">Quick Actions</h2>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button class="btn btn-primary" (click)="showCreateModal = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Instance
          </button>
          <a routerLink="/instances" class="btn btn-outline">View All Instances</a>
          <a routerLink="/tasks" class="btn btn-outline">View Tasks</a>
        </div>
      </div>

      <!-- Recent Instances -->
      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">Recent Instances</h2>
          <a routerLink="/instances" class="btn btn-sm btn-outline">View All</a>
        </div>
        @if (instances.length > 0) {
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Model</th>
                <th>Status</th>
                <th>Port</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (instance of instances; track instance.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/instances', instance.id]" style="color: var(--primary-color); text-decoration: none; font-weight: 500;">
                      {{ instance.name }}
                    </a>
                  </td>
                  <td>{{ instance.agentRole }}</td>
                  <td><code style="background: var(--bg-color); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem;">{{ instance.ollamaModel }}</code></td>
                  <td>
                    <span [class]="'badge badge-' + getStatusBadgeClass(instance.status)">
                      {{ instance.status }}
                    </span>
                  </td>
                  <td>{{ instance.port }}</td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      @if (instance.status === 'running') {
                        <button class="btn btn-sm btn-danger" (click)="stopInstance(instance.id)">Stop</button>
                      } @else if (instance.status === 'stopped') {
                        <button class="btn btn-sm btn-success" (click)="startInstance(instance.id)">Start</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
            <p>No instances yet. Create your first OpenClaw instance to get started.</p>
          </div>
        }
      </div>

      <!-- Create Instance Modal -->
      @if (showCreateModal) {
        <div class="modal-overlay" (click)="showCreateModal = false">
          <div class="modal" (click)="$event.stopPropagation()" style="max-width: 600px;">
            <div class="modal-header">
              <h3>Create New Instance</h3>
              <button class="btn btn-sm btn-outline" (click)="showCreateModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Instance Name *</label>
                <input type="text" class="form-control" 
                       [ngModelOptions]="{standalone: true}"
                       [(ngModel)]="newInstance.name" 
                       placeholder="e.g., Code Helper">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" class="form-control"
                       [ngModelOptions]="{standalone: true}"
                       [(ngModel)]="newInstance.description" 
                       placeholder="Brief description">
              </div>
              <div class="form-group">
                <label class="form-label">Agent Role *</label>
                <select class="form-control"
                        [ngModelOptions]="{standalone: true}"
                        [(ngModel)]="newInstance.agentRoleId">
                  <option value="">Select a role...</option>
                  @for (role of roles; track role.id) {
                    <option [ngValue]="role.id">{{ role.name }} - {{ role.description }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Ollama Model (optional)</label>
                <input type="text" class="form-control"
                       [ngModelOptions]="{standalone: true}"
                       [(ngModel)]="newInstance.ollamaModel" 
                       placeholder="Leave empty for role default">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" (click)="showCreateModal = false">Cancel</button>
              <button class="btn btn-primary" (click)="createInstance()" [disabled]="!newInstance.name || !newInstance.agentRoleId">
                Create Instance
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  stats: FleetStats | null = null;
  systemStatus: SystemStatus | null = null;
  instances: OpenClawInstance[] = [];
  roles: AgentRole[] = [];
  showCreateModal = false;
  newInstance = {
    name: '',
    description: '',
    agentRoleId: '',
    ollamaModel: ''
  };

  constructor(private fleetService: FleetService) {}

  ngOnInit(): void {
    this.loadData();
    this.loadSystemStatus();
  }

  loadData(): void {
    this.fleetService.getStats().subscribe(stats => this.stats = stats);
    this.fleetService.getInstances().subscribe(instances => this.instances = instances.slice(0, 5));
    this.fleetService.getAgentRoles().subscribe(roles => this.roles = roles);
  }

  loadSystemStatus(): void {
    this.fleetService.getSystemStatus().subscribe(status => this.systemStatus = status);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'secondary';
      case 'starting':
      case 'stopping': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  startInstance(id: string): void {
    this.fleetService.startInstance(id).subscribe(() => this.loadData());
  }

  stopInstance(id: string): void {
    this.fleetService.stopInstance(id).subscribe(() => this.loadData());
  }

  createInstance(): void {
    if (!this.newInstance.name || !this.newInstance.agentRoleId) {
      return;
    }
    
    this.fleetService.createInstance(this.newInstance).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.newInstance = { name: '', description: '', agentRoleId: '', ollamaModel: '' };
        this.loadData();
      },
      error: (error) => {
        console.error('Failed to create instance:', error);
        alert('Failed to create instance: ' + (error.error?.error || error.message));
      }
    });
  }
}