'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
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

		Object.keys(hostHints).sort().forEach(function(mac) {
			var hint = hostHints[mac] || {};
			var name = hint.name || (Array.isArray(hint.ipaddrs) && hint.ipaddrs[0]) || (Array.isArray(hint.ipv4) && hint.ipv4[0]) || '?';
			var key = JSON.stringify([name, mac]);
			var label = String(name) + ' (' + String(mac) + ')';

			if (knownMap[key])
				return;

			knownDevices.push({ key: key, name: name, mac: mac, label: label, source: 'hosthint' });
			knownMap[key] = true;
		});

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

		return m.render();
	}
});
