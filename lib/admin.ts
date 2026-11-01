const ADMIN_EMAILS = new Set([
  "dirksfj@gmail.com",
  "@gmail.com",
]);

export function isAdminEmail(email: string | undefined): boolean {
  return email !== undefined && ADMIN_EMAILS.has(email.toLowerCase());
}

export function isVerifiedAdmin(user: {
  email?: string;
  email_confirmed_at?: string | null;
} | null): boolean {
  return Boolean(user?.email_confirmed_at && isAdminEmail(user.email));
}
