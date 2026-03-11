import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DIRECT_MESSAGES_READ_EVENT } from "./useUnreadDirectCount";
import { withRetry, isRetryableError, SUPABASE_STAGGER } from "@/lib/supabaseRetry";

/** Mapa sender_id -> quantidade de mensagens não lidas (recebidas por mim) */
export function useUnreadBySender(): Record<string, number> {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [bySender, setBySender] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async (options?: { retryAndStagger?: boolean }) => {
    if (!myId) {
      setBySender({});
      return;
    }
    const run = async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("sender_id")
        .eq("receiver_id", myId)
        .is("read_at", null);

      if (error) {
        if (options?.retryAndStagger && isRetryableError(error)) throw error;
        setBySender({});
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = row.sender_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      setBySender(counts);
    };
    if (options?.retryAndStagger) {
      try {
        await withRetry(run, { initialDelayMs: SUPABASE_STAGGER.unreadBySender });
      } catch {
        setBySender({});
      }
    } else {
      await run();
    }
  }, [myId]);

  useEffect(() => {
    fetchCounts({ retryAndStagger: true });
  }, [fetchCounts]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`unread-by-sender-${myId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => fetchCounts()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") fetchCounts();
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCounts();
    };
    document.addEventListener("visibilitychange", onVisible);

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fetchCounts();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [myId, fetchCounts]);

  useEffect(() => {
    const handler = () => fetchCounts();
    window.addEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
    return () => window.removeEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
  }, [fetchCounts]);

  return bySender;
}
