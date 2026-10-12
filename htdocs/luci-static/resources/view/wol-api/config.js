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
			this.callHostHints(),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'neigh', 'show' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'neigh', 'show' ]), { stdout: '' })
		]);
	},

	normalizeMac: function(mac) {
		return String(mac || '').trim().toUpperCase().replace(/-/g, ':');
	},

	parseNeighbors: function() {
		var lines = Array.prototype.slice.call(arguments).join('\n').split(/\n+/);
		var map = {};

		lines.forEach(L.bind(function(line) {
			var parts, ip, mac, normalizedMac, entry;

			line = String(line || '').trim();
			if (!line)
				return;

			parts = line.split(/\s+/);
			ip = parts[0];
			mac = null;

			for (var i = 0; i < parts.length; i++) {
				if (parts[i] === 'lladdr' && parts[i + 1]) {
					mac = parts[i + 1];
					break;
				}
			}

			if (!mac)
				return;

			normalizedMac = this.normalizeMac(mac);
			entry = map[normalizedMac] || { ipv4: [], ipv6: [] };

			if (ip.indexOf(':') >= 0)
				entry.ipv6.push(ip);
			else
				entry.ipv4.push(ip);

			map[normalizedMac] = entry;
		}, this));

		return map;
	},

	// 读取表单控件的即时编辑值，未找到控件时返回 undefined
	getFormControlValue: function(optname, section_id) {
		if (!this.map || typeof this.map.lookupOption !== 'function')
			return undefined;

		var opts = this.map.lookupOption(optname, section_id);
		if (!opts || !opts.length)
			return undefined;

		var opt = opts[0];
		if (typeof opt.formvalue === 'function') {
			var fv = opt.formvalue(section_id);
			if (fv !== undefined)
				return fv;
		}

		if (typeof opt.getUIElement === 'function') {
			var uiEl = opt.getUIElement(section_id);
			if (uiEl && typeof uiEl.getValue === 'function')
				return uiEl.getValue();
		}

		return undefined;
	},

	// 校验单播有效 IPv4 地址
	isValidIpv4: function(ip) {
		if (!ip || typeof ip !== 'string')
			return false;

		var trimmed = ip.trim();
		var parts = trimmed.split('.');
		if (parts.length !== 4)
			return false;

		for (var i = 0; i < 4; i++) {
			var p = parts[i];
			if (!/^[0-9]+$/.test(p))
				return false;
			var num = parseInt(p, 10);
			if (num < 0 || num > 255)
				return false;
			if (p.length > 1 && p[0] === '0')
				return false;
		}

		var first = parseInt(parts[0], 10);
		if (first === 0 || first === 127 || first >= 224)
			return false;

		return true;
	},

	// 根据优先级选择候选 IPv4 地址
	// 1 显式配置的 device.ip
	// 2 hostHints 中的 IPv4 记录
	// 3 邻居表中记录的 IPv4
	resolveCandidateIp: function(deviceConfig, hostHints, neighborMap) {
		var explicitIp, mac, hint, entry;

		if (deviceConfig && deviceConfig.ip !== undefined && deviceConfig.ip !== null && String(deviceConfig.ip).trim() !== '') {
			explicitIp = String(deviceConfig.ip).trim();
			if (this.isValidIpv4(explicitIp))
				return explicitIp;
			// 显式填写的 IPv4 非法时不静默回退
			return null;
		}

		mac = this.normalizeMac(deviceConfig ? deviceConfig.mac : '');
		if (!mac)
			return null;

		hint = (hostHints || {})[mac];
		if (hint) {
			if (Array.isArray(hint.ipaddrs) && hint.ipaddrs.length && hint.ipaddrs[0])
				return hint.ipaddrs[0];
			if (Array.isArray(hint.ipv4) && hint.ipv4.length && hint.ipv4[0])
				return hint.ipv4[0];
		}

		entry = (neighborMap || {})[mac];
		if (entry && Array.isArray(entry.ipv4) && entry.ipv4.length && entry.ipv4[0])
			return entry.ipv4[0];

		return null;
	},

	// 初始展示状态，绝不默认假定在线
	getInitialPresence: function(candidateIp) {
		return {
			state: 'unknown',
			online: false,
			text: _('Unknown'),
			reason: candidateIp ? _('Not probed yet') : _('No IPv4 address known'),
			ip: candidateIp || null,
			observed_at: null
		};
	},

	// 兼容旧接口，返回安全的未探测状态
	getDevicePresence: function(neighborMap, hostHints, mac) {
		var candidateIp = this.resolveCandidateIp({ mac: mac }, hostHints, neighborMap);
		return this.getInitialPresence(candidateIp);
	},

	// 调用后端探针获取实时在线状态，同一行防重复防并发
	probeDevice: function(section_id, candidateIp, mac, iface, updateCallback) {
		var executor;

		this._inFlight = this._inFlight || {};
		if (this._inFlight[section_id])
			return Promise.resolve();

		if (!candidateIp) {
			var noIpRes = {
				state: 'unknown',
				online: false,
				text: _('Unknown'),
				reason: _('No candidate IPv4 address found for MAC'),
				ip: null,
				observed_at: Math.floor(Date.now() / 1000)
			};
			if (typeof updateCallback === 'function')
				updateCallback(noIpRes);
			return Promise.resolve(noIpRes);
		}

		this._inFlight[section_id] = true;
		executor = this._fs ? this._fs.exec.bind(this._fs) : fs.exec;

		return executor('/usr/libexec/wol-api/probe.sh', [ candidateIp, mac, iface || 'br-lan' ]).then(L.bind(function(res) {
			var parsed = null;
			var state = 'unknown';
			var reason = _('Probe response parse error');
			var observed_at = Math.floor(Date.now() / 1000);

			this._inFlight[section_id] = false;

			try {
				parsed = JSON.parse(res.stdout || '{}');
			}
			catch (e) {
			}

			if (parsed && typeof parsed === 'object') {
				// 白名单状态校验
				if (parsed.state === 'online' || parsed.state === 'unreachable' || parsed.state === 'unknown')
					state = parsed.state;
				if (parsed.reason)
					reason = parsed.reason;
				if (typeof parsed.observed_at === 'number' && parsed.observed_at > 0)
					observed_at = parsed.observed_at;
			}

			// 非零退出码绝不能判定为在线
			if (res.code !== 0) {
				state = 'unknown';
				reason = (parsed && parsed.reason) || (res.stderr || res.stdout || _('Execution error')).trim();
			}

			var isOnline = (res.code === 0 && state === 'online');
			var text = _('Unknown');
			if (isOnline)
				text = _('Online');
			else if (state === 'unreachable' && res.code <= 1)
				text = _('Unreachable');

			var result = {
				state: isOnline ? 'online' : (state === 'unreachable' && res.code <= 1 ? 'unreachable' : 'unknown'),
				online: isOnline,
				text: text,
				reason: reason,
				ip: candidateIp,
				mac: mac,
				observed_at: observed_at
			};

			if (typeof updateCallback === 'function')
				updateCallback(result);

			return result;
		}, this)).catch(L.bind(function(err) {
			this._inFlight[section_id] = false;
			var result = {
				state: 'unknown',
				online: false,
				text: _('Unknown'),
				reason: String(err),
				ip: candidateIp,
				mac: mac,
				observed_at: Math.floor(Date.now() / 1000)
			};
			if (typeof updateCallback === 'function')
				updateCallback(result);
			return result;
		}, this));
	},

	wakeDevice: function(section_id) {
		var formMac = this.getFormControlValue('mac', section_id);
		var mac = (formMac !== undefined && formMac !== '') ? formMac : uci.get('wol-api', section_id, 'mac');

		var formName = this.getFormControlValue('name', section_id);
		var name = (formName !== undefined && formName !== '') ? formName : (uci.get('wol-api', section_id, 'name') || mac || _('Unknown device'));

		var formIface = this.getFormControlValue('interface', 'main');
		var iface = (formIface !== undefined && formIface !== '') ? formIface : (uci.get('wol-api', 'main', 'interface') || 'br-lan');

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
		var m, s, o, etherwakeTargets, hostHints, neighborMap, knownDevices, knownMap, etherwakeHtml;

		etherwakeTargets = uci.sections('etherwake', 'target') || [];
		hostHints = data[2] || {};
		neighborMap = this.parseNeighbors((data[3] || {}).stdout || '', (data[4] || {}).stdout || '');
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
			var key = JSON.stringify([name, mac]);
			var label = String(name) + ' (' + String(mac) + ')';

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
		this.map = m;

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

		o = s.option(form.Value, 'ip', _('IPv4 address'));
		o.rmempty = true;
		o.datatype = 'ip4addr';
		o.placeholder = _('Optional, e.g. 192.168.1.100');
		o.description = _('Explicit IPv4 takes precedence over DHCP and neighbor table for presence probing.');

		o = s.option(form.DummyValue, '_presence', _('Presence'));
		o.modalonly = false;
		o.textvalue = L.bind(function(section_id) {
			var self = this;
			var configuredMac = uci.get('wol-api', section_id, 'mac');
			var configuredIp = uci.get('wol-api', section_id, 'ip');
			var initialCandidateIp = this.resolveCandidateIp({ ip: configuredIp, mac: configuredMac }, hostHints, neighborMap);
			var state = this.getInitialPresence(initialCandidateIp);

			var container = E('div', { 'style': 'min-width:240px;' });

			var renderPresence = function(currState, isProbing) {
				var badgeColor = '#475569';
				var badgeBg = '#f1f5f9';
				var badgeBorder = '#cbd5e1';

				if (currState.state === 'online') {
					badgeColor = '#166534';
					badgeBg = '#dcfce7';
					badgeBorder = '#86efac';
				}
				else if (currState.state === 'unreachable') {
					badgeColor = '#9a3412';
					badgeBg = '#ffedd5';
					badgeBorder = '#fdba74';
				}

				var badgeStyle = 'display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.6;color:' + badgeColor + ';background:' + badgeBg + ';border:1px solid ' + badgeBorder + ';';

				var timeStr = currState.observed_at ? new Date(currState.observed_at * 1000).toLocaleTimeString() : '';

				var probeBtn = E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'style': 'margin-left:8px;padding:2px 8px;font-size:12px;',
					'disabled': isProbing ? 'disabled' : null,
					'click': ui.createHandlerFn(self, function() {
						var formMac = self.getFormControlValue('mac', section_id);
						var currentMac = (formMac !== undefined) ? formMac : uci.get('wol-api', section_id, 'mac');
						currentMac = self.normalizeMac(currentMac);

						var formIface = self.getFormControlValue('interface', 'main');
						var currentIface = (formIface !== undefined && formIface !== '') ? formIface : (uci.get('wol-api', 'main', 'interface') || 'br-lan');

						var formIp = self.getFormControlValue('ip', section_id);
						var rawIp = (formIp !== undefined) ? formIp : uci.get('wol-api', section_id, 'ip');

						if (rawIp !== undefined && rawIp !== null && String(rawIp).trim() !== '') {
							rawIp = String(rawIp).trim();
							if (!self.isValidIpv4(rawIp)) {
								var invalidState = {
									state: 'unknown',
									online: false,
									text: _('Unknown'),
									reason: _('Invalid explicit IPv4 address') + (rawIp ? ': ' + rawIp : ''),
									ip: rawIp,
									mac: currentMac,
									observed_at: Math.floor(Date.now() / 1000)
								};
								renderPresence(invalidState, false);
								return Promise.resolve(invalidState);
							}
						}

						var currentCandidateIp = self.resolveCandidateIp({ ip: rawIp, mac: currentMac }, hostHints, neighborMap);

						if (!currentMac) {
							var noMacState = {
								state: 'unknown',
								online: false,
								text: _('Unknown'),
								reason: _('No MAC address configured for this device'),
								ip: currentCandidateIp,
								mac: '',
								observed_at: Math.floor(Date.now() / 1000)
							};
							renderPresence(noMacState, false);
							return Promise.resolve(noMacState);
						}

						if (!currentCandidateIp) {
							var noIpState = {
								state: 'unknown',
								online: false,
								text: _('Unknown'),
								reason: _('No candidate IPv4 address found for MAC'),
								ip: null,
								mac: currentMac,
								observed_at: Math.floor(Date.now() / 1000)
							};
							renderPresence(noIpState, false);
							return Promise.resolve(noIpState);
						}

						renderPresence(currState, true);
						return self.probeDevice(section_id, currentCandidateIp, currentMac, currentIface, function(newState) {
							renderPresence(newState, false);
						});
					})
				}, [ isProbing ? _('Probing…') : _('Probe') ]);

				var header = E('div', { 'style': 'display:flex;align-items:center;' }, [
					E('span', { 'style': badgeStyle }, currState.text),
					probeBtn
				]);

				var detailText = (currState.ip || _('No candidate IP')) + (timeStr ? ' · ' + timeStr : '');
				var detailDiv = E('div', {
					'style': 'margin-top:4px;font-size:12px;color:#64748b;word-break:break-all;'
				}, detailText);

				var reasonDiv = currState.reason ? E('div', {
					'style': 'margin-top:2px;font-size:11px;color:#94a3b8;'
				}, currState.reason) : '';

				while (container.firstChild)
					container.removeChild(container.firstChild);

				container.appendChild(header);
				container.appendChild(detailDiv);
				if (reasonDiv)
					container.appendChild(reasonDiv);
			};

			renderPresence(state, false);
			return container;
		}, this);
		o.description = _('Active fresh ARP probing via arping. Initial state is unprobed.');

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
