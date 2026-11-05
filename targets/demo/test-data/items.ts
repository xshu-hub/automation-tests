import { z } from 'zod';

export const itemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  owner: z.string(),
});

export type Item = z.infer<typeof itemSchema>;

export const invalidTitles = ['', '   '];
