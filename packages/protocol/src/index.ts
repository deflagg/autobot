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

export const DoctorRunSchema = EnvelopeSchema.extend({
  type: z.literal('doctor.run'),
});

export const DoctorResultSchema = EnvelopeSchema.extend({
  type: z.literal('doctor.result'),
  ok: z.literal(true),
  payload: z.object({
    checks: z.array(
      z.object({
        name: z.string(),
        ok: z.boolean(),
        message: z.string().optional(),
      })
    ),
  }),
});

export const AuthLoginStartSchema = EnvelopeSchema.extend({
  type: z.literal('auth.login.start'),
  payload: z
    .object({
      providerId: z.string().optional(),
    })
    .optional(),
});

export const AuthStatusGetSchema = EnvelopeSchema.extend({
  type: z.literal('auth.status.get'),
  payload: z
    .object({
      providerId: z.string().optional(),
    })
    .optional(),
});

export const AuthLoginCompleteSchema = EnvelopeSchema.extend({
  type: z.literal('auth.login.complete'),
  payload: z.object({
    providerId: z.string().optional(),
    code: z.string().optional(),
    state: z.string().optional(),
    redirectUrl: z.string().optional(),
  }),
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

export const UpdateApplySchema = EnvelopeSchema.extend({
  type: z.literal('update.apply'),
  payload: z.object({
    updateId: z.string(),
  }),
});

export const UpdateAppliedSchema = EnvelopeSchema.extend({
  type: z.literal('update.applied'),
  ok: z.literal(true),
  payload: z.object({
    updateId: z.string(),
    commit: z.string(),
  }),
});

export const UpdateRollbackSchema = EnvelopeSchema.extend({
  type: z.literal('update.rollback'),
  payload: z.object({
    ref: z.string().optional(),
  }),
});

export const UpdateRolledBackSchema = EnvelopeSchema.extend({
  type: z.literal('update.rolledBack'),
  ok: z.literal(true),
  payload: z.object({
    head: z.string(),
  }),
});

export const LoopStartSchema = EnvelopeSchema.extend({
  type: z.literal('loop.start'),
  payload: z.object({
    goal: z.string(),
    maxIterations: z.number().optional(),
    maxMinutes: z.number().optional(),
    retry: z.number().optional(),
  }),
});

export const LoopStatusSchema = EnvelopeSchema.extend({
  type: z.literal('loop.status.get'),
  payload: z.object({
    loopId: z.string().optional(),
  }).optional(),
});

export const LoopStopSchema = EnvelopeSchema.extend({
  type: z.literal('loop.stop'),
  payload: z.object({
    loopId: z.string(),
  }),
});
