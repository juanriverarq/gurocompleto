import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { decrypt } from '../lib/encryption';
import { ConnectorEngine } from '../connectors/engine';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

// POST /api/sync/:connectionId - Trigger sync for a connection
router.post('/:connectionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connection = await prisma.insurerConnection.findFirst({
      where: { id: String(req.params.connectionId), agencyId: req.agencyId },
      include: { insurer: true },
    });
    if (!connection) throw new AppError('Conexión no encontrada', 404);
    if (connection.status === 'SYNCING') throw new AppError('Sincronización ya en progreso', 409);

    const syncLog = await prisma.syncLog.create({
      data: {
        agencyId: req.agencyId!,
        connectionId: connection.id,
        syncType: req.body.syncType || 'full',
        status: 'RUNNING',
      },
    });

    await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: { status: 'SYNCING' },
    });

    // Run sync in background
    runSync(connection, syncLog.id, req.agencyId!).catch((err) => {
      logger.error(`Background sync failed for ${connection.id}:`, err);
    });

    res.json({
      success: true,
      data: { syncLogId: syncLog.id, message: 'Sincronización iniciada' },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/logs - Get sync logs
router.get('/logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { connectionId, limit = '20' } = req.query as any;

    const where: any = { agencyId: req.agencyId };
    if (connectionId) where.connectionId = connectionId;

    const logs = await prisma.syncLog.findMany({
      where,
      include: {
        connection: {
          include: { insurer: { select: { slug: true, name: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: parseInt(limit),
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/logs/:id - Get specific sync log
router.get('/logs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const log = await prisma.syncLog.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
      include: {
        connection: {
          include: { insurer: true },
        },
      },
    });
    if (!log) throw new AppError('Log no encontrado', 404);

    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
});

// Background sync function
async function runSync(connection: any, syncLogId: string, agencyId: string) {
  const engine = ConnectorEngine.getInstance();
  const connector = engine.getConnector(connection.insurer.slug);

  if (!connector) {
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: { status: 'FAILED', errorMessage: `No connector for ${connection.insurer.slug}`, completedAt: new Date() },
    });
    await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: { status: 'ERROR', lastError: 'Connector not found' },
    });
    return;
  }

  try {
    const password = decrypt(connection.passwordEnc);
    const credentials = {
      username: connection.username,
      password,
      extraConfig: connection.extraConfig as Record<string, any>,
    };

    // Login or reuse session
    let session = connection.sessionData;
    if (!session) {
      session = await connector.login(credentials);
    }

    // Full sync with progress updates to DB
    const result = await connector.fullSync(session, credentials, async (msg, current, total) => {
      logger.info(`[${connection.insurer.slug}] ${msg} (${current}/${total})`);
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          metadata: { progressMessage: msg, progressCurrent: current, progressTotal: total },
        },
      }).catch(() => {});
    });

    // Upsert policies
    let policiesSynced = 0;
    for (const policy of result.policies) {
      try {
        // Find or create client
        let clientId: string | undefined;
        if (policy.holderDocument) {
          const client = await prisma.client.upsert({
            where: {
              agencyId_documentType_documentNumber: {
                agencyId,
                documentType: policy.holderDocumentType || 'CC',
                documentNumber: policy.holderDocument,
              },
            },
            update: {
              fullName: policy.holderName || 'Sin nombre',
              updatedAt: new Date(),
            },
            create: {
              agencyId,
              documentType: policy.holderDocumentType || 'CC',
              documentNumber: policy.holderDocument,
              fullName: policy.holderName || 'Sin nombre',
            },
          });
          clientId = client.id;
        }

        await prisma.policy.upsert({
          where: {
            agencyId_insurerId_policyNumber_renewalNumber: {
              agencyId,
              insurerId: connection.insurerId,
              policyNumber: policy.policyNumber,
              renewalNumber: policy.renewalNumber || 0,
            },
          },
          update: {
            clientId,
            branch: policy.branch,
            branchCode: policy.branchCode,
            product: policy.product,
            productCode: policy.productCode,
            status: policy.status as any,
            holderName: policy.holderName,
            holderDocument: policy.holderDocument,
            holderDocumentType: policy.holderDocumentType,
            insuredName: policy.insuredName,
            insuredDocument: policy.insuredDocument,
            startDate: policy.startDate,
            endDate: policy.endDate,
            issueDate: policy.issueDate,
            premium: policy.premium,
            iva: policy.iva,
            totalAmount: policy.totalAmount,
            commissionAmount: policy.commissionAmount,
            commissionPercentage: policy.commissionPercentage,
            paymentFrequency: policy.paymentFrequency,
            paymentMethod: policy.paymentMethod,
            office: policy.office,
            channel: policy.channel,
            rawData: policy.rawData,
            lastSyncAt: new Date(),
          },
          create: {
            agencyId,
            insurerId: connection.insurerId,
            clientId,
            policyNumber: policy.policyNumber,
            branch: policy.branch,
            branchCode: policy.branchCode,
            product: policy.product,
            productCode: policy.productCode,
            status: (policy.status as any) || 'ACTIVE',
            holderName: policy.holderName,
            holderDocument: policy.holderDocument,
            holderDocumentType: policy.holderDocumentType,
            insuredName: policy.insuredName,
            insuredDocument: policy.insuredDocument,
            startDate: policy.startDate,
            endDate: policy.endDate,
            issueDate: policy.issueDate,
            premium: policy.premium,
            iva: policy.iva,
            totalAmount: policy.totalAmount,
            commissionAmount: policy.commissionAmount,
            commissionPercentage: policy.commissionPercentage,
            paymentFrequency: policy.paymentFrequency,
            paymentMethod: policy.paymentMethod,
            office: policy.office,
            channel: policy.channel,
            renewalNumber: policy.renewalNumber || 0,
            rawData: policy.rawData,
            lastSyncAt: new Date(),
          },
        });
        policiesSynced++;
      } catch (err: any) {
        logger.warn(`Failed to upsert policy ${policy.policyNumber}: ${err.message}`);
      }
    }

    // Upsert clients from dedicated client fetch
    let clientsSynced = 0;
    for (const client of result.clients) {
      try {
        await prisma.client.upsert({
          where: {
            agencyId_documentType_documentNumber: {
              agencyId,
              documentType: client.documentType,
              documentNumber: client.documentNumber,
            },
          },
          update: {
            fullName: client.fullName,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            cellphone: client.cellphone,
            address: client.address,
            city: client.city,
            rawData: client.rawData,
            updatedAt: new Date(),
          },
          create: {
            agencyId,
            documentType: client.documentType,
            documentNumber: client.documentNumber,
            fullName: client.fullName,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            cellphone: client.cellphone,
            address: client.address,
            city: client.city,
            rawData: client.rawData,
          },
        });
        clientsSynced++;
      } catch (err: any) {
        logger.warn(`Failed to upsert client ${client.documentNumber}: ${err.message}`);
      }
    }

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: result.errors.length > 0 ? 'COMPLETED' : 'COMPLETED',
        itemsSynced: policiesSynced + clientsSynced,
        itemsFailed: result.errors.length,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        completedAt: new Date(),
        metadata: {
          policiesSynced,
          clientsSynced,
          paymentsSynced: result.payments.length,
          commissionsSynced: result.commissions.length,
        },
      },
    });

    // Update connection
    await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: {
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        lastError: null,
        sessionData: session,
      },
    });

    logger.info(`Sync completed for ${connection.insurer.slug}: ${policiesSynced} policies, ${clientsSynced} clients`);
  } catch (error: any) {
    logger.error(`Sync failed for ${connection.insurer.slug}:`, error);

    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        completedAt: new Date(),
      },
    });

    await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ERROR',
        lastError: error.message,
      },
    });
  }
}

export default router;
