import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NavBadgeService } from './core/services/nav-badge.service';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly badges = inject(NavBadgeService);

  ngOnInit(): void {
    this.badges.refresh();
  }
}
