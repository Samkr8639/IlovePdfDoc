import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  /**
   * Global flag controlling visibility of the app footer and back-to-top button.
   * Defaults to true (visible on landing pages, home, policies).
   * Automatically set to false in active tool workspace/organize modes.
   */
  readonly isFooterVisible = signal<boolean>(true);

  hideFooter(): void {
    this.isFooterVisible.set(false);
  }

  showFooter(): void {
    this.isFooterVisible.set(true);
  }
}
