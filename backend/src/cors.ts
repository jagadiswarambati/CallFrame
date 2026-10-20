export const PRODUCTION_FRONTEND_ORIGIN = "https://call-frame-p3ox.vercel.app";

export function getAllowedOrigins(frontendOrigin: string | undefined): string[] {
  const configuredOrigins = (frontendOrigin ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([PRODUCTION_FRONTEND_ORIGIN, ...configuredOrigins])];
}
