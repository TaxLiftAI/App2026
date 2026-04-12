# Authentication & Security Architecture — Research Log

## Technical Objective
Design a multi-tenant authentication system that prevents timing oracle attacks
on token comparison, OAuth CSRF exploitation, and session fixation — without
relying on a dedicated secrets management service.

## Technical Uncertainty
At design time, the interaction between httpOnly cookie-based session tokens
and the GitHub OAuth flow introduced a CSRF vulnerability whose mitigation
was non-obvious: standard SameSite=Strict cookies break OAuth redirects from
GitHub back to the application. The correct mitigation required investigation
of state parameter generation and validation strategies.

## Investigations

### Timing oracle on JWT comparison
Problem: naive string comparison of JWTs leaks information via timing side
channels. Standard mitigation is constant-time comparison, but Node's
`crypto.timingSafeEqual()` requires equal-length buffers — incompatible with
variable-length JWT strings. Investigation of padding strategies and alternative
verification approaches. Final implementation: compare HMAC digests of tokens
(fixed length) rather than raw token strings.

### Refresh token rotation and replay prevention
Problem: refresh tokens are long-lived bearer credentials. If intercepted, an
attacker can silently rotate them. Investigation of token family invalidation
on reuse detection (similar to OAuth 2.0 Security BCP §4.13). Implementation:
detect rotation attempt by storing hashed previous token and invalidating
entire session family on mismatch.

### OAuth CSRF state parameter
The state parameter must be unpredictable, bound to the user session, and
validated on callback. Implementation challenge: state must survive a
cross-origin redirect (GitHub → taxlift.ai) without relying on session cookies
(which may not be set before the OAuth flow begins). Investigated PKCE as
an alternative — concluded state cookie with short TTL is appropriate for
the confidential client flow used here.

## Files
- `server/middleware/auth.js` — JWT signing, cookieOptions, token rotation
- `server/routes/oauth.js` — OAuth CSRF state management
- `server/middleware/security.js` — security hardening headers
