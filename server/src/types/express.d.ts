import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        firstName?: string;
        lastName?: string;
        email?: string;
      };
    }
  }
}

export {};