const fs = require('node:fs');
const path = require('node:path');

if (!String.prototype.format) {
	String.prototype.format = function(...args) {
		let i = 0;
		return this.replace(/%[s%]/g, (match) => {
			if (match === '%%') return '%';
			return args[i++] ?? '';
		});
	};
}

function MockElement(tag, attrs, children) {
	this.tag = tag;
	this.attrs = attrs || {};
	this.children = Array.isArray(children) ? children.slice() : (children !== undefined && children !== null ? [children] : []);
}

MockElement.prototype.appendChild = function(child) {
	this.children.push(child);
};

MockElement.prototype.removeChild = function(child) {
	const idx = this.children.indexOf(child);
	if (idx !== -1)
		this.children.splice(idx, 1);
};

Object.defineProperty(MockElement.prototype, 'firstChild', {
	get() {
		return this.children.length > 0 ? this.children[0] : null;
	}
});

function findNode(root, predicate) {
	if (!root || typeof root !== 'object')
		return null;
	if (predicate(root))
		return root;
	if (Array.isArray(root.children)) {
		for (const child of root.children) {
			const found = findNode(child, predicate);
			if (found)
				return found;
		}
	}
	return null;
}

function loadConfigView(overrides = {}) {
	const configPath = path.join(__dirname, '..', '..', 'htdocs', 'luci-static', 'resources', 'view', 'wol-api', 'config.js');
	const code = fs.readFileSync(configPath, 'utf8');

	let returnedView = null;
	const dummyView = {
		extend: function(obj) {
			returnedView = obj;
			return obj;
		}
	};

	function MockOption(oname, title, desc) {
		this.option = oname;
		this.title = title;
		this.desc = desc;
		this._values = {};
	}
	MockOption.prototype.value = function() {};
	MockOption.prototype.formvalue = function(section_id) {
		return this._values[section_id];
	};
	MockOption.prototype.setFormValue = function(section_id, val) {
		this._values[section_id] = val;
	};
	MockOption.prototype.getUIElement = function(section_id) {
		const self = this;
		return {
			getValue: function() {
				return self.formvalue(section_id);
			},
			setValue: function(val) {
				self.setFormValue(section_id, val);
			}
		};
	};

	function MockSection(sname, title, desc) {
		this.section = sname;
		this.title = title;
		this.desc = desc;
		this.options = [];
	}
	MockSection.prototype.option = function(optClass, oname, title, desc) {
		const o = new MockOption(oname, title, desc);
		o.section = this;
		this.options.push(o);
		return o;
	};

	function MockMap(config, title, desc) {
		this.config = config;
		this.title = title;
		this.desc = desc;
		this.sections = [];
	}
	MockMap.prototype.section = function(sectionClass, sname, title, desc) {
		const s = new MockSection(sname, title, desc);
		s.map = this;
		this.sections.push(s);
		return s;
	};
	MockMap.prototype.lookupOption = function(optname, section_id) {
		const found = [];
		for (const s of this.sections) {
			for (const o of s.options) {
				if (o.option === optname)
					found.push(o);
			}
		}
		return found;
	};
	MockMap.prototype.render = function() {
		return { map: this };
	};

	const uciStore = {
		'wol-api': {
			'main': {
				'.type': 'wol-api',
				'interface': 'br-lan'
			},
			'dev1': {
				'.type': 'device',
				'name': 'NAS',
				'mac': 'AA:BB:CC:DD:EE:FF',
				'ip': '192.168.1.50'
			}
		},
		'etherwake': {}
	};

	const context = {
		'use strict': true,
		view: dummyView,
		form: {
			Map: MockMap,
			NamedSection: MockSection,
			GridSection: MockSection,
			Flag: MockOption,
			Value: MockOption,
			ListValue: MockOption,
			DummyValue: MockOption,
			Button: MockOption
		},
		rpc: {
			declare: function() {
				return function() {
					return Promise.resolve({});
				};
			}
		},
		uci: {
			load: function() { return Promise.resolve(); },
			get: function(config, sid, opt) {
				if (overrides.uci && overrides.uci[config]?.[sid]?.[opt] !== undefined)
					return overrides.uci[config][sid][opt];
				return uciStore[config]?.[sid]?.[opt] ?? null;
			},
			set: function(config, sid, opt, val) {
				if (!uciStore[config]) uciStore[config] = {};
				if (!uciStore[config][sid]) uciStore[config][sid] = {};
				uciStore[config][sid][opt] = val;
			},
			save: function() { return Promise.resolve(); },
			sections: function(config, type) {
				const conf = uciStore[config] || {};
				return Object.keys(conf).filter(k => !type || conf[k]['.type'] === type).map(k => ({ '.name': k, ...conf[k] }));
			},
			add: function() { return 'new_id'; }
		},
		ui: {
			addNotification: function() {},
			createHandlerFn: function(self, fn) {
				return fn.bind(self);
			}
		},
		fs: {
			exec: function(cmd, args) {
				if (overrides.exec)
					return overrides.exec(cmd, args);
				return Promise.resolve({ code: 0, stdout: '' });
			}
		},
		widgets: {
			DeviceSelect: MockOption
		},
		L: {
			bind: function(fn, self) {
				return fn.bind(self);
			},
			resolveDefault: function(p, def) {
				return Promise.resolve(p).catch(() => def);
			}
		},
		_: function(s) {
			return s;
		},
		E: function(tag, attrs, children) {
			return new MockElement(tag, attrs, children);
		}
	};

	const cleanCode = code.replace(/'require [^']+';/g, '');
	const wrapper = new Function(
		'view', 'form', 'rpc', 'uci', 'ui', 'fs', 'widgets', 'L', '_', 'E',
		cleanCode
	);

	wrapper(
		context.view,
		context.form,
		context.rpc,
		context.uci,
		context.ui,
		context.fs,
		context.widgets,
		context.L,
		context._,
		context.E
	);

	returnedView._context = context;
	returnedView.findNode = findNode;

	return returnedView;
}

module.exports = {
	loadConfigView,
	MockElement,
	findNode
};
