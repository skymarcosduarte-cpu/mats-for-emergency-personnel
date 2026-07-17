import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { alertId, targetUserId, contactType } = await req.json();
    if (
      !targetUserId ||
      typeof targetUserId !== "string" ||
      !["call", "whatsapp"].includes(contactType)
    ) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Validate the caller is a responder for an active help_request or panic_event owned by targetUserId
    const [{ data: help }, { data: panic }] = await Promise.all([
      admin
        .from("help_request_responders")
        .select("id, help_requests!inner(user_id)")
        .eq("responder_id", callerId)
        .eq("help_requests.user_id", targetUserId)
        .limit(1),
      admin
        .from("panic_event_responders")
        .select("id, panic_events!inner(user_id)")
        .eq("responder_id", callerId)
        .eq("panic_events.user_id", targetUserId)
        .limit(1),
    ]);
    if ((help?.length ?? 0) === 0 && (panic?.length ?? 0) === 0) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("nickname, full_name")
      .eq("id", callerId)
      .single();
    const name = profile?.nickname || profile?.full_name || "Un rescatista";

    const title = contactType === "call"
      ? "📞 Rescatista te está llamando"
      : "💬 Rescatista te escribió por WhatsApp";

    await admin.from("notifications").insert({
      user_id: targetUserId,
      type: "responder_contact",
      title,
      message: `${name} intenta contactarte para ayudarte con tu emergencia.`,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-responder-contact] error:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});