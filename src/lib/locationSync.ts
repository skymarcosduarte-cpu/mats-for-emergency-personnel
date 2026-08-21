import { supabase } from '@/integrations/supabase/client';

export interface LocationSyncFields {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  is_online?: boolean;
}

const EXPIRY_MARGIN_SECONDS = 60;

/**
 * Returns a valid authenticated user id, refreshing the session when it is
 * missing or about to expire. Returns null when there is no usable session.
 *
 * RLS on user_locations checks auth.uid() = user_id, so writing with a stale
 * user id from React state (while the JWT has expired) fails silently.
 */
export async function getFreshAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) return null;

    const expiresAt = session.expires_at ?? 0;
    const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);

    if (secondsLeft <= EXPIRY_MARGIN_SECONDS) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.user?.id ?? null;
    }

    return session.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Upserts the current user's location using the id from the live session.
 * Retries once after a forced token refresh if the database rejects the write
 * with a row-level-security / permission error.
 */
export async function upsertUserLocation(
  fields: LocationSyncFields
): Promise<{ ok: boolean; error?: unknown }> {
  const userId = await getFreshAuthUserId();
  if (!userId) {
    console.warn('[locationSync] Skipped: no active session');
    return { ok: false, error: 'no-session' };
  }

  const payload = {
    user_id: userId,
    lat: fields.lat,
    lng: fields.lng,
    accuracy: fields.accuracy ?? null,
    heading: fields.heading ?? null,
    speed: fields.speed ?? null,
    is_online: fields.is_online ?? true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_locations')
    .upsert(payload, { onConflict: 'user_id' });

  if (!error) return { ok: true };

  const isRlsError =
    error.code === '42501' ||
    /row-level security|permission denied|JWT/i.test(error.message ?? '');

  if (!isRlsError) {
    console.warn('[locationSync] Upsert failed:', error);
    return { ok: false, error };
  }

  // Token likely expired mid-flight: refresh and retry once.
  const { data: refreshed } = await supabase.auth.refreshSession();
  const retryUserId = refreshed.session?.user?.id;
  if (!retryUserId) {
    console.warn('[locationSync] Refresh failed, location not stored');
    return { ok: false, error };
  }

  const { error: retryError } = await supabase
    .from('user_locations')
    .upsert({ ...payload, user_id: retryUserId }, { onConflict: 'user_id' });

  if (retryError) {
    console.warn('[locationSync] Retry after refresh failed:', retryError);
    return { ok: false, error: retryError };
  }

  return { ok: true };
}

/**
 * Touches presence fields only (never overwrites GPS coordinates).
 * Creates the row if it does not exist yet.
 */
export async function touchUserPresence(isOnline = true): Promise<boolean> {
  const userId = await getFreshAuthUserId();
  if (!userId) return false;

  const { error, count } = await supabase
    .from('user_locations')
    .update(
      { is_online: isOnline, updated_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .select('user_id');

  if (error) {
    console.warn('[locationSync] Presence update failed:', error);
    return false;
  }

  if (!count) {
    // No row yet: create the presence row with neutral coordinates.
    const { error: insertError } = await supabase
      .from('user_locations')
      .upsert(
        {
          user_id: userId,
          lat: 0,
          lng: 0,
          is_online: isOnline,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
    if (insertError) {
      console.warn('[locationSync] Presence insert failed:', insertError);
      return false;
    }
  }

  return true;
}
