import { z } from 'zod';

/**
 * Login credential contract.
 * Strictly forbids arbitrary payload injection to prevent credential stuffing exploits.
 */
export const LoginInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(1, 'Password is required')
      .max(128, 'Password cannot exceed 128 characters'),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * User registration contract.
 * Enforces length constraints and strict schema binding.
 */
export const RegisterInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password cannot exceed 128 characters'),
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    departmentId: z
      .string()
      .trim()
      .max(64, 'Department ID cannot exceed 64 characters')
      .nullable()
      .optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
