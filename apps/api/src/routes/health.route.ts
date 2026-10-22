import { Router, Request, Response } from 'express';
import { ApiResponse, HealthCheckData } from '@paperflow/contracts';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  
  const healthData: HealthCheckData = {
    status: 'healthy',
    service: 'paperflow-api',
    version: env.API_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100
    },
    features: {
      browserProcessingAvailable: true,
      serverProcessingAvailable: true
    }
  };

  const response: ApiResponse<HealthCheckData> = {
    success: true,
    data: healthData,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});
