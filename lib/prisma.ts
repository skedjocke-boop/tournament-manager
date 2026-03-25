// lib/prisma.ts
// Detta är "Rörledningen" mellan din app och din databas.
// Den förhindrar att Next.js skapar tusentals anslutningar när du sparar filer under utveckling.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'], // Skriver ut alla databasanrop i terminalen (bra för felsökning!)
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;