#!/usr/bin/env python3
import json
import os
import re
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

CONFIG_SECTION = "wol-api.main"
MAC_RE = re.compile(r"^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$")


def uci_get(key, default=""):
    try:
        out = subprocess.check_output(["uci", "-q", "get", key], text=True).strip()
        return out if out else default
    except subprocess.CalledProcessError:
        return default


def uci_show_devices():
    try:
        out = subprocess.check_output(["uci", "show", "wol-api"], text=True)
    except subprocess.CalledProcessError:
        return {}
    devices = {}
    current = {}
    for line in out.splitlines():
        if "=device" in line:
            if current.get("name") and current.get("mac"):
                devices[current["name"]] = current["mac"]
            current = {}
            continue
        m = re.match(r"wol-api\.@device\[(\d+)\]\.(name|mac)='?(.*?)'?$", line)
        if m:
            current[m.group(2)] = m.group(3)
    if current.get("name") and current.get("mac"):
        devices[current["name"]] = current["mac"]
    return devices


def normalize_mac(mac):
    return mac.replace("-", ":").upper()


def resolve_target(payload):
    name = payload.get("name")
    mac = payload.get("mac")
    if bool(name) == bool(mac):
        raise ValueError("exactly one of 'name' or 'mac' is required")

    allow_raw_mac = uci_get(f"{CONFIG_SECTION}.allow_raw_mac", "1") == "1"
    if name:
        devices = uci_show_devices()
        mac = devices.get(name)
        if not mac:
            raise KeyError(f"unknown device name: {name}")
        if not MAC_RE.match(mac):
            raise ValueError(f"invalid mac configured for device: {name}")
        return name, normalize_mac(mac)

    if not allow_raw_mac:
        raise ValueError("raw mac wake is disabled")
    if not isinstance(mac, str) or not MAC_RE.match(mac):
        raise ValueError("invalid mac format")
    return None, normalize_mac(mac)


def send_wol(mac):
    interface = uci_get(f"{CONFIG_SECTION}.interface", "br-lan")
    etherwake_bin = os.environ.get("ETHERWAKE_BIN", "etherwake")
    cmd = [etherwake_bin, "-i", interface, mac]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip(), cmd, interface


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _auth_ok(self):
        token = uci_get(f"{CONFIG_SECTION}.token", "")
        auth = self.headers.get("Authorization", "")
        return bool(token) and auth == f"Bearer {token}"

    def do_GET(self):
        if self.path == "/healthz":
            return self._json(200, {"ok": True, "service": "wol-api"})
        return self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/api/wake":
            return self._json(404, {"ok": False, "error": "not found"})
        if not self._auth_ok():
            return self._json(401, {"ok": False, "error": "invalid token"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(payload, dict):
                raise ValueError("json body must be an object")
            name, mac = resolve_target(payload)
            code, stdout, stderr, cmd, interface = send_wol(mac)
            if code != 0:
                return self._json(500, {"ok": False, "error": "etherwake failed", "mac": mac, "details": stderr or stdout, "command": cmd})
            return self._json(200, {"ok": True, "name": name, "mac": mac, "interface": interface, "message": "wake packet sent", "details": stdout or stderr})
        except KeyError as e:
            return self._json(404, {"ok": False, "error": str(e)})
        except ValueError as e:
            return self._json(400, {"ok": False, "error": str(e)})
        except json.JSONDecodeError:
            return self._json(400, {"ok": False, "error": "invalid json"})
        except Exception as e:
            return self._json(500, {"ok": False, "error": f"internal error: {e}"})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    host = uci_get(f"{CONFIG_SECTION}.host", "0.0.0.0")
    port = int(uci_get(f"{CONFIG_SECTION}.port", "8037"))
    httpd = HTTPServer((host, port), Handler)
    httpd.serve_forever()
