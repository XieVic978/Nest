let channelSequence = 0;

/**
 * Supabase Realtime reuses an existing channel when its topic matches. React
 * screens can remount before an asynchronous removeChannel call has finished,
 * so every effect instance needs its own topic to avoid attaching listeners to
 * a channel that has already subscribed.
 */
export function createRealtimeChannelName(scope: string) {
  channelSequence += 1;
  return `${scope}-${Date.now()}-${channelSequence}-${Math.random().toString(36).slice(2, 9)}`;
}
