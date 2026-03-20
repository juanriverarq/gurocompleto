import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/dashboard - Main dashboard stats
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agencyId = req.agencyId!;

    const [
      totalPolicies,
      activePolicies,
      totalClients,
      totalConnections,
      activeConnections,
      pendingPayments,
      pendingCommissions,
      recentSyncs,
      policiesByInsurer,
      expiringPolicies,
    ] = await Promise.all([
      prisma.policy.count({ where: { agencyId } }),
      prisma.policy.count({ where: { agencyId, status: 'ACTIVE' } }),
      prisma.client.count({ where: { agencyId } }),
      prisma.insurerConnection.count({ where: { agencyId } }),
      prisma.insurerConnection.count({ where: { agencyId, status: 'CONNECTED' } }),
      prisma.payment.aggregate({
        where: { agencyId, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { balance: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { agencyId, status: 'PENDING' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      prisma.syncLog.findMany({
        where: { agencyId },
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          connection: {
            include: { insurer: { select: { slug: true, name: true } } },
          },
        },
      }),
      prisma.policy.groupBy({
        by: ['insurerId'],
        where: { agencyId, status: 'ACTIVE' },
        _count: true,
        _sum: { totalAmount: true, commissionAmount: true },
      }),
      prisma.policy.count({
        where: {
          agencyId,
          status: 'ACTIVE',
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // next 30 days
          },
        },
      }),
    ]);

    // Get insurer names for policiesByInsurer
    const insurerIds = policiesByInsurer.map((p) => p.insurerId);
    const insurers = await prisma.insurer.findMany({
      where: { id: { in: insurerIds } },
      select: { id: true, slug: true, name: true, logoUrl: true },
    });
    const insurerMap = Object.fromEntries(insurers.map((i) => [i.id, i]));

    res.json({
      success: true,
      data: {
        overview: {
          totalPolicies,
          activePolicies,
          totalClients,
          totalConnections,
          activeConnections,
          expiringPolicies,
        },
        cartera: {
          pendingPaymentsCount: pendingPayments._count,
          pendingPaymentsAmount: pendingPayments._sum.balance || 0,
          pendingCommissionsCount: pendingCommissions._count,
          pendingCommissionsAmount: pendingCommissions._sum.commissionAmount || 0,
        },
        policiesByInsurer: policiesByInsurer.map((p) => ({
          insurer: insurerMap[p.insurerId],
          count: p._count,
          totalAmount: p._sum.totalAmount || 0,
          commissionAmount: p._sum.commissionAmount || 0,
        })),
        recentSyncs,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
