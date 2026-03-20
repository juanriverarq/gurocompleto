import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  agencyId?: string;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticación requerido', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const decoded = jwt.verify(token, secret) as { userId: string; agencyId: string };

    req.userId = decoded.userId;
    req.agencyId = decoded.agencyId;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expirado', 401));
    } else if (error.name === 'JsonWebTokenError') {
      next(new AppError('Token inválido', 401));
    } else {
      next(error);
    }
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  authenticate(req, _res, async () => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new AppError('Se requieren permisos de administrador', 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  });
}
