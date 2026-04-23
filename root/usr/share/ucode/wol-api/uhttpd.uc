{%
'use strict';

let uci = require('uci');

const MAC_RE = /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/;

function send_json(status, body) {
	uhttpd.send('Status: ', status, '\r\n');
	uhttpd.send('Content-Type: application/json\r\n\r\n');
	printf('%J', body);
}

function read_body() {
	let data = '';
	let chunk;

	while (true) {
		chunk = uhttpd.recv(4096);
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
	let auth = env.HTTP_AUTHORIZATION || env.headers?.authorization || '';
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

global.handle_request = function(env) {
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
		send_json('200 OK', {
			ok: true,
			service: 'wol-api'
		});
		return;
	}

	if (method != 'POST') {
		send_json('405 Method Not Allowed', {
			ok: false,
			error: 'method not allowed'
		});
		return;
	}

	if (!auth_ok(env, main.token || '')) {
		send_json('401 Unauthorized', {
			ok: false,
			error: 'invalid token'
		});
		return;
	}

	raw = read_body();
	if (length(raw) > 0) {
		try {
			payload = json(raw);
		}
		catch (e) {
			send_json('400 Bad Request', {
				ok: false,
				error: 'invalid json'
			});
			return;
		}
	}

	name = payload.name;
	mac = payload.mac;

	if (!name && !mac) {
		send_json('400 Bad Request', {
			ok: false,
			error: "either 'name' or 'mac' is required"
		});
		return;
	}

	if (name && mac) {
		send_json('400 Bad Request', {
			ok: false,
			error: "provide either 'name' or 'mac', not both"
		});
		return;
	}

	if (name) {
		mac = cfg.devices[name];
		if (!mac) {
			send_json('404 Not Found', {
				ok: false,
				error: 'unknown device name: ' + name
			});
			return;
		}
	}
	else if ((main.allow_raw_mac || '1') != '1') {
		send_json('400 Bad Request', {
			ok: false,
			error: 'raw mac wake is disabled'
		});
		return;
	}

	if (!mac || !match(mac, MAC_RE)) {
		send_json('400 Bad Request', {
			ok: false,
			error: 'invalid mac format'
		});
		return;
	}

	mac = normalize_mac(mac);
	iface = main.interface || 'br-lan';
	rv = run_etherwake(iface, mac);

	if (rv != 0) {
		send_json('500 Internal Server Error', {
			ok: false,
			error: 'etherwake failed',
			mac: mac,
			interface: iface
		});
		return;
	}

	send_json('200 OK', {
		ok: true,
		name: name,
		mac: mac,
		interface: iface,
		message: 'wake packet sent',
		known_devices: keys(cfg.devices)
	});
};
%}
