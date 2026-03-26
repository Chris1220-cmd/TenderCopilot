import { z } from 'zod';

export const educationSchema = z.object({
  id: z.string().optional(),
  degree: z.string().min(1),
  institution: z.string().min(1),
  year: z.coerce.number().int().min(1950).max(2030).nullish(),
});

export const experienceSchema = z.object({
  id: z.string().optional(),
  projectName: z.string().min(1),
  client: z.string().min(1),
  role: z.string().min(1),
  budget: z.coerce.number().nonnegative().nullish(),
  startYear: z.coerce.number().int().min(1950).max(2030),
  endYear: z.coerce.number().int().min(1950).max(2030).nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
});

export const certificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  issuer: z.string().min(1),
  issueDate: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
});

export const teamMemberCreateSchema = z.object({
  fullName: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  totalExperience: z.coerce.number().int().min(0).default(0),
  bio: z.string().nullish(),
  cvFileKey: z.string().nullish(),
  cvFileName: z.string().nullish(),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export const teamMemberUpdateSchema = teamMemberCreateSchema.partial().extend({
  id: z.string().cuid(),
  isActive: z.boolean().optional(),
});

export type TeamMemberFormValues = z.infer<typeof teamMemberCreateSchema>;
export type EducationEntry = z.infer<typeof educationSchema>;
export type ExperienceEntry = z.infer<typeof experienceSchema>;
export type CertificationEntry = z.infer<typeof certificationSchema>;
