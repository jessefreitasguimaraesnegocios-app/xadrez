import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const DIRECT_MESSAGES_READ_EVENT = "direct-messages-marked-read";

export function useUnreadDirectCount() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!myId) {
      setCount(0);
      return;
    }
    const { count: n, error } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", myId)
      .is("read_at", null);
    if (error) {
      setCount(0);
      return;
    }
    setCount(n ?? 0);
  }, [myId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel("unread-direct-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => fetchCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, fetchCount]);

  useEffect(() => {
    const handler = () => fetchCount();
    window.addEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
    return () => window.removeEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
  }, [fetchCount]);

  return { count, refetch: fetchCount };
}
