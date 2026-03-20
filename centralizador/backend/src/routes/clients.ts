import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/clients
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', search } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { agencyId: req.agencyId };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { cellphone: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { _count: { select: { policies: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { fullName: 'asc' },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      success: true,
      data: clients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
      include: {
        policies: {
          include: { insurer: { select: { slug: true, name: true, logoUrl: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
});

export default router;
