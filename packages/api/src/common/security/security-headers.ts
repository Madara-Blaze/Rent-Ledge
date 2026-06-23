interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

/** Baseline security response headers (applied globally in main.ts). */
export function securityHeaders(_req: unknown, res: HeaderResponse, next: () => void): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}
