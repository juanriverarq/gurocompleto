import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/encryption';
import { ConnectorEngine } from '../connectors/engine';

const router = Router();
router.use(authenticate);

const createConnectionSchema = z.object({
  insurerSlug: z.string(),
  username: z.string().min(1),
  password: z.string().min(1),
  extraConfig: z.record(z.any()).optional(),
});

// GET /api/connections - List all connections for agency
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connections = await prisma.insurerConnection.findMany({
      where: { agencyId: req.agencyId },
      include: {
        insurer: true,
        _count: { select: { syncLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = connections.map((c) => ({
      id: c.id,
      insurer: c.insurer,
      username: c.username,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError,
      autoSync: c.autoSync,
      syncIntervalMin: c.syncIntervalMin,
      syncCount: c._count.syncLogs,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, data: sanitized });
  } catch (error) {
    next(error);
  }
});

// POST /api/connections - Create & test connection
// For SURA: uses cookie-paste auth (extraConfig.cookies)
// For others: uses username/password credentials
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createConnectionSchema.parse(req.body);

    const insurer = await prisma.insurer.findUnique({ where: { slug: data.insurerSlug } });
    if (!insurer) throw new AppError('Aseguradora no encontrada', 404);
    if (!insurer.isActive) throw new AppError('Conector no disponible aún', 400);

    // Allow re-connection for cookie-based connectors (cookies expire)
    const existing = await prisma.insurerConnection.findUnique({
      where: { agencyId_insurerId: { agencyId: req.agencyId!, insurerId: insurer.id } },
    });
    const isCookieAuth = !!data.extraConfig?.cookies;
    if (existing && !isCookieAuth) {
      throw new AppError('Ya existe una conexión con esta aseguradora. Elimínala primero para reconectar.', 409);
    }

    const passwordEnc = encrypt(data.password);

    // Test connection
    const engine = ConnectorEngine.getInstance();
    const testResult = await engine.testConnection(insurer.slug, {
      username: data.username,
      password: data.password,
      extraConfig: data.extraConfig,
    });

    if (!testResult.success) {
      res.status(400).json({
        success: false,
        message: testResult.error || 'Error de conexión',
      });
      return;
    }

    // Create or update connection
    const connectionData = {
      agencyId: req.agencyId!,
      insurerId: insurer.id,
      username: data.username,
      passwordEnc,
      extraConfig: data.extraConfig || undefined,
      sessionData: testResult.sessionData || undefined,
      status: 'CONNECTED' as const,
      lastError: null,
    };

    let connection;
    if (existing) {
      connection = await prisma.insurerConnection.update({
        where: { id: existing.id },
        data: connectionData,
        include: { insurer: true },
      });
    } else {
      connection = await prisma.insurerConnection.create({
        data: connectionData,
        include: { insurer: true },
      });
    }

    res.status(201).json({
      success: true,
      message: testResult.userInfo?.name
        ? `Conectado como ${testResult.userInfo.name}`
        : 'Conexión exitosa',
      data: {
        id: connection.id,
        insurer: connection.insurer,
        username: connection.username,
        status: connection.status,
        userInfo: testResult.userInfo,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/connections/:id/test - Test existing connection
router.post('/:id/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connection = await prisma.insurerConnection.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
      include: { insurer: true },
    });
    if (!connection) throw new AppError('Conexión no encontrada', 404);

    const password = decrypt(connection.passwordEnc);
    const engine = ConnectorEngine.getInstance();
    const result = await engine.testConnection((connection as any).insurer.slug, {
      username: connection.username,
      password,
      extraConfig: connection.extraConfig as Record<string, any>,
    });

    await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: {
        status: result.success ? 'CONNECTED' : 'ERROR',
        lastError: result.error || null,
        sessionData: result.sessionData || connection.sessionData,
      },
    });

    res.json({ success: true, data: { connected: result.success, error: result.error } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/connections/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connection = await prisma.insurerConnection.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
    });
    if (!connection) throw new AppError('Conexión no encontrada', 404);

    await prisma.insurerConnection.delete({ where: { id: connection.id } });

    res.json({ success: true, message: 'Conexión eliminada' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/connections/:id - Update connection settings
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connection = await prisma.insurerConnection.findFirst({
      where: { id: String(req.params.id), agencyId: req.agencyId },
    });
    if (!connection) throw new AppError('Conexión no encontrada', 404);

    const updateData: any = {};
    if (req.body.username) updateData.username = req.body.username;
    if (req.body.password) updateData.passwordEnc = encrypt(req.body.password);
    if (req.body.autoSync !== undefined) updateData.autoSync = req.body.autoSync;
    if (req.body.syncIntervalMin) updateData.syncIntervalMin = req.body.syncIntervalMin;

    const updated = await prisma.insurerConnection.update({
      where: { id: connection.id },
      data: updateData,
      include: { insurer: true },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        insurer: updated.insurer,
        username: updated.username,
        status: updated.status,
        autoSync: updated.autoSync,
        syncIntervalMin: updated.syncIntervalMin,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
