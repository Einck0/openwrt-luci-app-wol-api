'use strict';
'require form';
'require uci';
'require view';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('wol-api'),
			uci.load('etherwake')
		]);
	},

	render: function() {
		var m, s, o, etherwakeTargets, etherwakeHtml;

		etherwakeTargets = uci.sections('etherwake', 'target') || [];
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

		o = s.option(form.Value, 'interface', _('WOL interface'));
		o.default = 'br-lan';

		o = s.option(form.Value, 'token', _('Bearer token'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_raw_mac', _('Allow raw MAC wake'));
		o.default = '1';

		o = s.option(form.Flag, 'use_etherwake_targets', _('Use existing luci-app-wol / etherwake targets'));
		o.default = '1';
		o.rmempty = false;
		o.description = _('When enabled, API name lookup will also use targets from /etc/config/etherwake.');

		o = s.option(form.DummyValue, '_etherwake_targets', _('Existing etherwake targets'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return etherwakeHtml;
		};

		s = m.section(form.GridSection, 'device', _('Named devices'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.rmempty = false;
		o.datatype = 'macaddr';

		return m.render();
	}
});
