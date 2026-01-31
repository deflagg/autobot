import { z } from 'zod';

export const EnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  ts: z.number().optional(),
  payload: z.unknown().optional(),
  ok: z.boolean().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

export type Envelope<T = unknown> = z.infer<typeof EnvelopeSchema> & {
  payload?: T;
};

export const StatusGetSchema = EnvelopeSchema.extend({
  type: z.literal('status.get'),
});

export const StatusResultSchema = EnvelopeSchema.extend({
  type: z.literal('status.result'),
  ok: z.literal(true),
  payload: z.object({
    daemon: z.object({
      pid: z.number(),
      uptimeMs: z.number(),
    }),
  }),
});

export const AuthLoginStartSchema = EnvelopeSchema.extend({
  type: z.literal('auth.login.start'),
});

export const AuthStatusGetSchema = EnvelopeSchema.extend({
  type: z.literal('auth.status.get'),
});

export const UpdateCreateSchema = EnvelopeSchema.extend({
  type: z.literal('update.create'),
  payload: z.object({
    goal: z.string(),
  }),
});

export const UpdateCreatedSchema = EnvelopeSchema.extend({
  type: z.literal('update.created'),
  ok: z.literal(true),
  payload: z.object({
    updateId: z.string(),
    path: z.string(),
  }),
});
