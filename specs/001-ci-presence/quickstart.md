# Validation guide

## Isolated development
Run project's newly provided tests under Node native test/assert (document exact command in README). Run `sh -n` on helper and existing affected shell, JSON checks on ACL, JavaScript syntax check using function wrapper for LuCI top-level return, and workflow/tag/version static tests. Use fixtures for arping positive matching MAC, blocked-ICMP ARP response, stale/no reply, wrong MAC, tool error, malicious args, optional IP precedence, no IP, refresh and no duplicate request. No fixture invokes real etherwake. New regression initially fails before implementation.

## Review before publish
Independent reviewer reexecutes targeted tests and audits diff against this spec/plan, including helper ACL/input/timeouts, no cached-positive claims, no public secrets, wake compatibility and no branch creation.

## Authorized cloud/release/install
After gates pass, commit explicit verified paths; normal `git push origin main` and absent verified v0.4.1 tag push. Record real GitHub run URL and result, download Release IPK and SHA256 publicly, verify checksum and IPK control metadata. Private router config/package backup before normal opkg install; compare config fingerprints and current plugin version after install. Reload plugin-only services as needed; read-only health/405/authenticated LuCI helper checks. Probe target PC only for reachability; don't assert shutdown or wake it. Record actual latency/state/limits and preserve rollback backup. Do not create new branches or use CI automatic deployment.
