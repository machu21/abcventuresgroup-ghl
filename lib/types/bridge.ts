import { z } from 'zod';

// Define the schema for validation
export const LeadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone format"),
  email: z.string().email().optional().or(z.literal('')),
  tag: z.enum(['cold', 'warm', 'hot'], {
    error: "Tag must be 'cold', 'warm', or 'hot'"
  }),
});

// Extract the TypeScript type from the schema
export type LeadPayload = z.infer<typeof LeadSchema>;