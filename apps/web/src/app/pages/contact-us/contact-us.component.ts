import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactService } from '../../core/services/contact.service';
import { SeoService } from '../../core/services/seo.service';
import { ContactSubmissionResult } from '@paperflow/contracts';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  userType: 'individual' | 'company';
  productInterests: Record<string, boolean>;
  message: string;
}

@Component({
  selector: 'app-contact-us',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.css'
})
export class ContactUsComponent implements OnInit {
  private readonly contactService = inject(ContactService);
  private readonly seo = inject(SeoService);

  readonly currentStep = signal<number>(1);
  readonly isSubmitting = signal<boolean>(false);
  readonly apiError = signal<string | null>(null);
  readonly submissionResult = signal<ContactSubmissionResult | null>(null);

  readonly productInterestOptions: string[] = ['Web', 'Desktop', 'Mobile', 'Signature', 'REST API'];

  formData: ContactFormData = {
    name: '',
    email: '',
    subject: 'Sales',
    userType: 'individual',
    productInterests: {
      Web: true,
      Desktop: false,
      Mobile: false,
      Signature: false,
      'REST API': false
    },
    message: ''
  };

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Contact Us - Get in Touch with PDFTailor Support & Sales',
      description: 'Contact PDFTailor to report a problem, get support, inquire about volume licensing, or ask about our 100% in-browser document privacy.',
      keywords: ['contact pdftailor', 'support', 'pdf tools help', 'enterprise licensing'],
      canonical: 'https://pdftailor.in/contact-us',
      faqs: [
        {
          question: 'How fast will I receive a reply?',
          answer: 'Our typical response time is under 4 business hours for technical issues and under 24 hours for general inquiries.'
        },
        {
          question: 'Are my uploaded documents sent with this form?',
          answer: 'No. This form only submits your message and inquiry details. We never access or upload your local documents.'
        }
      ]
    });
  }

  getStepTitle(): string {
    switch (this.currentStep()) {
      case 1: return 'Your Details';
      case 2: return 'Profile & Product';
      case 3: return 'Your Message';
      case 4: return 'Review & Send';
      default: return '';
    }
  }

  isStep1Valid(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      this.formData.name.trim().length >= 2 &&
      emailRegex.test(this.formData.email.trim()) &&
      this.formData.subject.trim().length > 0
    );
  }

  goToStep(step: number): void {
    this.apiError.set(null);
    if (step === 2 && !this.isStep1Valid()) {
      return;
    }
    if (step === 4 && this.formData.message.trim().length < 10) {
      return;
    }
    this.currentStep.set(step);
  }

  getSelectedInterestsString(): string {
    return Object.entries(this.formData.productInterests)
      .filter(([_, checked]) => checked)
      .map(([name]) => name)
      .join(', ');
  }

  submitInquiry(): void {
    if (this.isSubmitting()) {
      return;
    }

    const interests = Object.entries(this.formData.productInterests)
      .filter(([_, checked]) => checked)
      .map(([name]) => name);

    const payload = {
      name: this.formData.name.trim(),
      email: this.formData.email.trim(),
      subject: this.formData.subject,
      userType: this.formData.userType,
      productInterests: interests,
      message: this.formData.message.trim()
    };

    this.isSubmitting.set(true);
    this.apiError.set(null);

    this.contactService.submitInquiry(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res && res.success) {
          this.submissionResult.set(res.data);
        } else {
          this.apiError.set('Unexpected response from server. Please try again.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = err?.error?.error?.message || 'Could not submit your message. Please check your connection and try again.';
        this.apiError.set(errMsg);
      }
    });
  }

  resetForm(): void {
    this.submissionResult.set(null);
    this.currentStep.set(1);
    this.apiError.set(null);
    this.formData = {
      name: '',
      email: '',
      subject: 'Sales',
      userType: 'individual',
      productInterests: {
        Web: true,
        Desktop: false,
        Mobile: false,
        Signature: false,
        'REST API': false
      },
      message: ''
    };
  }
}
