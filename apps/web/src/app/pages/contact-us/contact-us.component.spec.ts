import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ContactUsComponent } from './contact-us.component';
import { ContactService } from '../../core/services/contact.service';
import { SeoService } from '../../core/services/seo.service';

describe('ContactUsComponent', () => {
  let component: ContactUsComponent;
  let fixture: ComponentFixture<ContactUsComponent>;
  let contactService: ContactService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactUsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ContactService,
        SeoService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactUsComponent);
    component = fixture.componentInstance;
    contactService = TestBed.inject(ContactService);
    fixture.detectChanges();
  });

  it('should create the contact us component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the Contact title and initial Step 1', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.contact-title');
    expect(title?.textContent?.trim()).toBe('Contact');
    expect(component.currentStep()).toBe(1);
    expect(component.getStepTitle()).toBe('Your Details');
  });

  it('should validate Step 1 before allowing progression to Step 2', () => {
    expect(component.isStep1Valid()).toBe(false);

    component.formData.name = 'Sameer Kumar';
    component.formData.email = 'sam@zealousys.com';
    component.formData.subject = 'Sales';
    expect(component.isStep1Valid()).toBe(true);

    component.goToStep(2);
    expect(component.currentStep()).toBe(2);
  });

  it('should advance to Step 3 and Step 4 when message requirement is met', () => {
    component.formData.name = 'Sameer Kumar';
    component.formData.email = 'sam@zealousys.com';
    component.formData.subject = 'Sales';
    component.goToStep(2);

    component.goToStep(3);
    expect(component.currentStep()).toBe(3);

    // Message too short
    component.formData.message = 'Hi';
    component.goToStep(4);
    expect(component.currentStep()).toBe(3);

    // Message valid
    component.formData.message = 'I would like to inquire about licensing.';
    component.goToStep(4);
    expect(component.currentStep()).toBe(4);
  });

  it('should submit inquiry and display success state', () => {
    const mockResponse = {
      success: true as const,
      data: {
        ticketId: 'TKT-2026-99999',
        receivedAt: new Date().toISOString(),
        estimatedResponseHours: 2,
        message: 'Your inquiry has been received.'
      }
    };

    vi.spyOn(contactService, 'submitInquiry').mockReturnValue(of(mockResponse));

    component.formData.name = 'Sameer Kumar';
    component.formData.email = 'sam@zealousys.com';
    component.formData.subject = 'Sales';
    component.formData.message = 'Valid message that exceeds ten characters.';

    component.submitInquiry();
    fixture.detectChanges();

    expect(component.submissionResult()).toBeTruthy();
    expect(component.submissionResult()?.ticketId).toBe('TKT-2026-99999');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.success-title')?.textContent).toContain('Message Received!');
  });
});
