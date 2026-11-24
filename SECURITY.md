# Security Policy

## Reporting a vulnerability

Please do not publish exploitable security details in a public issue.

Use GitHub's **Private vulnerability reporting** feature for this repository when it is enabled. If private reporting is unavailable, contact the repository maintainer privately before sharing technical details.

Include:
- A short description and potential impact.
- The affected component and version or commit.
- Reproduction steps that use only accounts and systems you own or have explicit permission to test.
- Any suggested mitigation.

Do not access, modify, or delete other users' data; do not disrupt the service; and do not test against systems without authorization.

## Security expectations

- Never commit credentials, session tokens, private keys, or production database URLs.
- Keep dependencies updated and review automated security alerts.
- Validate authorization and input on the server, not only in the browser.
- Treat client-provided game state as untrusted.
- Rotate any credential that may have been exposed.
