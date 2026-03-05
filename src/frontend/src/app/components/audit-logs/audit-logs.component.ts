import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  template: `
    <div class="fade-in">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem;">Audit Logs</h1>
        <p style="color: var(--text-secondary);">Complete audit trail of all communications sent and received</p>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom: 1rem;">
        <div style="display: flex; gap: 1rem; align-items: end;">
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Instance</label>
            <select class="form-control">
              <option value="">All Instances</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Direction</label>
            <select class="form-control">
              <option value="">All</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
              <option value="internal">Internal</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Type</label>
            <select class="form-control">
              <option value="">All Types</option>
              <option value="chat">Chat</option>
              <option value="task">Task</option>
              <option value="command">Command</option>
              <option value="system">System</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Date Range</label>
            <select class="form-control">
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button class="btn btn-primary">Apply Filters</button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Instance</th>
              <th>Direction</th>
              <th>Type</th>
              <th>Content Preview</th>
              <th>Status</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <div>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <p>No audit logs yet. All communications will be logged here for compliance and auditing.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AuditLogsComponent implements OnInit {
  ngOnInit(): void {}
}