import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <app-header></app-header>
    <main class="container" style="padding: 2rem 1rem;">
      <router-outlet></router-outlet>
    </main>
  `
})
export class AppComponent {
  title = 'OpenClaw Fleet';
}