import request from 'supertest';
import { createApp } from '../src/app';

describe('POST /api/v1/contact', () => {
  const app = createApp();

  it('should accept valid multi-step contact submission and return 201 with ticketId', async () => {
    const payload = {
      name: 'Sameer Kumar',
      email: 'sam@zealousys.com',
      subject: 'Sales',
      userType: 'individual',
      productInterests: ['Web', 'REST API'],
      message: 'I would like to inquire about high-volume document batch licensing.'
    };

    const res = await request(app)
      .post('/api/v1/contact')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('ticketId');
    expect(res.body.data.ticketId).toMatch(/^TKT-\d{4}-\d{5}$/);
    expect(res.body.data).toHaveProperty('receivedAt');
    expect(res.body.data.estimatedResponseHours).toBe(2);
    expect(res.body.data.message).toContain('Sameer Kumar');
  });

  it('should reject submission with missing name or invalid email', async () => {
    const invalidPayload = {
      name: '',
      email: 'invalid-email-string',
      subject: 'Support',
      message: 'Short'
    };

    const res = await request(app)
      .post('/api/v1/contact')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('should reject message that is shorter than 10 characters', async () => {
    const payload = {
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Support',
      message: 'Too short'
    };

    const res = await request(app)
      .post('/api/v1/contact')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const hasMessageError = res.body.error.details.some((d: any) => d.field === 'message');
    expect(hasMessageError).toBe(true);
  });
});
