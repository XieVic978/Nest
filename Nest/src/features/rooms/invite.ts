export const INVITE_LIFETIME_MINUTES = 10;

export function buildInviteLink(token: string): string {
  return `nest://join/${token}`;
}

export function formatInviteCode(code: string): string {
  const normalized = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return normalized.length === 10
    ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
    : normalized;
}

export function inviteValueFromInput(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/\/join\/([^/?#]+)/i);

  if (match?.[1]) return decodeURIComponent(match[1]);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
