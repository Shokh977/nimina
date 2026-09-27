/** Subscription statuses that keep a user on the Pro plan.
 *
 * `active` and `trialing` are the two Paddle explicitly calls
 * access-granting. `past_due` is included too, deliberately: Paddle
 * retries a failed payment for a while (dunning), and downgrading
 * instantly on the first failed charge is bad UX — the user only actually
 * loses Pro once Paddle gives up and moves the subscription to `canceled`
 * (or `paused`), which fires its own status-changing event.
 *
 * A subscription with a *scheduled* cancellation (customer clicked cancel
 * in the portal) is NOT downgraded by this — `status` stays `active` until
 * the change actually takes effect, and this function only ever looks at
 * `status`. The pending change is tracked separately
 * (`subscriptions.scheduled_change_action`/`scheduled_change_at`) purely
 * for display. */
const ACCESS_GRANTING_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function subscriptionGrantsAccess(status: string): boolean {
  return ACCESS_GRANTING_STATUSES.has(status);
}
