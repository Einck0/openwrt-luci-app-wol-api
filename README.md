# LuCI Support for WOL API

A LuCI app providing Wake-on-LAN API configuration and wake endpoint support.

## Features
- **API-based Wake**: Trigger WOL via HTTP POST.
- **Native clean endpoint**: Serve directly under `/wol-api` without the `cgi-bin` prefix.
- **Etherwake Integration**: Reuse existing `etherwake` target mappings.
- **Auto-fill**: LuCI interface supports selecting known devices to auto-fill MAC/Name fields.
- **Presence in LuCI**: Named devices can show inferred online/offline state based on the neighbor table.
- **One-click wake in LuCI**: Wake a configured device directly from the device list.
- **Token Auth**: Secure API access.

## Installation
1. Upload `luci-app-wol-api_*.ipk` to router `/tmp`.
2. Install: `opkg install /tmp/luci-app-wol-api_*.ipk --force-reinstall`.
3. Enable/start service if needed: `/etc/init.d/wol-api enable && /etc/init.d/wol-api restart`.

### Runtime dependencies
This version expects:
- `uhttpd`
- `uhttpd-mod-ucode`
- `ucode`
- `etherwake`

These are already declared as package dependencies.

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

### Example (public/WAN access)
```bash
curl -X POST 'http://openwrt.einck.top:3000/wol-api' \
  -H 'Authorization: Bearer <your-token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"einck"}'
```

Health check:
```bash
curl 'http://openwrt.einck.top:3000/wol-api/healthz'
```

## Notes
- The backend is implemented with `uhttpd + native ucode handler`.
- This version depends on `uhttpd-mod-ucode` and serves the API directly under `/wol-api` without the `cgi-bin` prefix.
- The listen port is configurable through UCI / LuCI (`wol-api.main.port`), not hardcoded in the handler.
- If the WAN/public port changes, remember to update firewall allow rules accordingly; the firewall rule is not automatically synchronized with the configured listen port.
- Legacy CGI files may still exist in the package for compatibility during transition, but the service entrypoint is the native `/wol-api` route.
