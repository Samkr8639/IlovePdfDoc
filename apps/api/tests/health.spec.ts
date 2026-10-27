import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('should return 200 OK with healthy status and metadata matching contract', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject({
      status: 'healthy',
      service: 'paperflow-api',
      features: {
        browserProcessingAvailable: true,
        serverProcessingAvailable: true
      }
    });
    expect(response.body.data).toHaveProperty('uptime');
    expect(response.body.data).toHaveProperty('memory');
  });

  it('should return 404 with structured error envelope for non-existent route', async () => {
    const response = await request(app).get('/api/v1/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(response.body.error).toHaveProperty('message');
  });

  it('should serve OpenAPI 3.1 schema at /api/docs.json', async () => {
    const response = await request(app).get('/api/docs.json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('openapi', '3.1.0');
    expect(response.body.info).toHaveProperty('title', 'PaperFlow API');
    expect(response.body.paths).toHaveProperty('/api/v1/pdf-to-word/convert');
  });

  it('should serve interactive Swagger UI HTML at /api/docs/', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('swagger-ui');
  });
});
