import { Router, Request, Response, NextFunction } from 'express';
import { TOOL_REGISTRY, ToolDefinition, ApiResponse } from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';

export const toolsRouter = Router();

/**
 * GET /api/v1/tools
 * Retrieves the full list of available tools, with optional filtering by category, status, or search query.
 */
toolsRouter.get('/', (req: Request, res: Response) => {
  const { category, status, q } = req.query;

  let tools: ToolDefinition[] = [...TOOL_REGISTRY];

  if (typeof category === 'string' && category !== 'all') {
    tools = tools.filter(t => t.category === category);
  }

  if (typeof status === 'string') {
    tools = tools.filter(t => t.status === status);
  }

  if (typeof q === 'string' && q.trim()) {
    const query = q.toLowerCase().trim();
    tools = tools.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.shortDescription.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }

  const response: ApiResponse<ToolDefinition[]> = {
    success: true,
    data: tools,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});

/**
 * GET /api/v1/tools/categories
 * Returns distinct tool categories with their tool count.
 */
toolsRouter.get('/categories', (_req: Request, res: Response) => {
  const counts = TOOL_REGISTRY.reduce((acc, tool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories = Object.entries(counts).map(([id, count]) => ({
    id,
    count
  }));

  const response: ApiResponse<Array<{ id: string; count: number }>> = {
    success: true,
    data: categories,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});

/**
 * GET /api/v1/tools/:id
 * Retrieves metadata and configuration for an individual tool by ID or route.
 */
toolsRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const cleanId = id.startsWith('/') ? id.slice(1) : id;

  const tool = TOOL_REGISTRY.find(t => t.id === cleanId || t.route === `/${cleanId}` || t.route === cleanId);

  if (!tool) {
    return next(new AppError(404, 'TOOL_NOT_FOUND', `Tool '${id}' not found`));
  }

  const response: ApiResponse<ToolDefinition> = {
    success: true,
    data: tool,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});
