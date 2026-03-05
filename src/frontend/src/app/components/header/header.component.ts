import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header style="background: white; border-bottom: 1px solid var(--border-color); padding: 1rem 0;">
      <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 2rem;">
          <a routerLink="/" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--text-primary);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span style="font-weight: 600; font-size: 1.25rem;">OpenClaw Fleet</span>
          </a>
          <nav class="nav">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">Dashboard</a>
            <a routerLink="/instances" routerLinkActive="active" class="nav-link">Instances</a>
            <a routerLink="/tasks" routerLinkActive="active" class="nav-link">Tasks</a>
            <a routerLink="/audit" routerLinkActive="active" class="nav-link">Audit Logs</a>
          </nav>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="color: var(--text-secondary); font-size: 0.875rem;">Welcome, Admin</span>
          <button class="btn btn-outline btn-sm">Logout</button>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {}