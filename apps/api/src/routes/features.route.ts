import { Router, Request, Response } from 'express';
import { ApiFeaturesData, ApiResponse } from '@paperflow/contracts';
import { isSignRequestsEnabled } from '../config/env';

export const featuresRouter = Router();

/**
 * GET /api/v1/features
 * Exposes safe public runtime feature flags so web clients align UI affordances with server kill switches.
 */
featuresRouter.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<ApiFeaturesData> = {
    success: true,
    data: {
      signRequestsEnabled: isSignRequestsEnabled()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});
