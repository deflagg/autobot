export type AuthStatus = {
  providerId: string;
  configured: boolean;
  refreshable?: boolean;
  expired?: boolean;
  expiresAt?: number | null;
  refreshError?: string | null;
};

export type StartLoginResult = {
  authUrl: string;
  callbackUrl?: string;
  state?: string;
};

export type CompleteLoginInput =
  | { redirectUrl: string }
  | { code: string; state: string };

export type CompleteLoginResult = { ok: true } | { ok: false; error: string };

export interface AuthProvider {
  id: string;
  startLogin: () => Promise<StartLoginResult>;
  completeLogin: (input: CompleteLoginInput) => Promise<CompleteLoginResult>;
  getStatus: () => Promise<AuthStatus>;
  ensureValidToken?: () => Promise<{ accessToken: string }>;
}

export const DEFAULT_PROVIDER_ID = 'openai-codex';
export const PROVIDER_IDS = [DEFAULT_PROVIDER_ID];

export function isProviderId(value: string): boolean {
  return PROVIDER_IDS.includes(value);
}
