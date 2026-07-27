import type { RoomMember, User } from "@prisma/client";

// Augment Express' Request so auth middleware can attach the authenticated
// user and (when applicable) their room membership.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      membership?: RoomMember;
    }
  }
}

export {};
