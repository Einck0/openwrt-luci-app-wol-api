'use strict';
'require form';
'require uci';
'require view';

return view.extend({
	load: function() {
		return uci.load('wol-api');
	},

	render: function() {
		var m, s, o;

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
