import { z } from 'zod';

export const emailEntrySchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
});

export const passwordCreateSchema = z.object({
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' }),
  confirmPassword: z.string()
    .min(1, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const profileSetupSchema = z.object({
  fullName: z.string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' }),
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(20, { message: 'Username cannot exceed 20 characters' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' }),
  bio: z.string()
    .max(150, { message: 'Bio cannot exceed 150 characters' })
    .optional(),
});

export const phoneEntrySchema = z.object({
  phoneNumber: z.string()
    .trim()
    .min(7, { message: 'Please enter a valid phone number' }),
});

export type EmailEntryForm = z.infer<typeof emailEntrySchema>;
export type PasswordCreateForm = z.infer<typeof passwordCreateSchema>;
export type ProfileSetupForm = z.infer<typeof profileSetupSchema>;
export type PhoneEntryForm = z.infer<typeof phoneEntrySchema>;
