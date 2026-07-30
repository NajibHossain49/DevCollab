// WebRTC ICE configuration. Google's public STUN servers cover most NAT
// traversal; a TURN relay (needed for symmetric NATs / restrictive networks)
// is loaded from environment variables when provided so we don't ship any
// credentials in the bundle by default.
//
// Supported env vars (all NEXT_PUBLIC_ so they reach the browser):
//   NEXT_PUBLIC_TURN_SERVER_URL   e.g. "turn:global.turn.metered.ca:80"
//   NEXT_PUBLIC_TURN_USERNAME
//   NEXT_PUBLIC_TURN_PASSWORD
// NEXT_PUBLIC_TURN_SERVER_URL may contain multiple comma-separated URLs.

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function buildTurnServers(): RTCIceServer[] {
  const rawUrls = process.env.NEXT_PUBLIC_TURN_SERVER_URL?.trim();
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_PASSWORD;

  if (!rawUrls) {
    return [];
  }

  const urls = rawUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    return [];
  }

  return [
    {
      urls,
      ...(username ? { username } : {}),
      ...(credential ? { credential } : {}),
    },
  ];
}

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [...STUN_SERVERS, ...buildTurnServers()],
};
