import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/payments
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', status, insurerId, policyId } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { agencyId: req.agencyId };
    if (status) where.status = status;
    if (insurerId) where.insurerId = insurerId;
    if (policyId) where.policyId = policyId;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          policy: { select: { policyNumber: true, holderName: true, branch: true } },
          insurer: { select: { slug: true, name: true, logoUrl: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { dueDate: 'asc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
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

// GET /api/payments/stats/summary
router.get('/stats/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [byStatus, totals] = await Promise.all([
      prisma.payment.groupBy({
        by: ['status'],
        where: { agencyId: req.agencyId },
        _count: true,
        _sum: { amountDue: true, amountPaid: true, balance: true },
      }),
      prisma.payment.aggregate({
        where: { agencyId: req.agencyId },
        _sum: { amountDue: true, amountPaid: true, balance: true },
        _count: true,
      }),
    ]);

    res.json({ success: true, data: { byStatus, totals } });
  } catch (error) {
    next(error);
  }
});

export default router;
