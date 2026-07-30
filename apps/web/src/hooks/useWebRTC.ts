"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CollabProvider } from "@/lib/collab-provider";
import { ICE_SERVERS } from "@/lib/webrtc-config";
import type {
  IceCandidate,
  MediaState,
  ServerMessage,
  SessionDescription,
} from "@/lib/ws-messages";

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------
export interface RemotePeer {
  userId: string;
  name: string;
  avatar?: string;
  stream: MediaStream | null;
  media: MediaState;
  connectionState: RTCPeerConnectionState;
}

interface Self {
  id: string;
  name: string;
  avatar?: string;
}

interface UseWebRTCOptions {
  provider: CollabProvider | null;
  self: Self | null;
  enabled?: boolean;
}

export interface UseWebRTCResult {
  inCall: boolean;
  isConnecting: boolean;
  localStream: MediaStream | null;
  peers: RemotePeer[];
  mediaState: MediaState;
  error: string | null;
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

// Per-peer negotiation bookkeeping for the "perfect negotiation" pattern.
interface PeerEntry {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

const DEFAULT_MEDIA: MediaState = { audio: true, video: true, screen: false };

function toDescription(sdp: RTCSessionDescription | null): SessionDescription | null {
  if (!sdp) return null;
  return { type: sdp.type, sdp: sdp.sdp };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useWebRTC({
  provider,
  self,
  enabled = true,
}: UseWebRTCOptions): UseWebRTCResult {
  const [inCall, setInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [mediaState, setMediaState] = useState<MediaState>(DEFAULT_MEDIA);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state for use inside long-lived signaling callbacks.
  const providerRef = useRef<CollabProvider | null>(provider);
  const selfRef = useRef<Self | null>(self);
  const inCallRef = useRef(false);
  const mediaStateRef = useRef<MediaState>(DEFAULT_MEDIA);

  const pcsRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  providerRef.current = provider;
  selfRef.current = self;

  // -------------------------------------------------------------------------
  // Peer state helpers
  // -------------------------------------------------------------------------
  const updatePeer = useCallback(
    (userId: string, patch: Partial<RemotePeer>) => {
      setPeers((prev) => {
        const existing = prev[userId];
        const base: RemotePeer =
          existing ??
          {
            userId,
            name: userId,
            stream: null,
            media: { audio: false, video: false, screen: false },
            connectionState: "new",
          };
        return { ...prev, [userId]: { ...base, ...patch } };
      });
    },
    [],
  );

  const removePeer = useCallback((userId: string) => {
    const entry = pcsRef.current.get(userId);
    if (entry) {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.onnegotiationneeded = null;
      entry.pc.onconnectionstatechange = null;
      try {
        entry.pc.close();
      } catch {
        // Already closed.
      }
      pcsRef.current.delete(userId);
    }
    setPeers((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  // Creates (or returns) the RTCPeerConnection to a given peer and wires the
  // perfect-negotiation event handlers. Local tracks are added immediately,
  // which fires `negotiationneeded` and drives the offer/answer exchange.
  const ensurePeer = useCallback(
    (peerId: string, info?: { name?: string; avatar?: string }): PeerEntry => {
      const existing = pcsRef.current.get(peerId);
      if (existing) {
        if (info) {
          updatePeer(peerId, {
            name: info.name ?? peerId,
            ...(info.avatar ? { avatar: info.avatar } : {}),
          });
        }
        return existing;
      }

      const selfId = selfRef.current?.id ?? "";
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const entry: PeerEntry = {
        pc,
        // Deterministic and opposite on the two ends, so exactly one peer yields
        // during an offer collision.
        polite: selfId < peerId,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
      };
      pcsRef.current.set(peerId, entry);

      updatePeer(peerId, {
        userId: peerId,
        name: info?.name ?? peerId,
        avatar: info?.avatar,
        connectionState: pc.connectionState,
      });

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          providerRef.current?.sendIceCandidate(peerId, candidate.toJSON() as IceCandidate);
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        updatePeer(peerId, { stream: remoteStream ?? new MediaStream([event.track]) });
      };

      pc.onnegotiationneeded = async () => {
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          const description = toDescription(pc.localDescription);
          if (description) {
            providerRef.current?.sendOffer(peerId, description);
          }
        } catch (err) {
          console.warn("[webrtc] negotiation failed", err);
        } finally {
          entry.makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        updatePeer(peerId, { connectionState: pc.connectionState });
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            // Older browsers may not support ICE restart.
          }
        }
      };

      return entry;
    },
    [updatePeer],
  );

  // -------------------------------------------------------------------------
  // Incoming signaling
  // -------------------------------------------------------------------------
  const applyDescription = useCallback(
    async (peerId: string, description: SessionDescription) => {
      const entry = pcsRef.current.get(peerId);
      if (!entry) return;
      const { pc } = entry;

      const readyForOffer =
        !entry.makingOffer &&
        (pc.signalingState === "stable" || entry.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;

      entry.ignoreOffer = !entry.polite && offerCollision;
      if (entry.ignoreOffer) return;

      entry.isSettingRemoteAnswerPending = description.type === "answer";
      try {
        await pc.setRemoteDescription(description as RTCSessionDescriptionInit);
      } finally {
        entry.isSettingRemoteAnswerPending = false;
      }

      if (description.type === "offer") {
        await pc.setLocalDescription();
        const answer = toDescription(pc.localDescription);
        if (answer) {
          providerRef.current?.sendAnswer(peerId, answer);
        }
      }
    },
    [],
  );

  const handleSignal = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "USER_JOINED_CALL": {
          if (!inCallRef.current) break;
          const { user, media } = message.payload;
          if (user.id === selfRef.current?.id) break;
          // We were already in the call, so we act as the initiator and offer
          // to the newcomer (adding tracks triggers negotiationneeded).
          ensurePeer(user.id, { name: user.name, avatar: user.avatar });
          updatePeer(user.id, { media });
          break;
        }
        case "RTC_OFFER": {
          if (!inCallRef.current) break;
          const { fromUserId, fromName, fromAvatar, sdp } = message.payload;
          ensurePeer(fromUserId, { name: fromName, avatar: fromAvatar });
          void applyDescription(fromUserId, sdp);
          break;
        }
        case "RTC_ANSWER": {
          void applyDescription(message.payload.fromUserId, message.payload.sdp);
          break;
        }
        case "ICE_CANDIDATE": {
          const entry = pcsRef.current.get(message.payload.fromUserId);
          if (!entry) break;
          entry.pc
            .addIceCandidate(message.payload.candidate as RTCIceCandidateInit)
            .catch((err: unknown) => {
              if (!entry.ignoreOffer) {
                console.warn("[webrtc] addIceCandidate failed", err);
              }
            });
          break;
        }
        case "MEDIA_STATE_CHANGED": {
          const { userId, audio, video, screen } = message.payload;
          updatePeer(userId, { media: { audio, video, screen } });
          break;
        }
        case "USER_LEFT_CALL": {
          removePeer(message.payload.userId);
          break;
        }
        case "USER_LEFT": {
          // Room-level departure: also tear down any active call connection.
          removePeer(message.payload.userId);
          break;
        }
        default:
          break;
      }
    },
    [applyDescription, ensurePeer, removePeer, updatePeer],
  );

  useEffect(() => {
    if (!provider || !enabled) return;
    const off = provider.on("message", handleSignal);
    return off;
  }, [provider, enabled, handleSignal]);

  // -------------------------------------------------------------------------
  // Local media + track publishing helpers
  // -------------------------------------------------------------------------
  const broadcastMediaState = useCallback((next: MediaState) => {
    mediaStateRef.current = next;
    setMediaState(next);
    providerRef.current?.sendMediaState(next);
  }, []);

  // Swaps the outgoing video track on every peer connection. Uses replaceTrack
  // when a video sender already exists (seamless, no renegotiation); otherwise
  // adds the track, which triggers renegotiation via perfect negotiation.
  const publishVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    for (const entry of pcsRef.current.values()) {
      const sender = entry.pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        void sender.replaceTrack(track);
      } else if (track && localStreamRef.current) {
        entry.pc.addTrack(track, localStreamRef.current);
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Public controls
  // -------------------------------------------------------------------------
  const joinCall = useCallback(async () => {
    if (inCallRef.current || isConnecting) return;
    if (!providerRef.current) {
      setError("Not connected to the room yet.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    let stream: MediaStream;
    let gotVideo = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      // Fall back to audio-only if the camera is unavailable or denied.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        gotVideo = false;
      } catch {
        setError("Could not access your microphone or camera.");
        setIsConnecting(false);
        return;
      }
    }

    localStreamRef.current = stream;
    cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
    setLocalStream(stream);

    const initialMedia: MediaState = {
      audio: stream.getAudioTracks().some((t) => t.enabled),
      video: gotVideo && stream.getVideoTracks().some((t) => t.enabled),
      screen: false,
    };
    mediaStateRef.current = initialMedia;
    setMediaState(initialMedia);

    inCallRef.current = true;
    setInCall(true);
    setIsConnecting(false);

    // Announce our presence; existing participants will offer to us.
    providerRef.current.joinCall(initialMedia);
  }, [isConnecting]);

  const leaveCall = useCallback(() => {
    if (!inCallRef.current) return;
    providerRef.current?.leaveCall();

    for (const userId of [...pcsRef.current.keys()]) {
      removePeer(userId);
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current?.stop();
    cameraTrackRef.current = null;
    screenTrackRef.current = null;
    localStreamRef.current = null;

    inCallRef.current = false;
    setInCall(false);
    setLocalStream(null);
    setPeers({});
    setMediaState(DEFAULT_MEDIA);
    mediaStateRef.current = DEFAULT_MEDIA;
  }, [removePeer]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !mediaStateRef.current.audio;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    broadcastMediaState({ ...mediaStateRef.current, audio: next });
  }, [broadcastMediaState]);

  const toggleVideo = useCallback(async () => {
    if (mediaStateRef.current.screen) return; // Camera toggle is disabled while sharing.
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingTrack = cameraTrackRef.current;
    if (existingTrack && existingTrack.readyState === "live") {
      const next = !mediaStateRef.current.video;
      existingTrack.enabled = next;
      broadcastMediaState({ ...mediaStateRef.current, video: next });
      return;
    }

    // No live camera track yet (e.g. joined audio-only) — acquire one now.
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = camStream.getVideoTracks()[0];
      if (!track) return;
      cameraTrackRef.current = track;
      stream.addTrack(track);
      setLocalStream(new MediaStream(stream.getTracks()));
      publishVideoTrack(track);
      broadcastMediaState({ ...mediaStateRef.current, video: true });
    } catch {
      setError("Could not access your camera.");
    }
  }, [broadcastMediaState, publishVideoTrack]);

  const stopScreenShare = useCallback(() => {
    const screenTrack = screenTrackRef.current;
    if (!screenTrack) return;
    screenTrack.stop();
    screenTrackRef.current = null;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((t) => {
        if (t !== cameraTrackRef.current) stream.removeTrack(t);
      });
      const camera = cameraTrackRef.current;
      if (camera && camera.readyState === "live") {
        if (!stream.getVideoTracks().includes(camera)) stream.addTrack(camera);
        publishVideoTrack(camera);
      } else {
        publishVideoTrack(null);
      }
      setLocalStream(new MediaStream(stream.getTracks()));
    }

    const camera = cameraTrackRef.current;
    broadcastMediaState({
      ...mediaStateRef.current,
      screen: false,
      video: Boolean(camera && camera.readyState === "live" && camera.enabled),
    });
  }, [broadcastMediaState, publishVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (!inCallRef.current) return;

    if (mediaStateRef.current.screen) {
      stopScreenShare();
      return;
    }

    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      // User cancelled the share dialog.
      return;
    }

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) return;
    screenTrackRef.current = screenTrack;
    // The browser's native "Stop sharing" control ends the track directly.
    screenTrack.onended = () => stopScreenShare();

    publishVideoTrack(screenTrack);

    const stream = localStreamRef.current;
    if (stream) {
      const camera = cameraTrackRef.current;
      if (camera && stream.getVideoTracks().includes(camera)) {
        stream.removeTrack(camera);
      }
      stream.addTrack(screenTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
    }

    broadcastMediaState({ ...mediaStateRef.current, screen: true });
  }, [publishVideoTrack, stopScreenShare]);

  // Tear everything down on unmount so media devices and peer connections are
  // always released, even if the user navigates away mid-call.
  useEffect(() => {
    return () => {
      providerRef.current?.leaveCall();
      for (const entry of pcsRef.current.values()) {
        try {
          entry.pc.close();
        } catch {
          // ignore
        }
      }
      pcsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenTrackRef.current?.stop();
    };
  }, []);

  return {
    inCall,
    isConnecting,
    localStream,
    peers: Object.values(peers),
    mediaState,
    error,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
