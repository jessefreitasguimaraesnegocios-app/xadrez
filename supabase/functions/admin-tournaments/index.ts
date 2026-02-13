import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  format: string;
  max_participants: number;
  entry_fee: number;
  platform_fee_pct: number;
  prize_pool?: number;
  time_control: string;
  times_per_day: number;
  time_slots: string[];
  duration_minutes: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "list";

    if (action === "list") {
      const { data: templates, error } = await supabase
        .from("tournament_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ templates: templates ?? [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const {
        name,
        description,
        format = "swiss",
        max_participants = 32,
        entry_fee = 0,
        platform_fee_pct = 10,
        prize_pool = 0,
        time_control = "10+0",
        times_per_day = 1,
        time_slots = ["20:00"],
        duration_minutes,
        active = true,
      } = body;
      if (!name || typeof name !== "string") {
        return new Response(JSON.stringify({ error: "name required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await supabase
        .from("tournament_templates")
        .insert({
          name: name.trim(),
          description: description ?? null,
          format: ["swiss", "knockout", "round_robin"].includes(format) ? format : "swiss",
          max_participants: Math.max(2, Math.min(256, Number(max_participants) || 32)),
          entry_fee: Math.max(0, Number(entry_fee) || 0),
          platform_fee_pct: Math.max(0, Math.min(100, Number(platform_fee_pct) ?? 10)),
          prize_pool: Math.max(0, Number(prize_pool) || 0),
          time_control: String(time_control || "10+0").trim(),
          times_per_day: Math.max(1, Math.min(24, Number(times_per_day) || 1)),
          time_slots: Array.isArray(time_slots) ? time_slots.map(String) : ["20:00"],
          duration_minutes: duration_minutes != null ? Number(duration_minutes) : null,
          active: Boolean(active),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: row?.id, ok: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const id = body?.id;
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.description !== undefined) updates.description = body.description;
      if (body.format !== undefined) updates.format = body.format;
      if (body.max_participants !== undefined) updates.max_participants = body.max_participants;
      if (body.entry_fee !== undefined) updates.entry_fee = body.entry_fee;
      if (body.platform_fee_pct !== undefined) updates.platform_fee_pct = body.platform_fee_pct;
      if (body.prize_pool !== undefined) updates.prize_pool = Math.max(0, Number(body.prize_pool) || 0);
      if (body.time_control !== undefined) updates.time_control = body.time_control;
      if (body.times_per_day !== undefined) updates.times_per_day = body.times_per_day;
      if (body.time_slots !== undefined) updates.time_slots = body.time_slots;
      if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes;
      if (body.active !== undefined) updates.active = body.active;
      const { error } = await supabase.from("tournament_templates").update(updates).eq("id", id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const id = body?.id;
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("tournament_templates").delete().eq("id", id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "list_tournaments") {
      const limit = Math.min(500, Math.max(1, Number(body?.limit) ?? 100));
      const { data: list, error } = await supabase
        .from("tournaments")
        .select("id, name, status, starts_at, entry_fee, max_participants")
        .in("status", ["upcoming", "in_progress"])
        .order("starts_at", { ascending: true })
        .limit(limit);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ tournaments: list ?? [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_tournament") {
      const id = body?.id;
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_tournaments_bulk") {
      const ids = body?.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "ids array required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const validIds = ids.slice(0, 500).filter((x: unknown) => typeof x === "string");
      const { error } = await supabase.from("tournaments").delete().in("id", validIds);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, deleted: validIds.length }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const daysAhead = Math.max(1, Math.min(30, Number(body?.daysAhead) ?? 7));
      const { data: templates, error: tErr } = await supabase
        .from("tournament_templates")
        .select("*")
        .eq("active", true);
      if (tErr) {
        return new Response(
          JSON.stringify({ error: "Falha ao buscar templates", details: tErr.message, generated: 0 }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      if (!templates?.length) {
        return new Response(
          JSON.stringify({ error: "Nenhum template ativo. Ative um template em Administração → Torneios.", generated: 0 }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const now = new Date();
      const inserted: { id: string; name: string; starts_at: string }[] = [];
      for (let d = 0; d < daysAhead; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10);
        for (const t of templates as TemplateRow[]) {
          const slots = Array.isArray(t.time_slots) && t.time_slots.length > 0 ? t.time_slots : ["20:00"];
          for (const slot of slots) {
            const [h = "20", m = "0"] = String(slot).split(":");
            const startsAt = new Date(date);
            startsAt.setHours(Number(h) || 20, Number(m) || 0, 0, 0);
            if (startsAt.getTime() < now.getTime() && d === 0) continue;
            const name = `${t.name} – ${dateStr} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            const entryFee = Number(t.entry_fee) ?? 0;
            const prizePool = Math.max(0, Number(t.prize_pool) ?? 0);
            const { data: row, error: insErr } = await supabase
              .from("tournaments")
              .insert({
                name,
                description: t.description,
                format: t.format,
                max_participants: t.max_participants,
                entry_fee: entryFee,
                prize_pool: prizePool,
                time_control: t.time_control,
                status: "upcoming",
                starts_at: startsAt.toISOString(),
              })
              .select("id, name, starts_at")
              .single();
            if (!insErr && row) {
              inserted.push({
                id: row.id,
                name: row.name,
                starts_at: row.starts_at,
              });
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ ok: true, generated: inserted.length, tournaments: inserted }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
