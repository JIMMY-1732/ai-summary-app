import { z } from 'zod';

export const summaryOptionsSchema = z.object({
  language: z.string().trim().min(2).max(40),
  length: z.enum(['short', 'medium', 'long']),
  tone: z.enum(['neutral', 'professional', 'simple']),
});

export const generateSummaryRequestSchema = z.object({
  documentId: z.string().uuid(),
  options: summaryOptionsSchema,
});

export const updateSummaryRequestSchema = z.object({
  contentMarkdown: z.string().trim().min(1),
});

export const summaryRecordSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  contentMarkdown: z.string(),
  language: z.string(),
  length: z.string(),
  tone: z.string(),
  isCurrent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SummaryOptions = z.infer<typeof summaryOptionsSchema>;
export type GenerateSummaryRequest = z.infer<typeof generateSummaryRequestSchema>;
export type UpdateSummaryRequest = z.infer<typeof updateSummaryRequestSchema>;
export type SummaryRecord = z.infer<typeof summaryRecordSchema>;
