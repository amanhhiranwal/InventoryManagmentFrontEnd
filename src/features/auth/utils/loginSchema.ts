import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Invalid email"),

  password: z
    .string()
    .min(6, "Minimum 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;