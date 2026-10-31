import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { BackToTopComponent } from './shared/components/back-to-top/back-to-top.component';
import { UploadConsentDialogComponent } from './shared/components/upload-consent-dialog/upload-consent-dialog.component';
import { LayoutService } from './core/services/layout.service';
import { WebMcpService } from './core/services/webmcp.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BackToTopComponent, UploadConsentDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  readonly layoutService = inject(LayoutService);
  private readonly webMcpService = inject(WebMcpService);
}
