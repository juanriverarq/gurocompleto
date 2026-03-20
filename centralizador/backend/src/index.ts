import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import connectionRoutes from './routes/connections';
import policyRoutes from './routes/policies';
import clientRoutes from './routes/clients';
import paymentRoutes from './routes/payments';
import commissionRoutes from './routes/commissions';
import syncRoutes from './routes/sync';
import dashboardRoutes from './routes/dashboard';
import insurerRoutes from './routes/insurers';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/insurers', insurerRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`Centralizador API running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
