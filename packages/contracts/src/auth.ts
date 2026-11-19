import { z } from 'zod';
import { UserRoleSchema } from './rbac.js';

export const BootstrapOrgSchema = z.object({
  organizationName: z.string().min(2).max(120),
  organizationSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  jurisdiction: z.string().min(2).max(10).default('NG'),
  branchName: z.string().min(2).max(120),
  branchCode: z.string().min(2).max(20),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2).max(120),
  adminPassword: z.string().min(12).max(128),
});

export const LoginSchema = z.object({
  organizationSlug: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(1),
});

export const MfaVerifySchema = z.object({
  mfaChallengeToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/),
});

export const MfaEnableSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export const CreateStaffUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: UserRoleSchema,
  password: z.string().min(12).max(128),
  branchId: z.string().uuid(),
  department: z.string().max(80).optional(),
});

export type BootstrapOrgDto = z.infer<typeof BootstrapOrgSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;
export type MfaEnableDto = z.infer<typeof MfaEnableSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type CreateStaffUserDto = z.infer<typeof CreateStaffUserSchema>;
