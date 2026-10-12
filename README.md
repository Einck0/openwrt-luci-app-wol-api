# LuCI Support for WOL API

A LuCI app providing Wake-on-LAN API configuration, wake endpoint support, and reliable active device presence probing.

## Features
- **API-based Wake**: Trigger WOL via HTTP POST (`/wol-api`).
- **Native clean endpoint**: Served directly under `/wol-api` using `uhttpd-mod-ucode` without the `cgi-bin` prefix.
- **Etherwake Integration**: Reuse existing `etherwake` target mappings.
- **Auto-fill**: LuCI interface supports selecting known devices to auto-fill MAC/Name fields.
- **Active presence detection**: Row-level ARP probing via `iputils-arping` with identity verification; stale neighbor cache is never assumed online.
- **Optional explicit IPv4**: Per-device IPv4 option with strict precedence (`device.ip` > `hostHints` > neighbor table).
- **One-click wake in LuCI**: Wake a configured device directly from the device list.
- **Token Auth**: Secure API access.

## Status semantics & presence probing
Presence detection replaces passive cache inspection with active bounded ARP probing:
- **Online**: Received a fresh ARP reply matching the expected MAC address within the probe window.
- **Unreachable**: Valid ARP probe completed but received 0 replies within deadline (host may be off or unreachable).
- **Unknown**: No IPv4 address available, identity mismatch (different responding MAC), invalid parameters, or execution error.
- **Initial state**: Always unprobed/unknown upon page load; neighbor cache records are used only as candidate IP hints and never imply online status.
- **Limitations**:
  1. ARP response indicates network interface reachability, not physical OS runtime state (e.g. NIC standby or ARP proxy may respond).
  2. Probing operates on local IPv4 LAN interfaces only. IPv6-only targets without an IPv4 address are marked Unknown.
  3. No public unauthenticated HTTP status endpoint is exposed; probing is gated by authenticated LuCI rpcd file execution ACL.

## Runtime dependencies
Declared in `Makefile` (v0.4.1-r1):
- `luci-base`
- `rpcd`
- `uhttpd`
- `uhttpd-mod-ucode`
- `ucode`
- `etherwake`
- `iputils-arping` (provides bounded ARP reply and MAC identity checks)

## Testing
Isolated automated tests run with Node.js native test runner (no third-party dependencies required):
```bash
node --test tests/*.test.js
```
The test suite covers:
1. Probe helper argument validation, command injection rejection, identity matching, timeout handling, and tool error handling.
2. Regression verification ensuring stale ARP/neighbor cache never yields online status.
3. Candidate IP selection precedence (`device.ip` > `hostHints` > neighbor table).
4. LuCI view in-flight deduplication preventing duplicate concurrent probe requests.
5. RPCD ACL least-privilege scoping and Makefile package definitions.
6. GitHub Actions workflow specifications and immutable pins.

## Cloud build & release procedure
Package builds are automated using GitHub Actions (`.github/workflows/build-ipk.yml`):
- Pinned immutable OpenWrt SDK: `openwrt/gh-action-sdk` commit `7fc2640243284ecc44f4a9c3f749a61746ee02cb`
- Target SDK container: `x86_64-openwrt-24.10` producing architecture `all` IPK packages.
- **Manual build**: Trigger via `workflow_dispatch` on GitHub Actions; produces downloadable artifact.
- **Release build**: Push a version tag matching `Makefile` (e.g. `v0.4.1`). The workflow validates that tag matches `PKG_VERSION`, builds the package, verifies `control` metadata (`Architecture: all`, `Version: 0.4.1-r1`), generates SHA256 checksums, and creates a GitHub Release with assets.
- CI workflows stage the package feed under `runner.temp/feed-staging/luci-app-wol-api` for OpenWrt SDK feed scanner compatibility, pin immutable action commit SHAs, enforce narrow read-only permissions by default, contain zero router credentials, and perform no automatic router deployments.

## Installation
1. Download `luci-app-wol-api_0.4.1-r1_all.ipk` and upload to router `/tmp`.
2. Ensure runtime dependencies are installed:
   ```bash
   opkg update
   opkg install iputils-arping
   ```
3. Install package:
   ```bash
   opkg install /tmp/luci-app-wol-api_0.4.1-r1_all.ipk
   ```
4. Restart services:
   ```bash
   /etc/init.d/wol-api restart
   /etc/init.d/rpcd restart
   ```

## API Usage
### Wake endpoint
- `POST /wol-api`

Requires header:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Example body:
```json
{"name":"nas"}
```

or:
```json
{"mac":"AA:BB:CC:DD:EE:FF"}
```

### Health endpoint
- `GET /wol-api/healthz`

### Example
```bash
curl -X POST 'http://openwrt.lan:8037/wol-api' \
  -H 'Authorization: Bearer <your-token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"nas"}'
```
