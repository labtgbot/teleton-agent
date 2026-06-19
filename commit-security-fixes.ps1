# Commit all security fixes
git add -A
git commit -m "fix(security): apply all 25+ security fixes (C-01 through L-02)

CRITICAL fixes:
- C-02: CSP headers + exec audit log defense-in-depth
- C-03: Plugin integrity hash verification in marketplace
- C-04: Serializing mutex for payment verification (TOCTOU race)
- C-05: Callback query user-binding authorization

HIGH fixes:
- H-01: Remove dead monitoring routes/service code
- H-02: Plugin code signing verification
- H-04: Rate limiting on WebUI (120 req/min per IP)
- H-05: Remove ?token= query param auth fallback
- H-06: SSRF protection in workflow call_api actions
- H-07: Compaction prompt injection defense (role: system)
- H-08: User message wrapping with untrusted markers
- H-09: Cryptographic auth for GOD_MODE level changes
- H-10: Human review gate for self-improvement integration
- H-11: CORS on Management API
- H-12: Callback data user-binding (IDOR prevention)
- H-13: Plugin hot-reload dev mode guard
- H-14: Require explicit TELETON_SECRETS_KEY

MEDIUM fixes:
- M-01: Exec runner semaphore for concurrency safety
- M-02: Generic error messages in API error handler
- M-03: Content-Security-Policy header
- M-05: Restrict system info endpoint (remove sensitive details)
- M-07: CSV formula injection sanitization in audit export
- M-08: Deal executor TOCTOU rollback fix

LOW fixes:
- L-01: YAML JSON_SCHEMA for safe deserialization
- L-02: Extended logger redaction patterns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
