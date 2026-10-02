import { R2 } from './core';

/**
 * SERVER-ONLY. The app's R2 client, configured from server-only env vars
 * (see .env.example). Never import this from a Client Component — the
 * browser only ever receives short-lived signed URLs from /api/storage/*.
 */

let warned = false;

export function isR2Configured(): boolean {
  const ok = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_PRIVATE_BUCKET && process.env.R2_PUBLIC_BUCKET && process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  if (!ok && !warned) {
    warned = true;
    console.warn('[r2] R2 env vars are not set — file uploads and stored files are disabled. See CLAUDE.md "File storage (Cloudflare R2)".');
  }
  return ok;
}

let client: R2 | null = null;

export function r2(): R2 {
  if (!client) {
    client = new R2({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      privateBucket: process.env.R2_PRIVATE_BUCKET!,
      publicBucket: process.env.R2_PUBLIC_BUCKET!,
      publicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/+$/, ''),
    });
  }
  return client;
}

/** Private-bucket key for one project file: {user_id}/{project_id}/{name}. */
export function projectKey(userId: string, projectId: string, name: string): string {
  return `${userId}/${projectId}/${name}`;
}
