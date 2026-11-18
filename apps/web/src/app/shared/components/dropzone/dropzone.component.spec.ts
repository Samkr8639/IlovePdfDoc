import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DropzoneComponent } from './dropzone.component';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';

describe('DropzoneComponent', () => {
  let component: DropzoneComponent;
  let fixture: ComponentFixture<DropzoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropzoneComponent],
      providers: [
        provideRouter([]),
        {
          provide: ToolRegistryService,
          useValue: {
            getToolByRoute: vi.fn().mockReturnValue(null)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DropzoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component with initial empty state (no ball visible)', () => {
    expect(component).toBeTruthy();
    expect(component.hasBall()).toBe(false);
    expect(component.uploadedCount()).toBe(0);
    const compiled = fixture.nativeElement as HTMLElement;
    const ballEl = compiled.querySelector('.file-ball');
    expect(ballEl).toBeTruthy();
    expect(ballEl?.classList.contains('visible')).toBe(false);
  });

  it('spawns the file at the launch position when user selects a file', () => {
    const file = new File(['test content'], 'sample-invoice.pdf', { type: 'application/pdf' });
    const event = {
      target: {
        files: [file],
        value: ''
      }
    } as unknown as Event;

    component.onFileInputChange(event);
    fixture.detectChanges();

    expect(component.hasBall()).toBe(true);
    expect(component.ballLabel()).toBe('sample-invoice.pdf');
    expect(component.fileBadge()).toBe('PDF');

    const compiled = fixture.nativeElement as HTMLElement;
    const ballEl = compiled.querySelector('.file-ball');
    expect(ballEl?.classList.contains('visible')).toBe(true);
  });

  it('computes correct extension badge for different file types', () => {
    const jpgFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    const event = {
      target: {
        files: [jpgFile],
        value: ''
      }
    } as unknown as Event;

    component.onFileInputChange(event);
    expect(component.fileBadge()).toBe('JPG');
  });

  it('launches the file into the net and emits filesSelected on score', async () => {
    vi.useFakeTimers();
    (component as any).reduceMotion = true;
    const file = new File(['test'], 'contract.pdf', { type: 'application/pdf' });
    const emitSpy = vi.fn();
    component.filesSelected.subscribe(emitSpy);

    // Select file
    component.onFileInputChange({
      target: { files: [file], value: '' }
    } as unknown as Event);

    expect(component.hasBall()).toBe(true);

    // User takes shot / launches file into net
    component.takeShot();

    // Fast-forward score timeline timers
    vi.advanceTimersByTime(2000);

    expect(emitSpy).toHaveBeenCalledWith([file]);
    expect(component.uploadedCount()).toBe(1);
    expect(component.hasBall()).toBe(false);

    vi.useRealTimers();
  });
});
