import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { withRetry, isRetryableError, SUPABASE_STAGGER } from "@/lib/supabaseRetry";

export const DIRECT_MESSAGES_READ_EVENT = "direct-messages-marked-read";
/** Disparado quando a aba Amigos é aberta (para refetch do count). */
export const FRIENDS_TAB_OPENED_EVENT = "friends-tab-opened";

export function useUnreadDirectCount() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async (options?: { retryAndStagger?: boolean }) => {
    if (!myId) {
      setCount(0);
      return;
    }
    const run = async () => {
      const { count: n, error } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", myId)
        .is("read_at", null);
      if (error) {
        if (options?.retryAndStagger && isRetryableError(error)) throw error;
        setCount(0);
        return;
      }
      setCount(n ?? 0);
    };
    if (options?.retryAndStagger) {
      try {
        await withRetry(run, { initialDelayMs: SUPABASE_STAGGER.unreadDirectCount });
      } catch {
        setCount(0);
      }
    } else {
      await run();
    }
  }, [myId]);

  useEffect(() => {
    fetchCount({ retryAndStagger: true });
  }, [fetchCount]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`unread-direct-${myId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => fetchCount()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") fetchCount();
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    const onFocus = () => fetchCount();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fetchCount();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [myId, fetchCount]);

  useEffect(() => {
    const handler = () => fetchCount();
    window.addEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
    return () => window.removeEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
  }, [fetchCount]);

  useEffect(() => {
    const handler = () => fetchCount();
    window.addEventListener(FRIENDS_TAB_OPENED_EVENT, handler);
    return () => window.removeEventListener(FRIENDS_TAB_OPENED_EVENT, handler);
  }, [fetchCount]);

  return { count, refetch: fetchCount };
}
