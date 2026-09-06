export type RoomRole = "admin" | "member";

export type RoomMember = {
  userId: string;
  displayName: string;
  role: RoomRole;
  joinedAt: string;
};

export type NestRoom = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type RoomMembership = {
  role: RoomRole;
  joinedAt: string;
};

export type RoomSnapshot = {
  room: NestRoom;
  membership: RoomMembership;
  members: RoomMember[];
};

export type RoomInvite = {
  token: string;
  code: string;
  expiresAt: string;
};

export type JoinResult =
  | { status: "joined" | "already_member"; roomId: string; roomName: string }
  | { status: "switch_required"; roomId: string; roomName: string }
  | { status: "admin_transfer_required"; roomId: string; roomName: string };
