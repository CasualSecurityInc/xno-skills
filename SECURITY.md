# Security Policy

## Reporting a Vulnerability

We take the security of this library seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories** (Preferred): Use the "Security" tab in this repository to privately report a vulnerability.

2. **Email**: Send details to security@casualsecurity.com with the subject line "[XNO Security] Vulnerability Report"

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes or mitigations (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### Disclosure Policy

We follow responsible disclosure:

1. Report received and acknowledged
2. Vulnerability investigated and confirmed
3. Fix developed and tested
4. Security advisory prepared
5. Patch released
6. Public disclosure (after patch is available)

## Security Considerations

### Seeds and Private Keys

**This library handles cryptographic seeds and private keys. Critical security practices:**

1. **Never log seeds or private keys** - The library code does not log sensitive data. The CLI outputs seeds/mnemonics only when explicitly requested by the user.

2. **Secure random generation** - Seeds are generated using `crypto.getRandomValues()` (browser) or `crypto.randomBytes()` (Node.js), providing cryptographically secure randomness.

3. **No network transmission** - This library performs all cryptographic operations locally. Seeds and private keys never leave the user's device.

4. **Memory handling** - Sensitive data in memory should be cleared when no longer needed. Users should overwrite seed buffers after use.

### Known Security Considerations

1. **Side-channel attacks**: This library does not implement constant-time operations for all cryptographic functions. If using in a high-security environment, consider additional protections against timing attacks.

2. **Memory dumps**: Seeds and private keys exist in memory during use. In environments where memory dumps are possible, additional protections may be needed.

3. **Browser storage**: Never store seeds or private keys in localStorage, sessionStorage, or cookies without encryption.

4. **CLI output**: The CLI tool outputs seeds and mnemonics to stdout by design. Redirect output to files with appropriate permissions or use `--json` for structured output.

### Dependencies

We monitor our dependencies for known vulnerabilities. If you discover a vulnerability in a dependency, please report it through the same channels.

### Security Updates

Security updates will be released as patch versions. Subscribe to GitHub releases or watch the repository to receive notifications.

## Security Best Practices for Users

1. **Generate seeds offline** when possible
2. **Never share seeds or private keys**
3. **Use hardware wallets** for significant amounts
4. **Verify addresses** before sending funds
5. **Keep software updated** to receive security patches
6. **Use environment variables** for seeds in development, never hardcode

## Contact

For general security questions (non-vulnerability), open a GitHub discussion or issue.

For vulnerability reports, use the channels listed above.