import { TestBed } from '@angular/core/testing';
import { AnimationService } from './animation.service';

describe('AnimationService', () => {
  let service: AnimationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnimationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should safely handle animateHero without throwing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="hero-badge"></div><h1 class="editorial-headline"></h1>';
    expect(() => service.animateHero(el)).not.toThrow();
  });

  it('should safely handle animateToolCards without throwing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="tool-card-item"></div>';
    expect(() => service.animateToolCards(el)).not.toThrow();
  });

  it('should safely handle fadeSlideIn without throwing', () => {
    const el = document.createElement('div');
    expect(() => service.fadeSlideIn(el)).not.toThrow();
  });
});
