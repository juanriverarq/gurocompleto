import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ConnectorEngine } from '../connectors/engine';

const router = Router();

// GET /api/insurers - List all available insurers (public)
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const insurers = await prisma.insurer.findMany({
      orderBy: { name: 'asc' },
    });

    const engine = ConnectorEngine.getInstance();
    const activeConnectors = engine.listConnectors().map((c) => c.slug);

    const enriched = insurers.map((ins) => ({
      ...ins,
      hasConnector: activeConnectors.includes(ins.slug),
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// GET /api/insurers/:slug - Get insurer details
router.get('/:slug', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const insurer = await prisma.insurer.findUnique({
      where: { slug: String(req.params.slug) },
    });

    if (!insurer) {
      res.status(404).json({ success: false, error: 'Aseguradora no encontrada' });
      return;
    }

    res.json({ success: true, data: insurer });
  } catch (error) {
    next(error);
  }
});

export default router;
