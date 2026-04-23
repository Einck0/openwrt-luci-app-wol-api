# LuCI Support for WOL API

A LuCI app providing Wake-on-LAN API configuration and wake endpoint support.

## Features
- **API-based Wake**: Trigger WOL via HTTP POST.
- **Etherwake Integration**: Reuse existing `etherwake` target mappings.
- **Auto-fill**: LuCI interface supports selecting known devices to auto-fill MAC/Name fields.
- **Token Auth**: Secure API access.

## Installation
1. Upload `luci-app-wol-api_*.ipk` to router `/tmp`.
2. Install: `opkg install /tmp/luci-app-wol-api_*.ipk --force-reinstall`.
3. Enable/start service if needed: `/etc/init.d/wol-api enable && /etc/init.d/wol-api restart`.

## API Usage
### Wake endpoint
- `POST /cgi-bin/wol-api`

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
- `GET /cgi-bin/wol-api/healthz`

## Notes
- The backend is implemented with `uhttpd + CGI + ucode`.
- `PATH_INFO` is forwarded in the CGI wrapper so the ucode handler can distinguish `/healthz` from wake requests.
- On the current ImmortalWrt target, clean aliases such as `/wol-api` or `/healthz` were not successfully exposed via the tested `uhttpd` setup; keep the documented CGI path as the stable interface.
