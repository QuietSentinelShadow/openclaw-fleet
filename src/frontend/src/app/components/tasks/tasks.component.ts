import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-tasks',
  standalone: true,
  template: `
    <div class="fade-in">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem;">Tasks</h1>
        <p style="color: var(--text-secondary);">View and manage tasks across your fleet</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Task Queue</h2>
          <button class="btn btn-sm btn-primary">+ New Task</button>
        </div>
        
        <table class="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Type</th>
              <th>Instance</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <div>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <p>No tasks yet. Tasks will appear here when you submit work to agents.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class TasksComponent implements OnInit {
  ngOnInit(): void {}
}