import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FleetService } from '../../services/fleet.service';
import { OpenClawInstance } from '../../models';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="fade-in">
      @if (instance) {
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 2rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
              <a routerLink="/instances" style="color: var(--text-secondary); text-decoration: none;">← Instances</a>
            </div>
            <h1 style="font-size: 1.875rem; font-weight: 700;">{{ instance.name }}</h1>
            <p style="color: var(--text-secondary);">{{ instance.description || 'No description' }}</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            @if (instance.status === 'running') {
              <a [href]="'http://localhost:' + instance.port" target="_blank" class="btn btn-primary">Open Gateway</a>
              <button class="btn btn-danger" (click)="stopInstance()">Stop</button>
            } @else if (instance.status === 'stopped') {
              <button class="btn btn-success" (click)="startInstance()">Start</button>
            }
            <button class="btn btn-outline" (click)="deleteInstance()" style="color: var(--error-color);">Delete</button>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 2rem;">
              <div>
                <span style="color: var(--text-secondary); font-size: 0.875rem;">Status</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span [class]="'badge badge-' + getStatusBadgeClass(instance.status)">{{ instance.status }}</span>
                </div>
              </div>
              <div>
                <span style="color: var(--text-secondary); font-size: 0.875rem;">Port</span>
                <div style="font-weight: 600;">{{ instance.port }}</div>
              </div>
              <div>
                <span style="color: var(--text-secondary); font-size: 0.875rem;">Role</span>
                <div style="font-weight: 600; text-transform: capitalize;">{{ instance.agentRole }}</div>
              </div>
              <div>
                <span style="color: var(--text-secondary); font-size: 0.875rem;">Model</span>
                <div><code style="background: var(--bg-color); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">{{ instance.ollamaModel }}</code></div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline" (click)="loadData()">Refresh</button>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <button [class]="activeTab === 'config' ? 'btn btn-primary' : 'btn btn-outline'" (click)="activeTab = 'config'">Configuration</button>
          <button [class]="activeTab === 'logs' ? 'btn btn-primary' : 'btn btn-outline'" (click)="activeTab = 'logs'; loadLogs()">Logs</button>
          <button [class]="activeTab === 'audit' ? 'btn btn-primary' : 'btn btn-outline'" (click)="activeTab = 'audit'">Audit Trail</button>
        </div>

        <!-- Configuration Tab -->
        @if (activeTab === 'config') {
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Instance Configuration</h3>
            </div>
            <div style="display: grid; gap: 1.5rem;">
              <div class="form-group">
                <label class="form-label">SOUL.md Content (Agent Persona)</label>
                <textarea class="form-control" rows="8" [(ngModel)]="editConfig.soulContent" style="font-family: monospace; font-size: 0.8rem;"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">AGENTS.md Content (Agent Instructions)</label>
                <textarea class="form-control" rows="8" [(ngModel)]="editConfig.agentsContent" style="font-family: monospace; font-size: 0.8rem;"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Custom Configuration (JSON)</label>
                <textarea class="form-control" rows="4" [(ngModel)]="editConfig.customConfig" style="font-family: monospace; font-size: 0.8rem;" placeholder="{}"></textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button class="btn btn-outline" (click)="resetConfig()">Reset</button>
                <button class="btn btn-primary" (click)="saveConfig()" [disabled]="instance.status === 'running'">Save Changes</button>
              </div>
              @if (instance.status === 'running') {
                <p style="color: var(--warning-color); font-size: 0.875rem;">Stop the instance to edit configuration.</p>
              }
            </div>
          </div>
        }

        <!-- Logs Tab -->
        @if (activeTab === 'logs') {
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Container Logs</h3>
              <button class="btn btn-sm btn-outline" (click)="loadLogs()">Refresh</button>
            </div>
            @if (logs) {
              <div class="logs-container">{{ logs }}</div>
            } @else {
              <div class="loading"><div class="spinner"></div></div>
            }
          </div>
        }

        <!-- Audit Tab -->
        @if (activeTab === 'audit') {
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Communication Audit Trail</h3>
            </div>
            <p style="color: var(--text-secondary);">All communications sent and received by this instance are logged for audit purposes.</p>
            <div style="margin-top: 1rem;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Direction</th>
                    <th>Type</th>
                    <th>Content</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-secondary);">No audit logs yet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        }
      } @else {
        <div class="loading"><div class="spinner"></div></div>
      }
    </div>
  `
})
export class InstanceDetailComponent implements OnInit {
  instance: OpenClawInstance | null = null;
  activeTab = 'config';
  logs: string | null = null;
  editConfig = {
    soulContent: '',
    agentsContent: '',
    customConfig: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fleetService: FleetService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.fleetService.getInstance(id).subscribe(instance => {
        this.instance = instance;
        this.resetConfig();
      });
    }
  }

  loadLogs(): void {
    if (this.instance) {
      this.fleetService.getInstanceLogs(this.instance.id).subscribe(result => {
        this.logs = result.logs || 'No logs available';
      });
    }
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

  startInstance(): void {
    if (this.instance) {
      this.fleetService.startInstance(this.instance.id).subscribe(() => this.loadData());
    }
  }

  stopInstance(): void {
    if (this.instance) {
      this.fleetService.stopInstance(this.instance.id).subscribe(() => this.loadData());
    }
  }

  deleteInstance(): void {
    if (this.instance && confirm('Are you sure you want to delete this instance?')) {
      this.fleetService.deleteInstance(this.instance.id).subscribe(() => {
        this.router.navigate(['/instances']);
      });
    }
  }

  resetConfig(): void {
    if (this.instance) {
      this.editConfig = {
        soulContent: this.instance.soulContent || '',
        agentsContent: this.instance.agentsContent || '',
        customConfig: this.instance.customConfig || ''
      };
    }
  }

  saveConfig(): void {
    if (this.instance) {
      this.fleetService.updateInstance(this.instance.id, this.editConfig).subscribe(() => this.loadData());
    }
  }
}