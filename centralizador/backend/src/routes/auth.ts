import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  agencyName: z.string().min(2),
  nit: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId: string, agencyId: string) {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh';

  const accessToken = jwt.sign({ userId, agencyId }, secret, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ userId, agencyId }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new AppError('El email ya está registrado', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: data.agencyName,
          nit: data.nit,
          email: data.email,
          phone: data.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          agencyId: agency.id,
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          role: 'ADMIN',
        },
      });

      return { agency, user };
    });

    const tokens = generateTokens(result.user.id, result.agency.id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
        agency: {
          id: result.agency.id,
          name: result.agency.name,
        },
        ...tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { agency: true },
    });
    if (!user) throw new AppError('Credenciales inválidas', 401);
    if (!user.isActive) throw new AppError('Usuario desactivado', 403);

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) throw new AppError('Credenciales inválidas', 401);

    const tokens = generateTokens(user.id, user.agencyId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        agency: {
          id: user.agency.id,
          name: user.agency.name,
        },
        ...tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { agency: true },
    });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        agency: {
          id: user.agency.id,
          name: user.agency.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token requerido', 400);

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh';
    const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: string; agencyId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) throw new AppError('Usuario inválido', 401);

    const tokens = generateTokens(user.id, user.agencyId);

    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
});

export default router;
