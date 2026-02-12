import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const VOICE_SIGNAL_EVENT = "voice-signal";
const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type CallStatus = "idle" | "calling" | "ringing" | "connecting" | "connected" | "ended";

type SignalPayload =
  | { type: "call-request"; from: string }
  | { type: "call-accept"; from: string }
  | { type: "call-reject"; from: string }
  | { type: "call-end"; from: string }
  | { type: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; candidate: RTCIceCandidateInit };

function getChannelName(myId: string, remoteId: string): string {
  const ids = [myId, remoteId].sort();
  return `voice-${ids[0]}-${ids[1]}`;
}

export function useVoiceCall(remoteUserId: string | null) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    setStatus("idle");
    setError(null);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
    }
  }, []);

  const createPeerAsCaller = useCallback(
    async (channel: ReturnType<typeof supabase.channel>) => {
      const stream = localStreamRef.current;
      if (!stream || !myId) return;
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (e.streams?.[0]) attachRemoteStream(e.streams[0]);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({
            type: "broadcast",
            event: VOICE_SIGNAL_EVENT,
            payload: { type: "ice", from: myId, candidate: e.candidate.toJSON() },
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({
        type: "broadcast",
        event: VOICE_SIGNAL_EVENT,
        payload: { type: "offer", from: myId, sdp: offer },
      });
    },
    [myId, attachRemoteStream]
  );

  const handleOffer = useCallback(
    async (channel: ReturnType<typeof supabase.channel>, offer: RTCSessionDescriptionInit) => {
      const stream = localStreamRef.current;
      if (!stream || !myId) return;
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (e.streams?.[0]) attachRemoteStream(e.streams[0]);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: VOICE_SIGNAL_EVENT,
            payload: { type: "ice", from: myId, candidate: e.candidate.toJSON() },
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const c of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({
        type: "broadcast",
        event: VOICE_SIGNAL_EVENT,
        payload: { type: "answer", from: myId, sdp: answer },
      });
      setStatus("connected");
    },
    [myId, attachRemoteStream]
  );

  useEffect(() => {
    if (!myId || !remoteUserId) return;
    const channelName = getChannelName(myId, remoteUserId);
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: VOICE_SIGNAL_EVENT }, async (payload: { payload: SignalPayload }) => {
        const msg = payload?.payload;
        if (!msg || msg.from !== remoteUserId) return;

        if (msg.type === "call-reject" || msg.type === "call-end") {
          cleanup();
          return;
        }
        if (msg.type === "call-request") {
          setStatus("ringing");
        }
        if (msg.type === "call-accept") {
          setStatus("connecting");
          createPeerAsCaller(channel);
        }
        if (msg.type === "offer" && msg.sdp) {
          await handleOffer(channel, msg.sdp);
        }
        if (msg.type === "answer" && msg.sdp && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          setStatus("connected");
        }
        if (msg.type === "ice" && msg.candidate) {
          if (peerRef.current) {
            try {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (_) {}
          } else {
            pendingCandidatesRef.current.push(msg.candidate);
          }
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [myId, remoteUserId, cleanup, createPeerAsCaller, handleOffer]);

  const startCall = useCallback(async () => {
    if (!myId || !remoteUserId || !channelRef.current) return;
    setError(null);
    setStatus("calling");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch (err) {
      setError("Não foi possível acessar o microfone.");
      setStatus("idle");
      return;
    }
    channelRef.current.send({
      type: "broadcast",
      event: VOICE_SIGNAL_EVENT,
      payload: { type: "call-request", from: myId },
    });
  }, [myId, remoteUserId]);

  const acceptCall = useCallback(async () => {
    if (!myId || !remoteUserId || !channelRef.current) return;
    setError(null);
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch (err) {
      setError("Não foi possível acessar o microfone.");
      setStatus("idle");
      return;
    }
    channelRef.current.send({
      type: "broadcast",
      event: VOICE_SIGNAL_EVENT,
      payload: { type: "call-accept", from: myId },
    });
  }, [myId, remoteUserId]);

  const rejectCall = useCallback(() => {
    if (channelRef.current && myId) {
      channelRef.current.send({
        type: "broadcast",
        event: VOICE_SIGNAL_EVENT,
        payload: { type: "call-reject", from: myId },
      });
    }
    cleanup();
  }, [myId, cleanup]);

  const endCall = useCallback(() => {
    if (channelRef.current && myId) {
      channelRef.current.send({
        type: "broadcast",
        event: VOICE_SIGNAL_EVENT,
        payload: { type: "call-end", from: myId },
      });
    }
    cleanup();
  }, [myId, cleanup]);

  return {
    status,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    setRemoteAudioRef: (el: HTMLAudioElement | null) => {
      remoteAudioRef.current = el;
    },
  };
}
