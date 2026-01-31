export type Envelope<T = unknown> = {
  id: string;
  type: string;
  ts?: number;
  payload?: T;
  ok?: boolean;
  error?: { code: string; message: string; details?: unknown };
};
