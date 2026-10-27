import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AboutUsComponent } from './about-us.component';
import { SeoService } from '../../core/services/seo.service';

describe('AboutUsComponent', () => {
  let component: AboutUsComponent;
  let fixture: ComponentFixture<AboutUsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutUsComponent],
      providers: [
        provideRouter([]),
        SeoService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AboutUsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the about us component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the main hero title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.hero-headline');
    expect(title?.textContent).toContain('Your documents.');
  });

  it('should render all 3 core pillars', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.commitment-card');
    expect(cards.length).toBe(3);
  });
});
