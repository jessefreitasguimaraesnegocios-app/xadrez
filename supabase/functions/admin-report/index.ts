import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const HOUSE_CUT_PCT = 0.2;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GameRow = {
  id: string;
  bet_amount: number | null;
  result: string | null;
  ended_at: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
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

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    let fromParam = body?.from ?? url.searchParams.get("from");
    let toParam = body?.to ?? url.searchParams.get("to");
    if (typeof toParam === "string" && toParam.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      toParam = `${toParam}T23:59:59.999Z`;
    }

    let query = supabase
      .from("games")
      .select("id, bet_amount, result, ended_at")
      .eq("status", "completed")
      .in("result", ["white_wins", "black_wins"])
      .gt("bet_amount", 0)
      .order("ended_at", { ascending: false });

    if (fromParam) {
      query = query.gte("ended_at", fromParam);
    }
    if (toParam) {
      query = query.lte("ended_at", toParam);
    }

    const { data: games, error: gamesError } = await query;

    if (gamesError) {
      return new Response(
        JSON.stringify({ error: gamesError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const rows = (games ?? []) as GameRow[];
    const items = rows.map((g) => {
      const bet = Number(g.bet_amount ?? 0);
      const pot = bet * 2;
      const fee = Math.round(pot * HOUSE_CUT_PCT * 100) / 100;
      return {
        game_id: g.id,
        bet_amount: bet,
        pot,
        platform_fee: fee,
        result: g.result,
        ended_at: g.ended_at,
      };
    });
    const totalRevenue = items.reduce((sum, i) => sum + i.platform_fee, 0);

    return new Response(
      JSON.stringify({
        total_revenue: Math.round(totalRevenue * 100) / 100,
        count: items.length,
        items,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
