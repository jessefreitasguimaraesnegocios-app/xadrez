import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DIRECT_MESSAGES_READ_EVENT } from "./useUnreadDirectCount";

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_username?: string;
}

export function useDirectChat(friendUserId: string | null) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friendUserId || !myId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        supabase
          .from("direct_messages")
          .select("id, sender_id, receiver_id, content, created_at")
          .eq("sender_id", myId)
          .eq("receiver_id", friendUserId)
          .order("created_at", { ascending: true }),
        supabase
          .from("direct_messages")
          .select("id, sender_id, receiver_id, content, created_at")
          .eq("sender_id", friendUserId)
          .eq("receiver_id", myId)
          .order("created_at", { ascending: true }),
      ]);
      const list = [...(r1.data ?? []), ...(r2.data ?? [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(list as DirectMessage[]);
      setLoading(false);
    };

    fetchMessages();
  }, [friendUserId, myId]);

  const markAsRead = useCallback(async () => {
    if (!friendUserId || !myId) return;
    const { error } = await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", myId)
      .eq("sender_id", friendUserId)
      .is("read_at", null);
    if (!error) {
      window.dispatchEvent(new CustomEvent(DIRECT_MESSAGES_READ_EVENT));
    }
  }, [friendUserId, myId]);

  useEffect(() => {
    if (!friendUserId || !myId) return;
    markAsRead();
  }, [friendUserId, myId, markAsRead]);

  useEffect(() => {
    if (!friendUserId || !myId) return;

    const channel = supabase
      .channel(`direct-chat-${myId}-${friendUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };
          const isThisConversation =
            (row.sender_id === myId && row.receiver_id === friendUserId) ||
            (row.sender_id === friendUserId && row.receiver_id === myId);
          if (isThisConversation) {
            setMessages((prev) => [...prev, row as DirectMessage]);
          }
        }
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible" && friendUserId && myId) {
        const fetchMessages = async () => {
          const [r1, r2] = await Promise.all([
            supabase.from("direct_messages").select("id, sender_id, receiver_id, content, created_at").eq("sender_id", myId).eq("receiver_id", friendUserId).order("created_at", { ascending: true }),
            supabase.from("direct_messages").select("id, sender_id, receiver_id, content, created_at").eq("sender_id", friendUserId).eq("receiver_id", myId).order("created_at", { ascending: true }),
          ]);
          const list = [...(r1.data ?? []), ...(r2.data ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(list as DirectMessage[]);
        };
        fetchMessages();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        const fetchMessages = async () => {
          const [r1, r2] = await Promise.all([
            supabase.from("direct_messages").select("id, sender_id, receiver_id, content, created_at").eq("sender_id", myId!).eq("receiver_id", friendUserId!).order("created_at", { ascending: true }),
            supabase.from("direct_messages").select("id, sender_id, receiver_id, content, created_at").eq("sender_id", friendUserId!).eq("receiver_id", myId!).order("created_at", { ascending: true }),
          ]);
          const list = [...(r1.data ?? []), ...(r2.data ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(list as DirectMessage[]);
        };
        fetchMessages();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [friendUserId, myId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!friendUserId || !myId || !content.trim()) return { error: new Error("Invalid input") };

      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: myId,
          receiver_id: friendUserId,
          content: content.trim(),
        })
        .select("id, sender_id, receiver_id, content, created_at")
        .single();

      if (error) return { error };
      if (data) setMessages((prev) => [...prev, data as DirectMessage]);
      return { error: null };
    },
    [friendUserId, myId]
  );

  return { messages, loading, sendMessage, markAsRead };
}
