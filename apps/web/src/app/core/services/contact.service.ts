import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, ContactSubmissionPayload, ContactSubmissionResult } from '@paperflow/contracts';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly http = inject(HttpClient);

  submitInquiry(payload: ContactSubmissionPayload): Observable<ApiResponse<ContactSubmissionResult>> {
    return this.http.post<ApiResponse<ContactSubmissionResult>>(`${environment.apiBaseUrl}/contact`, payload);
  }
}
