import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ViewportNavigationService {
  readonly MIN_ZOOM = 0.25;
  readonly MAX_ZOOM = 3.0;
  readonly DEFAULT_ZOOM = 1.0;
  readonly ZOOM_STEP = 0.15;

  zoomIn(currentZoom: number): number {
    return Math.min(this.MAX_ZOOM, Math.round((currentZoom + this.ZOOM_STEP) * 100) / 100);
  }

  zoomOut(currentZoom: number): number {
    return Math.max(this.MIN_ZOOM, Math.round((currentZoom - this.ZOOM_STEP) * 100) / 100);
  }

  calculateWheelZoom(currentZoom: number, deltaY: number): number {
    const factor = deltaY < 0 ? 1.08 : 0.92;
    return Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, Math.round(currentZoom * factor * 100) / 100));
  }

  resetZoom(): number {
    return this.DEFAULT_ZOOM;
  }

  clampPageIndex(target: number, totalPages: number): number {
    if (totalPages <= 0) return 0;
    return Math.max(0, Math.min(totalPages - 1, target));
  }

  nextPage(current: number, totalPages: number): number {
    return this.clampPageIndex(current + 1, totalPages);
  }

  prevPage(current: number): number {
    return Math.max(0, current - 1);
  }
}
