import { logger } from "../../config/logger.js";
import { connectionManager, type Connection } from "../connection.js";
import type { IceCandidate, MediaState, SessionDescription } from "../types.js";

// The ws-server is a "dumb" WebRTC signaling relay: it never touches media or
// SDP, it only forwards these payloads to the correct peer(s) in a room so the
// browsers can negotiate a peer-to-peer connection. Presence changes
// (join/leave/media toggles) are broadcast; offer/answer/ICE are targeted at a
// single user via `sendToRoomUser`.

// CALL_USER: announce that this connection is joining the call. Existing call
// participants react by initiating an offer to the newcomer.
export function handleCallUser(
  connId: string,
  conn: Connection,
  payload: { roomId: string; audio?: boolean; video?: boolean; screen?: boolean },
): void {
  connectionManager.broadcastToRoom(
    payload.roomId,
    {
      type: "USER_JOINED_CALL",
      payload: {
        user: {
          id: conn.userId,
          name: conn.userName,
          avatar: conn.userAvatar,
          color: conn.color,
        },
        media: {
          audio: payload.audio ?? true,
          video: payload.video ?? false,
          screen: payload.screen ?? false,
        },
      },
    },
    connId,
  );
  logger.debug({ connId, roomId: payload.roomId, userId: conn.userId }, "rtc call join");
}

// LEAVE_CALL: tell peers to tear down their connection to this user.
export function handleLeaveCall(
  connId: string,
  conn: Connection,
  payload: { roomId: string },
): void {
  connectionManager.broadcastToRoom(
    payload.roomId,
    { type: "USER_LEFT_CALL", payload: { userId: conn.userId } },
    connId,
  );
  logger.debug({ connId, roomId: payload.roomId, userId: conn.userId }, "rtc call leave");
}

// RTC_OFFER: relay an SDP offer to a single target peer.
export function handleRtcOffer(
  _connId: string,
  conn: Connection,
  payload: { roomId: string; targetUserId: string; sdp: SessionDescription },
): void {
  connectionManager.sendToRoomUser(payload.roomId, payload.targetUserId, {
    type: "RTC_OFFER",
    payload: {
      fromUserId: conn.userId,
      fromName: conn.userName,
      fromAvatar: conn.userAvatar,
      sdp: payload.sdp,
    },
  });
}

// RTC_ANSWER: relay an SDP answer back to the offering peer.
export function handleRtcAnswer(
  _connId: string,
  conn: Connection,
  payload: { roomId: string; targetUserId: string; sdp: SessionDescription },
): void {
  connectionManager.sendToRoomUser(payload.roomId, payload.targetUserId, {
    type: "RTC_ANSWER",
    payload: { fromUserId: conn.userId, sdp: payload.sdp },
  });
}

// ICE_CANDIDATE: relay a trickled ICE candidate to a single target peer.
export function handleIceCandidate(
  _connId: string,
  conn: Connection,
  payload: { roomId: string; targetUserId: string; candidate: IceCandidate },
): void {
  connectionManager.sendToRoomUser(payload.roomId, payload.targetUserId, {
    type: "ICE_CANDIDATE",
    payload: { fromUserId: conn.userId, candidate: payload.candidate },
  });
}

// TOGGLE_MEDIA: broadcast a participant's mic/camera/screen state to the room.
export function handleToggleMedia(
  connId: string,
  conn: Connection,
  payload: { roomId: string } & MediaState,
): void {
  connectionManager.broadcastToRoom(
    payload.roomId,
    {
      type: "MEDIA_STATE_CHANGED",
      payload: {
        userId: conn.userId,
        audio: payload.audio,
        video: payload.video,
        screen: payload.screen,
      },
    },
    connId,
  );
}
