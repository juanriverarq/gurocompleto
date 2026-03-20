import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/policies
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', status, insurerId, search, branch } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { agencyId: req.agencyId };
    if (status) where.status = status;
    if (insurerId) where.insurerId = insurerId;
    if (branch) where.branch = { contains: branch, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { policyNumber: { contains: search, mode: 'insensitive' } },
        { holderName: { contains: search, mode: 'insensitive' } },
        { holderDocument: { contains: search } },
        { product: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [policies, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        include: { insurer: { select: { slug: true, name: true, logoUrl: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.policy.count({ where }),
    ]);

    res.json({
      success: true,
      data: policies,
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

// GET /api/policies/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policy = await prisma.policy.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
      include: {
        insurer: true,
        client: true,
        payments: { orderBy: { paymentNumber: 'asc' } },
        commissions: true,
      },
    });

    if (!policy) {
      res.status(404).json({ success: false, error: 'Póliza no encontrada' });
      return;
    }

    res.json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

// GET /api/policies/stats/summary
router.get('/stats/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byInsurer, byBranch, totals] = await Promise.all([
      prisma.policy.groupBy({
        by: ['status'],
        where: { agencyId: req.agencyId },
        _count: true,
      }),
      prisma.policy.groupBy({
        by: ['insurerId'],
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.policy.groupBy({
        by: ['branch'],
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.policy.aggregate({
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { totalAmount: true, premium: true, commissionAmount: true },
      }),
    ]);

    res.json({
      success: true,
      data: { byStatus, byInsurer, byBranch, totals },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
