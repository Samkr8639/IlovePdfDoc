import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/v1/tools', () => {
  const app = createApp();

  it('should return 200 OK with list of all tools in standard ApiResponse envelope', async () => {
    const res = await request(app).get('/api/v1/tools');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const firstTool = res.body.data[0];
    expect(firstTool).toHaveProperty('id');
    expect(firstTool).toHaveProperty('name');
    expect(firstTool).toHaveProperty('category');
    expect(firstTool).toHaveProperty('route');
    expect(firstTool).toHaveProperty('processingMode');
  });

  it('should filter tools by category', async () => {
    const res = await request(app).get('/api/v1/tools?category=organize');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((t: any) => t.category === 'organize')).toBe(true);
  });

  it('should filter tools by search query', async () => {
    const res = await request(app).get('/api/v1/tools?q=merge');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const hasMerge = res.body.data.some((t: any) => t.id === 'merge-pdf');
    expect(hasMerge).toBe(true);
  });

  it('should return category statistics at /api/v1/tools/categories', async () => {
    const res = await request(app).get('/api/v1/tools/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('count');
  });

  it('should return a specific tool by ID at /api/v1/tools/:id', async () => {
    const res = await request(app).get('/api/v1/tools/merge-pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('merge-pdf');
    expect(res.body.data.name).toBe('Merge PDF');
  });

  it('should return 404 for unknown tool ID', async () => {
    const res = await request(app).get('/api/v1/tools/non-existent-tool');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOOL_NOT_FOUND');
  });
});
