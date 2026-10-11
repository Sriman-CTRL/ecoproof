import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.factor.findMany({ orderBy: { sourceType: 'asc' } });
for (const r of rows) console.log(`${r.sourceType}\t${r.version ?? '-'}\t${r.id}`);
await prisma.$disconnect();
