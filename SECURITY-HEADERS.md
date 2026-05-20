# Production Security Headers

TruckShield is served as a static SPA, so HTTP response headers must be configured at the production host/CDN layer for the Lovable hosting/custom domain in front of `truckshield.360riskpartners.com`. The in-app meta tags are only a defense-in-depth fallback for HTML responses.

## Required Headers Already Present

These were observed on production and should remain configured:

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

## Required Headers To Add At The Edge

Configure these at the host/CDN, such as Cloudflare Response Header Transform Rules:

```http
Content-Security-Policy: frame-ancestors 'none';
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Notes:

- `frame-ancestors` only works in an HTTP `Content-Security-Policy` header. Browsers ignore it when delivered through `<meta http-equiv="Content-Security-Policy">`.
- `X-Frame-Options: DENY` is a legacy clickjacking fallback for older browsers.
- The header form of `Permissions-Policy` applies beyond the HTML document and has broader browser support than a meta tag alone.

## Optional Recommended Full CSP Header

For the strongest production posture, send a full authoritative CSP header that mirrors the in-app meta CSP and adds `frame-ancestors 'none'`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://truckshield.360riskpartners.com; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests; frame-ancestors 'none'
```

Keep the meta CSP in `index.html` as a fallback, but treat the HTTP header as the authoritative production policy.
