# PaperFlow Security Architecture

## 1. Core Security Controls

### Client-Side Processing Security
- Tools marked `processingMode: 'browser'` (Merge, Split, Rotate, Images-to-PDF) process files entirely in the browser memory using `pdf-lib`.
- ArrayBuffers are released immediately after processing.
- Object URLs are revoked via `URL.revokeObjectURL()` during reset to eliminate browser memory accumulation.

### Server Upload Security (When Server Processing is Required)
- **File Validation**: Strict magic byte inspection (`%PDF-`), rejecting files relying solely on client MIME types or file extensions.
- **Path Traversal Protection**: Files stored using cryptographic UUIDs; user filenames are never used as filesystem paths.
- **Resource Limits**: Strict 50MB payload limits via Express body parsers and reverse proxies.
- **Sanitized Execution**: Zero shell string concatenation. Commands use `execFile` with fixed argument arrays and strict timeouts.
- **Ephemeral Storage**: Server files reside in `/tmp/uploads` and are deleted immediately post-processing or via automated TTL sweeps.

### Network Security
- Helmet security headers: CSP, X-Frame-Options: SAMEORIGIN, HSTS, X-Content-Type-Options: nosniff.
- Strict CORS policies restricted to the configured frontend origin.
- No sensitive stack traces or internal server paths exposed in API error envelopes.
