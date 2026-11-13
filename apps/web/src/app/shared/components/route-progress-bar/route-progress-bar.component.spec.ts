import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouteProgressBarComponent } from './route-progress-bar.component';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('RouteProgressBarComponent', () => {
  let component: RouteProgressBarComponent;
  let fixture: ComponentFixture<RouteProgressBarComponent>;
  let routerEvents$: Subject<any>;
  let mockRouter: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    routerEvents$ = new Subject<any>();
    mockRouter = {
      events: routerEvents$.asObservable()
    };

    await TestBed.configureTestingModule({
      imports: [RouteProgressBarComponent],
      providers: [
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RouteProgressBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.isVisible()).toBe(false);
    expect(component.progress()).toBe(0);
  });

  it('should show progress after debounce on NavigationStart', () => {
    routerEvents$.next(new NavigationStart(1, '/split-pdf'));
    // Before debounce (150ms)
    vi.advanceTimersByTime(50);
    expect(component.isVisible()).toBe(false);

    // After debounce
    vi.advanceTimersByTime(100);
    expect(component.isVisible()).toBe(true);
    expect(component.progress()).toBeGreaterThan(0);

    // Increments periodically
    vi.advanceTimersByTime(200);
    expect(component.progress()).toBeGreaterThanOrEqual(25);
  });

  it('should finish progress and hide after NavigationEnd', () => {
    routerEvents$.next(new NavigationStart(1, '/split-pdf'));
    vi.advanceTimersByTime(150);
    expect(component.isVisible()).toBe(true);

    routerEvents$.next(new NavigationEnd(1, '/split-pdf', '/split-pdf'));
    expect(component.progress()).toBe(100);

    vi.advanceTimersByTime(300);
    expect(component.isVisible()).toBe(false);
    expect(component.progress()).toBe(0);
  });
});
