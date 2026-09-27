'use client';

import { initializePaddle, type Paddle } from '@paddle/paddle-js';

import { getPaddleEnv } from './config';

let paddlePromise: Promise<Paddle | undefined> | null = null;

/** Lazily initializes Paddle.js once and caches the promise — call this
 * from a click handler (or effect) right before opening checkout. */
export function getPaddle(): Promise<Paddle | undefined> {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) return Promise.resolve(undefined);
  if (!paddlePromise) {
    paddlePromise = initializePaddle({ token, environment: getPaddleEnv() });
  }
  return paddlePromise;
}
