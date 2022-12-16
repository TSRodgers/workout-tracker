import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface Context {
    prisma: PrismaClient
    req: any // HTTP header carrying the Auth header
};

export function createContext(req: any) {
    return {
        ...req,
        prisma,
    }
};