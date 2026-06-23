interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

/**
 * Baseline security response headers for the JSON API (applied globally in main.ts).
 *
 * SECURITY (§6.1): the API never returns HTML, so the CSP is locked to `default-src 'none'`
 * — there is nothing legitimate to load from an API response. HSTS forces TLS at the
 * browser. The web app (Spline 3D + Mux video + fonts) is a separate static origin and
 * carries its own, looser CSP at the host/CDN — see SECURITY.md.
 */
export function securityHeaders(_req: unknown, res: HeaderResponse, next: () => void): void {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  next();
}
