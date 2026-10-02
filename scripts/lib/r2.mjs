/**
 * R2 client for maintenance scripts, configured from the same env vars as
 * the app (run scripts with `node --env-file=.env.local ...`).
 */
import { R2 } from '../../src/lib/r2/core.ts';

export function r2FromEnv() {
  const env = process.env;
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET', 'NEXT_PUBLIC_R2_PUBLIC_URL'].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')} — add them to .env.local (see .env.example) and run with: node --env-file=.env.local <script>`);
    process.exit(1);
  }
  return new R2({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    privateBucket: env.R2_PRIVATE_BUCKET,
    publicBucket: env.R2_PUBLIC_BUCKET,
    publicUrl: env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/+$/, ''),
  });
}
