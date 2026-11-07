import { z } from "zod";

export const IMAGE_KINDS = ["entry", "exit", "htf", "other"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** Client-compressed upload descriptor sent alongside the file bytes. */
export const registerImageFormSchema = z.object({
  tradeId: z.uuid(),
  caption: z
    .string()
    .max(200)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  kind: z.enum(IMAGE_KINDS).optional(),
  width: z.coerce.number().int().min(1).max(20_000).optional(),
  height: z.coerce.number().int().min(1).max(20_000).optional(),
  /** Tiny (~8px) blurred thumbnail from the client canvas. */
  blurDataUrl: z
    .string()
    .max(4_000)
    .optional()
    .refine((value) => value === undefined || value.startsWith("data:image/"), {
      message: "blurDataUrl must be an image data URL",
    }),
});

export const updateTradeImageSchema = z.object({
  imageId: z.uuid(),
  caption: z
    .string()
    .max(200)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  kind: z.enum(IMAGE_KINDS).optional(),
});

export const deleteTradeImageSchema = z.object({
  imageId: z.uuid(),
});

export const reorderTradeImagesSchema = z.object({
  tradeId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1).max(50),
});

export type RegisterImageForm = z.infer<typeof registerImageFormSchema>;
