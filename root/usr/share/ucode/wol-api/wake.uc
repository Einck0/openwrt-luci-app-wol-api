'use strict';

let fs = require('fs');
let uci = require('uci');

const MAC_RE = /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/;

function normalize_mac(mac) {
	return (mac || '').replace(/-/g, ':').toUpperCase();
}

function json_out(code, body) {
	print('Status: ' + code + '\r\n');
	print('Content-Type: application/json\r\n\r\n');
	print(json(body));
}

function read_stdin() {
	let data = '';
	let chunk;
	while (true) {
		chunk = fs.readfile('/dev/stdin', 4096);
		if (chunk == null || length(chunk) == 0) break;
		data += chunk;
	}
	return data;
}

function auth_ok(env, token) {
	let auth = env.HTTP_AUTHORIZATION || '';
	return token && auth == ('Bearer ' + token);
}

function load_config() {
	let c = uci.cursor();
	c.load('wol-api');
	let main = c.get_all('wol-api', 'main') || {};
	let devices = {};
	for (let s in c.sections('wol-api', 'device')) {
		if (s.name && s.mac)
			devices[s.name] = s.mac;
	}
	return { main, devices };
}

function run_etherwake(interface, mac) {
	let cmd = '/usr/sbin/etherwake';
	let rv = system([cmd, '-i', interface, mac]);
	return rv;
}

let env = getenv();
let cfg = load_config();
let main = cfg.main;
let path = env.PATH_INFO || env.REQUEST_URI || '';

if (path =~ /healthz/) {
	json_out(200, { ok: true, service: 'wol-api' });
	exit(0);
}

if ((env.REQUEST_METHOD || '') != 'POST') {
	json_out(405, { ok: false, error: 'method not allowed' });
	exit(0);
}

if (!auth_ok(env, main.token || '')) {
	json_out(401, { ok: false, error: 'invalid token' });
	exit(0);
}

let raw = read_stdin();
let payload = {};
if (length(raw) > 0) {
	try {
		payload = json(raw);
	} catch (e) {
		json_out(400, { ok: false, error: 'invalid json' });
		exit(0);
	}
}

let name = payload.name;
let mac = payload.mac;

if (!name && !mac) {
	json_out(400, { ok: false, error: "either 'name' or 'mac' is required" });
	exit(0);
}

if (name && mac) {
	json_out(400, { ok: false, error: "provide either 'name' or 'mac', not both" });
	exit(0);
}

if (name) {
	mac = cfg.devices[name];
	if (!mac) {
		json_out(404, { ok: false, error: 'unknown device name: ' + name });
		exit(0);
	}
}
else {
	if ((main.allow_raw_mac || '1') != '1') {
		json_out(400, { ok: false, error: 'raw mac wake is disabled' });
		exit(0);
	}
}

if (!mac || !(mac =~ MAC_RE)) {
	json_out(400, { ok: false, error: 'invalid mac format' });
	exit(0);
}

mac = normalize_mac(mac);
let iface = main.interface || 'br-lan';
let rv = run_etherwake(iface, mac);
if (rv != 0) {
	json_out(500, { ok: false, error: 'etherwake failed', mac, interface: iface });
	exit(0);
}

json_out(200, {
	ok: true,
	name,
	mac,
	interface: iface,
	message: 'wake packet sent'
});
exit(0);
