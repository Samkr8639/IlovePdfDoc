import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { BackToTopComponent } from './shared/components/back-to-top/back-to-top.component';
import { UploadConsentDialogComponent } from './shared/components/upload-consent-dialog/upload-consent-dialog.component';
import { RouteProgressBarComponent } from './shared/components/route-progress-bar/route-progress-bar.component';
import { LayoutService } from './core/services/layout.service';
import { WebMcpService } from './core/services/webmcp.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BackToTopComponent, UploadConsentDialogComponent, RouteProgressBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  readonly layoutService = inject(LayoutService);
  private readonly webMcpService = inject(WebMcpService);
  private readonly router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const main = document.getElementById('main-content');
        if (main) main.scrollTop = 0;
      }
    });
  }
}
