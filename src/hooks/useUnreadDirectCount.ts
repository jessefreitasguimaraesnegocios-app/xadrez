import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUnreadDirectCount() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
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
  };

  useEffect(() => {
    fetchCount();
  }, [myId]);

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
  }, [myId]);

  return count;
}
