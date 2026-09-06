const ERROR_MESSAGES: Record<string, string> = {
  already_in_nest: "You already belong to a Nest.",
  authentication_required: "Please sign in before continuing.",
  cannot_remove_self: "Transfer admin access before leaving this Nest.",
  display_name_required: "Finish setting your display name before continuing.",
  invalid_invite: "That invite link or code is invalid.",
  invite_expired: "That invitation expired. Ask a Nest admin for a new one.",
  invite_revoked: "That invitation is no longer active. Ask a Nest admin for a new one.",
  member_is_admin: "Transfer admin access before removing this member.",
  membership_not_found: "This person is no longer a member of the Nest.",
  nest_membership_required: "You do not currently belong to a Nest.",
  nest_admin_required: "Only a Nest admin can do that.",
  nest_name_required: "Enter a name for your Nest.",
  nest_not_found: "This Nest no longer exists.",
  room_database_not_ready:
    "The Nest database is not ready yet. Apply the room migration and try again.",
};

export class RoomError extends Error {
  constructor(
    message: string,
    public readonly code = "room_error",
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export function toRoomError(error: unknown): RoomError {
  if (error instanceof RoomError) return error;

  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
  } | null;
  const rawMessage = candidate?.message ?? "Something went wrong. Please try again.";
  const knownCode = Object.keys(ERROR_MESSAGES).find((code) =>
    rawMessage.toLowerCase().includes(code),
  );

  if (knownCode) {
    return new RoomError(ERROR_MESSAGES[knownCode], knownCode);
  }

  if (candidate?.code === "PGRST202" || candidate?.code === "42P01") {
    return new RoomError(
      ERROR_MESSAGES.room_database_not_ready,
      "room_database_not_ready",
    );
  }

  return new RoomError(rawMessage);
}
