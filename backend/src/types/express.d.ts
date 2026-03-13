import 'express';

export type BackendUserRole = 'patient' | 'doctor' | 'nurse' | 'admin' | 'super_admin';

export interface BackendRequestUser {
  userId: string;
  email: string;
  role: BackendUserRole;
  organizationId?: string;
  permissions?: string[];
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: BackendRequestUser;
      requestId?: string;
    }
  }
}

