import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

// Send push notification using Web Push protocol
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(payload));

    // Import VAPID keys
    const publicKeyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    // Create JWT for VAPID
    const header = { alg: "ES256", typ: "JWT" };
    const audience = new URL(subscription.endpoint).origin;
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: audience,
      exp: now + 86400,
      sub: "mailto:mats@lovable.dev",
    };

    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const claimsB64 = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedToken = `${headerB64}.${claimsB64}`;

    // Import private key for signing
    const privateKey = await crypto.subtle.importKey(
      "raw",
      privateKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${unsignedToken}.${signatureB64}`;

    // Generate encryption keys
    const localKeys = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const localPublicKey = await crypto.subtle.exportKey("raw", localKeys.publicKey);

    // Import subscriber's public key
    const subscriberKeyBytes = Uint8Array.from(
      atob(subscription.p256dh.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      subscriberKeyBytes,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeys.privateKey,
      256
    );

    // Get auth secret
    const authSecret = Uint8Array.from(
      atob(subscription.auth.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    // Derive encryption key using HKDF
    const sharedSecretKey = await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    // Create info for HKDF
    const keyInfo = encoder.encode("Content-Encoding: aes128gcm\0");
    const nonceInfo = encoder.encode("Content-Encoding: nonce\0");

    const prk = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: authSecret,
        info: encoder.encode("WebPush: info\0"),
      },
      sharedSecretKey,
      256
    );

    const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

    const contentKey = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: keyInfo },
      prkKey,
      128
    );

    const nonce = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: nonceInfo },
      prkKey,
      96
    );

    // Encrypt payload
    const aesKey = await crypto.subtle.importKey(
      "raw",
      contentKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Add padding
    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload[0] = 0;
    paddedPayload[1] = 0;
    paddedPayload.set(payloadBytes, 2);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    );

    // Build the body
    const recordSize = 4096;
    const header_bytes = new Uint8Array(86 + new Uint8Array(localPublicKey).length);
    const dv = new DataView(header_bytes.buffer);
    
    // Salt (16 bytes)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    header_bytes.set(salt, 0);
    
    // Record size (4 bytes)
    dv.setUint32(16, recordSize, false);
    
    // Key ID length (1 byte)
    header_bytes[20] = 65;
    
    // Key ID (local public key - 65 bytes)
    header_bytes.set(new Uint8Array(localPublicKey), 21);

    const body = new Uint8Array(header_bytes.length + encrypted.byteLength);
    body.set(header_bytes, 0);
    body.set(new Uint8Array(encrypted), header_bytes.length);

    // Make request
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Urgency": "high",
      },
      body,
    });

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() };
    }

    return { success: true, status: response.status };
  } catch (error) {
    console.error("[sendPushNotification] Error:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    // Require authenticated admin (SOS_ACTIVO role) to broadcast app-update push
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminCheck = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await adminCheck.rpc('is_admin', { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[notify-app-update] Missing VAPID keys");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { version, releaseNotes, isMandatory } = await req.json();

    if (!version) {
      return new Response(
        JSON.stringify({ error: "Version is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-app-update] Sending notifications for version ${version}`);

    // Get all push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id");

    if (subError) {
      console.error("[notify-app-update] Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[notify-app-update] No subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-app-update] Found ${subscriptions.length} subscriptions`);

    // Prepare notification payload
    const title = isMandatory ? "🔄 Actualización Requerida" : "🆕 Nueva Versión Disponible";
    const body = releaseNotes 
      ? `Versión ${version}: ${releaseNotes}`
      : `La versión ${version} de MATS está disponible. ${isMandatory ? "Es necesario actualizar." : "¡Actualiza para las últimas mejoras!"}`;

    const payload = {
      title,
      body,
      icon: "/icon-192-v2.png",
      badge: "/icon-192-v2.png",
      tag: `app-update-${version}`,
      alertType: "UPDATE",
      data: {
        version,
        isMandatory,
        url: "/",
      },
    };

    // Send to all subscriptions
    let sent = 0;
    let failed = 0;
    const invalidSubscriptions: string[] = [];

    const results = await Promise.allSettled(
      (subscriptions as PushSubscription[]).map(async (sub) => {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (result.success) {
          return { success: true, id: sub.id };
        } else {
          if (result.status === 404 || result.status === 410) {
            invalidSubscriptions.push(sub.id);
          }
          console.error(`[notify-app-update] Failed to send to ${sub.user_id}:`, result.error);
          return { success: false, id: sub.id };
        }
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.success) {
        sent++;
      } else {
        failed++;
      }
    });

    // Remove invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      console.log(`[notify-app-update] Removing ${invalidSubscriptions.length} invalid subscriptions`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", invalidSubscriptions);
    }

    console.log(`[notify-app-update] Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        removed: invalidSubscriptions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-app-update] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
