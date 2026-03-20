import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/commissions
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', status, insurerId, period } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { agencyId: req.agencyId };
    if (status) where.status = status;
    if (insurerId) where.insurerId = insurerId;
    if (period) where.period = period;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: {
          policy: { select: { policyNumber: true, holderName: true, branch: true } },
          insurer: { select: { slug: true, name: true, logoUrl: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.commission.count({ where }),
    ]);

    res.json({
      success: true,
      data: commissions,
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

// GET /api/commissions/stats/summary
router.get('/stats/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byInsurer, totals] = await Promise.all([
      prisma.commission.groupBy({
        by: ['status'],
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { commissionAmount: true },
      }),
      prisma.commission.groupBy({
        by: ['insurerId'],
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { commissionAmount: true },
      }),
      prisma.commission.aggregate({
        where: { agencyId: req.agencyId },
        _sum: { commissionAmount: true },
        _count: true,
      }),
    ]);

    res.json({ success: true, data: { byStatus, byInsurer, totals } });
  } catch (error) {
    next(error);
  }
});

export default router;
