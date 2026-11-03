import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorPalettePickerComponent, ColorPreset } from './color-palette-picker.component';

describe('ColorPalettePickerComponent', () => {
  let component: ColorPalettePickerComponent;
  let fixture: ComponentFixture<ColorPalettePickerComponent>;

  const mockPresets: ColorPreset[] = [
    { value: 'var(--pt-amber)', cssClass: 'amber', title: 'Yellow' },
    { value: 'var(--pt-teal-700)', cssClass: 'teal', title: 'Teal' },
    { value: 'var(--pt-coral)', cssClass: 'coral', title: 'Pink' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColorPalettePickerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ColorPalettePickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('currentColor', 'var(--pt-amber)');
    fixture.componentRef.setInput('presets', mockPresets);
    fixture.detectChanges();
  });

  it('renders presets and detects preset active state', () => {
    expect(component.isCustomActive()).toBe(false);
    expect(component.customColorValue()).toBe('#14213D');
  });

  it('detects custom color and emits color change', () => {
    let emitted = '';
    component.colorChange.subscribe(c => (emitted = c));

    fixture.componentRef.setInput('currentColor', '#10B981');
    fixture.detectChanges();

    expect(component.isCustomActive()).toBe(true);
    expect(component.customColorValue()).toBe('#10B981');

    component.onCustomChange('#6366F1');
    expect(emitted).toBe('#6366F1');
  });
});
