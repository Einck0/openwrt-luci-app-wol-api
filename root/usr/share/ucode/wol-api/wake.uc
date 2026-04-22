'use strict';

let fs = require('fs');
let uci = require('uci');

const MAC_RE = /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/;

function json_out(code, body) {
	print('Status: ' + code + '\r\n');
	print('Content-Type: application/json\r\n\r\n');
	printf('%J', body);
}

function read_stdin() {
	let data = '';
	let chunk;

	while (true) {
		chunk = fs.readfile('/dev/stdin', 4096);
		if (chunk == null || length(chunk) == 0)
			break;
		data += chunk;
	}

	return data;
}

function normalize_mac(mac) {
	return uc(replace(mac || '', /-/g, ':'));
}

function auth_ok(env, token) {
	let auth = env.HTTP_AUTHORIZATION || '';
	return token && auth == ('Bearer ' + token);
}

function load_config() {
	let c = uci.cursor();
	let main = {};
	let devices = {};

	c.load('wol-api');
	main = c.get_all('wol-api', 'main') || {};

	c.foreach('wol-api', 'device', function(s) {
		if (s.name && s.mac)
			devices[s.name] = s.mac;
	});

	if ((main.use_etherwake_targets || '1') == '1') {
		c.load('etherwake');
		c.foreach('etherwake', 'target', function(s) {
			if (s.name && s.mac && !devices[s.name])
				devices[s.name] = s.mac;
		});
	}

	return {
		main: main,
		devices: devices
	};
}

function run_etherwake(interface, mac) {
	return system(['/usr/bin/etherwake', '-i', interface, mac]);
}

let env = getenv();
let cfg = load_config();
let main = cfg.main || {};
let path = env.PATH_INFO || env.REQUEST_URI || '';
let method = env.REQUEST_METHOD || '';
let raw;
let payload = {};
let name;
let mac;
let iface;
let rv;

if (match(path, /healthz/)) {
	json_out(200, {
		ok: true,
		service: 'wol-api'
	});
	exit(0);
}

if (method != 'POST') {
	json_out(405, {
		ok: false,
		error: 'method not allowed'
	});
	exit(0);
}

if (!auth_ok(env, main.token || '')) {
	json_out(401, {
		ok: false,
		error: 'invalid token'
	});
	exit(0);
}

raw = read_stdin();
if (length(raw) > 0) {
	try {
		payload = json(raw);
	}
	catch (e) {
		json_out(400, {
			ok: false,
			error: 'invalid json'
		});
		exit(0);
	}
}

name = payload.name;
mac = payload.mac;

if (!name && !mac) {
	json_out(400, {
		ok: false,
		error: "either 'name' or 'mac' is required"
	});
	exit(0);
}

if (name && mac) {
	json_out(400, {
		ok: false,
		error: "provide either 'name' or 'mac', not both"
	});
	exit(0);
}

if (name) {
	mac = cfg.devices[name];
	if (!mac) {
		json_out(404, {
			ok: false,
			error: 'unknown device name: ' + name
		});
		exit(0);
	}
}
else if ((main.allow_raw_mac || '1') != '1') {
	json_out(400, {
		ok: false,
		error: 'raw mac wake is disabled'
	});
	exit(0);
}

if (!mac || !match(mac, MAC_RE)) {
	json_out(400, {
		ok: false,
		error: 'invalid mac format'
	});
	exit(0);
}

mac = normalize_mac(mac);
iface = main.interface || 'br-lan';
rv = run_etherwake(iface, mac);

if (rv != 0) {
	json_out(500, {
		ok: false,
		error: 'etherwake failed',
		mac: mac,
		interface: iface
	});
	exit(0);
}

json_out(200, {
	ok: true,
	name: name,
	mac: mac,
	interface: iface,
	message: 'wake packet sent',
	known_devices: keys(cfg.devices)
});
exit(0);
