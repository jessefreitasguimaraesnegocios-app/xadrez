import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DIRECT_MESSAGES_READ_EVENT } from "./useUnreadDirectCount";

/** Mapa sender_id -> quantidade de mensagens não lidas (recebidas por mim) */
export function useUnreadBySender(): Record<string, number> {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [bySender, setBySender] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!myId) {
      setBySender({});
      return;
    }
    const { data, error } = await supabase
      .from("direct_messages")
      .select("sender_id")
      .eq("receiver_id", myId)
      .is("read_at", null);

    if (error) {
      setBySender({});
      return;
    }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = row.sender_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    setBySender(counts);
  }, [myId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel("unread-by-sender")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => fetchCounts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, fetchCounts]);

  useEffect(() => {
    const handler = () => fetchCounts();
    window.addEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
    return () => window.removeEventListener(DIRECT_MESSAGES_READ_EVENT, handler);
  }, [fetchCounts]);

  return bySender;
}
