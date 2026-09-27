import { Environment, Paddle } from '@paddle/paddle-node-sdk';

import { getPaddleEnv } from './config';

/** SERVER-ONLY: uses PADDLE_API_KEY. Create a fresh instance per call site
 * (cheap — it's just a configured HTTP client), never module-level shared
 * across requests, matching the Supabase server client's pattern. */
export function createPaddleClient(): Paddle {
  return new Paddle(process.env.PADDLE_API_KEY!, {
    environment: getPaddleEnv() === 'production' ? Environment.production : Environment.sandbox,
  });
}
