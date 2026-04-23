# LuCI Support for WOL API

A LuCI app providing Wake-on-LAN API configuration and wake endpoint support.

## Features
- **API-based Wake**: Trigger WOL via HTTP POST.
- **Etherwake Integration**: Reuse existing `etherwake` target mappings.
- **Auto-fill**: LuCI interface supports selecting known devices to auto-fill MAC/Name fields.
- **Token Auth**: Secure API access.
- **Friendly routes**: supports `/wol-api` and `/healthz` aliases in addition to the legacy CGI path.

## Installation
1. Upload `luci-app-wol-api_*.ipk` to router `/tmp`.
2. Install: `opkg install /tmp/luci-app-wol-api_*.ipk --force-reinstall`.
3. Enable/start service if needed: `/etc/init.d/wol-api enable && /etc/init.d/wol-api restart`.

## API Usage
### Wake endpoint
Preferred:
- `POST /wol-api`

Backward-compatible:
- `POST /cgi-bin/wol-api`
- `POST /wake`

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
Preferred:
- `GET /healthz`

Backward-compatible:
- `GET /cgi-bin/wol-api/healthz`

## Notes
- The backend is implemented with `uhttpd + CGI + ucode`.
- `PATH_INFO` is forwarded in the CGI wrapper so the ucode handler can distinguish `/healthz` from wake requests.
