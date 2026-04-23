'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
'require fs';
'require view';
'require tools.widgets as widgets';

return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			uci.load('wol-api'),
			uci.load('etherwake'),
			this.callHostHints()
		]);
	},

	normalizeMac: function(mac) {
		return String(mac || '').trim().toUpperCase().replace(/-/g, ':');
	},

	getDevicePresence: function(hostHints, mac) {
		var hint, ipv4, ipv6, primaryIp;

		hint = hostHints[this.normalizeMac(mac)] || null;
		if (!hint)
			return { online: false, text: _('Offline'), ips: [], primaryIp: null };

		ipv4 = Array.isArray(hint.ipaddrs) ? hint.ipaddrs.filter(Boolean) : [];
		ipv6 = Array.isArray(hint.ip6addrs) ? hint.ip6addrs.filter(Boolean) : [];
		primaryIp = ipv4[0] || ipv6[0] || null;

		if (primaryIp)
			return { online: true, text: _('Online'), ips: ipv4.concat(ipv6), primaryIp: primaryIp };

		return { online: false, text: _('Offline'), ips: [], primaryIp: null };
	},

	wakeDevice: function(section_id) {
		var mac = uci.get('wol-api', section_id, 'mac');
		var name = uci.get('wol-api', section_id, 'name') || mac || _('Unknown device');
		var iface = uci.get('wol-api', 'main', 'interface') || 'br-lan';

		if (!mac) {
			ui.addNotification(null, E('p', _('No MAC address configured for this device.')));
			return Promise.resolve();
		}

		ui.addNotification(null, E('p', _('Sending wake packet to %s…').format(name)));

		return fs.exec('/usr/bin/etherwake', [ '-i', iface, mac ]).then(function(res) {
			if (res.code === 0)
				ui.addNotification(null, E('p', _('Wake packet sent to %s.').format(name)));
			else
				ui.addNotification(null, E('p', _('Wake failed for %s: %s').format(name, (res.stderr || res.stdout || _('unknown error')).trim())));
		}).catch(function(err) {
			ui.addNotification(null, E('p', _('Wake failed for %s: %s').format(name, err)));
		});
	},

	render: function(data) {
		var m, s, o, etherwakeTargets, hostHints, knownDevices, knownMap, etherwakeHtml;

		etherwakeTargets = uci.sections('etherwake', 'target') || [];
		hostHints = data[2] || {};
		knownDevices = [];
		knownMap = {};

		etherwakeTargets.forEach(function(t) {
			var label, key;

			if (!t.name || !t.mac)
				return;

			key = JSON.stringify([t.name, t.mac]);
			label = String(t.name) + ' (' + String(t.mac) + ')';
			knownDevices.push({ key: key, name: t.name, mac: t.mac, label: label, source: 'etherwake' });
			knownMap[key] = true;
		});

		Object.keys(hostHints).sort().forEach(L.bind(function(mac) {
			var hint = hostHints[mac] || {};
			var name = hint.name || (Array.isArray(hint.ipaddrs) && hint.ipaddrs[0]) || (Array.isArray(hint.ipv4) && hint.ipv4[0]) || '?';
			var state = this.getDevicePresence(hostHints, mac);
			var key = JSON.stringify([name, mac]);
			var label = String(name) + ' (' + String(mac) + ')' + (state.online ? ' · ' + _('Online') : ' · ' + _('Offline'));

			if (knownMap[key])
				return;

			knownDevices.push({ key: key, name: name, mac: mac, label: label, source: 'hosthint' });
			knownMap[key] = true;
		}, this));

		etherwakeHtml = etherwakeTargets.length
			? '<ul style="margin:0;padding-left:1.2em">' + etherwakeTargets.map(function(t) {
				return '<li><strong>' + String(t.name || '?') + '</strong> - <code>' + String(t.mac || '?') + '</code></li>';
			}).join('') + '</ul>'
			: '<em>No targets found in /etc/config/etherwake</em>';

		m = new form.Map('wol-api', _('WOL API'), _('Configure the Wake-on-LAN API service and device mappings.'));

		s = m.section(form.NamedSection, 'main', 'wol-api', _('Service'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'host', _('Listen host'));
		o.default = '0.0.0.0';

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.default = '8037';

		o = s.option(widgets.DeviceSelect, 'interface', _('WOL interface'));
		o.noaliases = true;
		o.noinactive = true;
		o.rmempty = false;
		o.default = 'br-lan';
		o.description = _('Select the network device used to send Wake-on-LAN packets.');

		o = s.option(form.Value, 'token', _('Bearer token'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_raw_mac', _('Allow raw MAC wake'));
		o.default = '1';

		o = s.option(form.Flag, 'use_etherwake_targets', _('Use existing luci-app-wol / etherwake targets'));
		o.default = '1';
		o.rmempty = false;
		o.description = _('When enabled, API name lookup will also use targets from /etc/config/etherwake.');

		o = s.option(form.Button, '_import_etherwake', _('Import etherwake targets into named devices'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Import / Sync now');
		o.onclick = function() {
			var existing = {};

			(uci.sections('wol-api', 'device') || []).forEach(function(dev) {
				if (dev.name)
					existing[dev.name] = dev['.name'];
			});

			(uci.sections('etherwake', 'target') || []).forEach(function(target) {
				var sid;
				if (!target.name || !target.mac)
					return;

				sid = existing[target.name];
				if (!sid) {
					sid = uci.add('wol-api', 'device');
					existing[target.name] = sid;
				}

				uci.set('wol-api', sid, 'name', target.name);
				uci.set('wol-api', sid, 'mac', target.mac);
			});

			uci.set('wol-api', 'main', 'use_etherwake_targets', '1');

			return uci.save().then(function() {
				ui.addNotification(null, E('p', _('Imported etherwake targets into named devices. Reloading page…')));
				return location.reload();
			});
		};

		o = s.option(form.DummyValue, '_etherwake_targets', _('Existing etherwake targets'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return etherwakeHtml;
		};

		s = m.section(form.GridSection, 'device', _('Named devices'));
		s.anonymous = true;
		s.addremove = true;
		s.description = _('Devices can be chosen from the dropdown list. Selecting a known device will automatically fill its name and MAC.');

		o = s.option(form.ListValue, '_known_device', _('Known device'));
		o.modalonly = true;
		o.rmempty = true;
		o.value('', _('Manual entry'));
		knownDevices.forEach(function(dev) {
			o.value(dev.key, dev.label);
		});
		o.cfgvalue = function(section_id) {
			var name = uci.get('wol-api', section_id, 'name');
			var mac = uci.get('wol-api', section_id, 'mac');
			var key = JSON.stringify([name, mac]);
			return knownMap[key] ? key : '';
		};
		o.onchange = function(ev, section_id, value) {
			var parsed, nameOpt, macOpt, nameWidget, macWidget;

			if (!value)
				return;

			try {
				parsed = JSON.parse(value);
				nameOpt = this.map.lookupOption('name', section_id);
				macOpt = this.map.lookupOption('mac', section_id);
				nameWidget = nameOpt ? nameOpt[0].getUIElement(section_id) : null;
				macWidget = macOpt ? macOpt[0].getUIElement(section_id) : null;

				if (nameWidget)
					nameWidget.setValue(parsed[0]);
				if (macWidget)
					macWidget.setValue(parsed[1]);
			}
			catch (e) {
			}
		};
		o.write = function(section_id, formvalue) {
			var parsed;
			if (!formvalue)
				return;

			try {
				parsed = JSON.parse(formvalue);
				uci.set('wol-api', section_id, 'name', parsed[0]);
				uci.set('wol-api', section_id, 'mac', parsed[1]);
			}
			catch (e) {
			}
		};

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.placeholder = _('e.g. NAS');

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.rmempty = false;
		o.datatype = 'macaddr';
		o.placeholder = _('Choose a known device above or enter a custom MAC');

		o = s.option(form.DummyValue, '_presence', _('Presence'));
		o.modalonly = false;
		o.textvalue = L.bind(function(section_id) {
			var mac = uci.get('wol-api', section_id, 'mac');
			var state = this.getDevicePresence(hostHints, mac);
			var badgeStyle = 'display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.6;';
			var badge = E('span', {
				'style': badgeStyle + (state.online
					? 'color:#166534;background:#dcfce7;border:1px solid #86efac;'
					: 'color:#475569;background:#f1f5f9;border:1px solid #cbd5e1;')
			}, state.text);
			var children = [ badge ];

			children.push(E('div', {
				'style': 'margin-top:4px;font-size:12px;color:' + (state.primaryIp ? '#64748b' : '#94a3b8') + ';word-break:break-all;'
			}, state.primaryIp || _('No active IP seen')));

			return E('div', {
				'style': 'min-width:220px;'
			}, children);
		}, this);
		o.description = _('Status is inferred from current host hints on the router.');

		o = s.option(form.DummyValue, '_wake_now', _('Wake'));
		o.modalonly = false;
		o.textvalue = L.bind(function(section_id) {
			return E('button', {
				'class': 'cbi-button cbi-button-action important',
				'click': ui.createHandlerFn(this, function() {
					return this.wakeDevice(section_id);
				})
			}, [ _('Wake') ]);
		}, this);
		o.description = _('Send a Wake-on-LAN packet immediately for this device.');

		return m.render();
	}
});
