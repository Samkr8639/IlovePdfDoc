import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, ContactSubmissionPayload, ContactSubmissionResult } from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  subject: z.string().trim().min(2, 'Please select or enter a subject'),
  userType: z.enum(['individual', 'company']).default('individual'),
  productInterests: z.array(z.string()).default([]),
  message: z.string().trim().min(10, 'Message must be at least 10 characters')
});

/**
 * POST /api/v1/contact
 * Handles multi-step contact form submissions, validates payloads, and issues a tracked support ticket.
 */
contactRouter.post('/', (req: Request, res: Response, next: NextFunction) => {
  const result = contactSchema.safeParse(req.body);

  if (!result.success) {
    const errorDetails = result.error.issues.map(err => ({
      field: err.path.join('.'),
      issue: err.message
    }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid contact form submission', errorDetails));
  }

  const payload: ContactSubmissionPayload = result.data;
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const ticketId = `TKT-${new Date().getFullYear()}-${randomSuffix}`;

  const submissionResult: ContactSubmissionResult = {
    ticketId,
    receivedAt: new Date().toISOString(),
    estimatedResponseHours: payload.subject.toLowerCase().includes('sales') ? 2 : 4,
    message: `Thank you ${payload.name}, your inquiry regarding "${payload.subject}" has been received. Our team will review it and reply directly to ${payload.email}.`
  };

  const response: ApiResponse<ContactSubmissionResult> = {
    success: true,
    data: submissionResult,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(201).json(response);
});
