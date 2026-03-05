import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FleetService } from '../../services/fleet.service';
import { OpenClawInstance, AgentRole } from '../../models';

@Component({
  selector: 'app-instances',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="fade-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem;">Instances</h1>
          <p style="color: var(--text-secondary);">Manage your OpenClaw agent instances</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Instance
        </button>
      </div>

      @if (instances.length > 0) {
        <div class="grid grid-3">
          @for (instance of instances; track instance.id) {
            <div [class]="'card instance-card ' + instance.status">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                  <h3 style="font-size: 1.125rem; font-weight: 600;">{{ instance.name }}</h3>
                  <p style="color: var(--text-secondary); font-size: 0.875rem;">{{ instance.description || 'No description' }}</p>
                </div>
                <span [class]="'badge badge-' + getStatusBadgeClass(instance.status)">
                  {{ instance.status }}
                </span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem;">
                <div>
                  <span style="color: var(--text-secondary);">Role:</span>
                  <span style="font-weight: 500; margin-left: 0.25rem;">{{ instance.agentRole }}</span>
                </div>
                <div>
                  <span style="color: var(--text-secondary);">Port:</span>
                  <span style="font-weight: 500; margin-left: 0.25rem;">{{ instance.port }}</span>
                </div>
                <div style="grid-column: span 2;">
                  <span style="color: var(--text-secondary);">Model:</span>
                  <code style="background: var(--bg-color); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.25rem;">{{ instance.ollamaModel }}</code>
                </div>
              </div>

              <div style="display: flex; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <a [routerLink]="['/instances', instance.id]" class="btn btn-sm btn-outline" style="flex: 1;">Details</a>
                @if (instance.status === 'running') {
                  <button class="btn btn-sm btn-danger" (click)="stopInstance(instance.id)">Stop</button>
                  <a [href]="'http://localhost:' + instance.port" target="_blank" class="btn btn-sm btn-primary">Open</a>
                } @else if (instance.status === 'stopped') {
                  <button class="btn btn-sm btn-success" (click)="startInstance(instance.id)">Start</button>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="card" style="text-align: center; padding: 4rem;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1" style="margin-bottom: 1rem;">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
            <line x1="8" y1="6" x2="16" y2="6"/>
            <line x1="8" y1="10" x2="16" y2="10"/>
            <line x1="8" y1="14" x2="12" y2="14"/>
          </svg>
          <h3 style="margin-bottom: 0.5rem;">No instances yet</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Create your first OpenClaw instance to get started.</p>
          <button class="btn btn-primary" (click)="showCreateModal = true">Create Instance</button>
        </div>
      }

      <!-- Create Modal -->
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
                <input type="text" class="form-control" [(ngModel)]="newInstance.name" placeholder="e.g., Code Helper">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" class="form-control" [(ngModel)]="newInstance.description" placeholder="Brief description">
              </div>
              <div class="form-group">
                <label class="form-label">Agent Role *</label>
                <select class="form-control" [(ngModel)]="newInstance.agentRoleId">
                  <option value="">Select a role...</option>
                  @for (role of roles; track role.id) {
                    <option [value]="role.id">{{ role.name }} - {{ role.description }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Ollama Model</label>
                <input type="text" class="form-control" [(ngModel)]="newInstance.ollamaModel" placeholder="Leave empty for role default">
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
export class InstancesComponent implements OnInit {
  instances: OpenClawInstance[] = [];
  roles: AgentRole[] = [];
  showCreateModal = false;
  newInstance = { name: '', description: '', agentRoleId: '', ollamaModel: '' };

  constructor(private fleetService: FleetService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.fleetService.getInstances().subscribe(instances => this.instances = instances);
    this.fleetService.getAgentRoles().subscribe(roles => this.roles = roles);
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
    this.fleetService.createInstance(this.newInstance).subscribe(() => {
      this.showCreateModal = false;
      this.newInstance = { name: '', description: '', agentRoleId: '', ollamaModel: '' };
      this.loadData();
    });
  }
}