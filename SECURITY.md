# Security Policy

## Supported versions

`cg-ytmusic` is a single-user local CLI, released as a rolling `0.x` line - only the
latest published version is supported. There is no long-term-support branch.

## What's sensitive here

`cg-ytmusic` signs in using a raw YouTube session `Cookie` header value (see the
README's [Sign-in](README.md#sign-in) section for why - it's a workaround for a
still-open [upstream OAuth bug](https://github.com/LuanRT/YouTube.js/issues/916)).
That cookie is equivalent to being logged into the associated Google account. It is:

- cached **locally only**, in plaintext, at `~/.config/cg-ytmusic/cookie.txt`
- never transmitted anywhere except directly to YouTube's own API via
  [`youtubei.js`](https://github.com/LuanRT/YouTube.js)
- never logged, printed, or included in any telemetry (this project sends none)

If you find a code path that leaks the cookie value anywhere else (logs, error
messages, an outbound request to a non-YouTube host, etc.), treat it as a security
issue under this policy, not a regular bug.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Instead, use GitHub's private reporting flow:
[Report a vulnerability](https://github.com/michaeljymsgutierrez/cg-ytmusic/security/advisories/new).

Include:

- what you found and why it's exploitable
- steps to reproduce
- the potential impact (e.g. cookie exposure, arbitrary command execution)

You should get an initial response within a few days. This is a small side project
maintained by one person, so please be patient - but real reports will be taken
seriously and fixed promptly.
