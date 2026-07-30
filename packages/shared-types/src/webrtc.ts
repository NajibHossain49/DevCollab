// ============================================================================
// WebRTC signaling contract (client <-> server) shared across DevCollab apps.
//
// Signaling is multiplexed over the SAME authenticated WebSocket used for Yjs
// document sync, cursors and chat. The server never touches media — it only
// relays these SDP/ICE payloads to the right peer(s) in a room. Peers form a
// full mesh: every participant holds one RTCPeerConnection per other peer.
// ============================================================================

/** Structural mirror of the browser `RTCSessionDescriptionInit`. */
export interface SessionDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

/** Structural mirror of the browser `RTCIceCandidateInit`. */
export interface IceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/** Microphone / camera / screen-share flags a participant advertises. */
export interface MediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

/** Identity of a call participant, echoed by the server from the connection. */
export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Client -> Server signaling messages
// ---------------------------------------------------------------------------
export type WebRtcClientMessage =
  | { type: "CALL_USER"; payload: { roomId: string } & Partial<MediaState> }
  | { type: "LEAVE_CALL"; payload: { roomId: string } }
  | {
      type: "RTC_OFFER";
      payload: { roomId: string; targetUserId: string; sdp: SessionDescription };
    }
  | {
      type: "RTC_ANSWER";
      payload: { roomId: string; targetUserId: string; sdp: SessionDescription };
    }
  | {
      type: "ICE_CANDIDATE";
      payload: { roomId: string; targetUserId: string; candidate: IceCandidate };
    }
  | { type: "TOGGLE_MEDIA"; payload: { roomId: string } & MediaState };

// ---------------------------------------------------------------------------
// Server -> Client signaling messages
// ---------------------------------------------------------------------------
export type WebRtcServerMessage =
  | { type: "USER_JOINED_CALL"; payload: { user: CallParticipant; media: MediaState } }
  | { type: "USER_LEFT_CALL"; payload: { userId: string } }
  | {
      type: "RTC_OFFER";
      payload: {
        fromUserId: string;
        fromName: string;
        fromAvatar?: string;
        sdp: SessionDescription;
      };
    }
  | { type: "RTC_ANSWER"; payload: { fromUserId: string; sdp: SessionDescription } }
  | { type: "ICE_CANDIDATE"; payload: { fromUserId: string; candidate: IceCandidate } }
  | { type: "MEDIA_STATE_CHANGED"; payload: { userId: string } & MediaState };
