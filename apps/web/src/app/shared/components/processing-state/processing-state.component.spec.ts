import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProcessingStateComponent } from './processing-state.component';

describe('ProcessingStateComponent', () => {
  let component: ProcessingStateComponent;
  let fixture: ComponentFixture<ProcessingStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessingStateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ProcessingStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the default title when none provided', () => {
    const el = fixture.nativeElement as HTMLElement;
    const titleEl = el.querySelector('.processing-title');
    expect(titleEl?.textContent?.trim()).toBe('Converting PDF to WORD...');
  });

  it('should render the circular spinner track and arc', () => {
    const el = fixture.nativeElement as HTMLElement;
    const svgEl = el.querySelector('.circular-spinner-svg');
    const trackEl = el.querySelector('.spinner-track');
    const arcEl = el.querySelector('.spinner-arc');

    expect(svgEl).toBeTruthy();
    expect(trackEl).toBeTruthy();
    expect(arcEl).toBeTruthy();
  });

  it('should not contain any rectangular progress bar elements', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.progress-bar-fill')).toBeNull();
    expect(el.querySelector('.dribbble-progress-track')).toBeNull();
    expect(el.querySelector('.dribbble-progress-fill')).toBeNull();
  });
});
