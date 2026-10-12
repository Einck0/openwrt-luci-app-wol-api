const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfigView } = require('./helpers/luci-mock');

test('MAC 地址规范化处理', () => {
	const view = loadConfigView();
	assert.equal(view.normalizeMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
	assert.equal(view.normalizeMac('  00:11:22:33:44:55  '), '00:11:22:33:44:55');
});

test('旧逻辑回归: STALE 邻居缓存绝不能判定为在线', () => {
	const view = loadConfigView();
	const staleNeighOutput = '192.168.1.50 dev br-lan lladdr aa:bb:cc:dd:ee:ff STALE\n';
	const neighborMap = view.parseNeighbors(staleNeighOutput);

	// 历史缺陷验证: 历史版本中 activeStates 包含 STALE 会将设备标记为 online
	// 新版本中邻居缓存只能提取候选 IP, 不能直接判定在线
	const entry = neighborMap['AA:BB:CC:DD:EE:FF'];
	if (entry) {
		assert.notEqual(entry.online, true, 'STALE 邻居记录绝不能被直接判定为在线');
	}
});

test('候选 IPv4 选择优先级: device.ip 优于 hostHints 优于邻居缓存', () => {
	const view = loadConfigView();
	assert.ok(typeof view.resolveCandidateIp === 'function', '需要实现 resolveCandidateIp 提取候选 IP');

	const mac = 'AA:BB:CC:DD:EE:FF';
	const hostHints = {
		'AA:BB:CC:DD:EE:FF': {
			ipaddrs: ['192.168.1.60']
		}
	};
	const neighborMap = {
		'AA:BB:CC:DD:EE:FF': {
			ipv4: ['192.168.1.70']
		}
	};

	// 1 配置了 device.ip 时, 必须优先使用 device.ip
	const ipWithExplicit = view.resolveCandidateIp({ ip: '192.168.1.50', mac }, hostHints, neighborMap);
	assert.equal(ipWithExplicit, '192.168.1.50');

	// 2 未配置 device.ip 时, 优先使用 hostHints
	const ipFromHints = view.resolveCandidateIp({ mac }, hostHints, neighborMap);
	assert.equal(ipFromHints, '192.168.1.60');

	// 3 无 hostHints 时, 回退到邻居缓存候选
	const ipFromNeigh = view.resolveCandidateIp({ mac }, {}, neighborMap);
	assert.equal(ipFromNeigh, '192.168.1.70');

	// 4 完全无 IP 时返回 null
	const ipNone = view.resolveCandidateIp({ mac }, {}, {});
	assert.equal(ipNone, null);

	// 5 显式配置了非法 IP 时绝不静默回退到 hostHints 或邻居缓存
	const ipInvalidExplicit = view.resolveCandidateIp({ ip: '999.999.999.999', mac }, hostHints, neighborMap);
	assert.equal(ipInvalidExplicit, null, '显式非法 IP 必须返回 null，严禁静默回退');
});

test('初次加载状态必须为未知, 不能默认宣告在线', () => {
	const view = loadConfigView();
	assert.ok(typeof view.getInitialPresence === 'function', '需要实现 getInitialPresence');
	const initial = view.getInitialPresence();
	assert.equal(initial.state, 'unknown');
	assert.notEqual(initial.online, true);
});

test('同一行探测请求必须防重复防并发', async () => {
	const view = loadConfigView();
	assert.ok(typeof view.probeDevice === 'function', '需要实现 probeDevice');

	let execCalls = 0;
	// 模拟 fs.exec
	const fakeFs = {
		exec: function() {
			execCalls++;
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve({
						code: 0,
						stdout: JSON.stringify({
							state: 'online',
							reason: 'fresh ARP reply',
							ip: '192.168.1.50',
							mac: 'AA:BB:CC:DD:EE:FF',
							observed_at: Math.floor(Date.now() / 1000)
						})
					});
				}, 50);
			});
		}
	};

	view._fs = fakeFs;
	const p1 = view.probeDevice('dev1', '192.168.1.50', 'AA:BB:CC:DD:EE:FF', 'br-lan');
	const p2 = view.probeDevice('dev1', '192.168.1.50', 'AA:BB:CC:DD:EE:FF', 'br-lan');

	await Promise.all([p1, p2]);
	assert.equal(execCalls, 1, '同一行在途探测时必须防重, 只能发起一次调用');
});

test('真实表单点击链路: 点击探测时读取表单即时编辑的 IPv4', async () => {
	let executedArgs = null;
	const view = loadConfigView({
		exec: function(cmd, args) {
			executedArgs = { cmd, args };
			return Promise.resolve({
				code: 0,
				stdout: JSON.stringify({
					state: 'online',
					reason: 'ok',
					ip: args[0],
					mac: args[1],
					observed_at: 1700000000
				})
			});
		}
	});

	const dummyData = [{}, {}, {}, { stdout: '' }, { stdout: '' }];
	view.render(dummyData);

	const presenceOpt = view.map.lookupOption('_presence', 'dev1')[0];
	const ipOpt = view.map.lookupOption('ip', 'dev1')[0];
	assert.ok(presenceOpt, '必须包含 _presence 选项');
	assert.ok(ipOpt, '必须包含 ip 选项');

	// 用户在表单中修改了 IP 但未保存到 UCI
	ipOpt.setFormValue('dev1', '192.168.1.99');

	const container = presenceOpt.textvalue('dev1');
	const btn = view.findNode(container, n => n.tag === 'button' && n.attrs?.click);
	assert.ok(btn, '必须渲染探测按钮');

	await btn.attrs.click();

	assert.ok(executedArgs, '探测必须触发执行');
	assert.equal(executedArgs.args[0], '192.168.1.99', '必须使用表单中最新编辑的 IP 而非旧 UCI 配置');
});

test('真实表单点击链路: 用户清空 IP 输入框时必须尊重清空，不静默回退至旧 UCI 配置', async () => {
	let executedArgs = null;
	const view = loadConfigView({
		exec: function(cmd, args) {
			executedArgs = { cmd, args };
			return Promise.resolve({ code: 0, stdout: '{}' });
		}
	});

	const dummyData = [{}, {}, {}, { stdout: '' }, { stdout: '' }];
	view.render(dummyData);

	const presenceOpt = view.map.lookupOption('_presence', 'dev1')[0];
	const ipOpt = view.map.lookupOption('ip', 'dev1')[0];

	// 用户在表单中清空了 IP
	ipOpt.setFormValue('dev1', '');

	const container = presenceOpt.textvalue('dev1');
	const btn = view.findNode(container, n => n.tag === 'button' && n.attrs?.click);

	await btn.attrs.click();

	assert.equal(executedArgs, null, '清空 IP 且无其他候选时不应使用旧 UCI IP 发起探测');
});

test('真实表单点击链路: 用户输入非法显式 IP 时判定为 unknown 且不触发网络探测', async () => {
	let executedArgs = null;
	const view = loadConfigView({
		exec: function(cmd, args) {
			executedArgs = { cmd, args };
			return Promise.resolve({ code: 0, stdout: '{}' });
		}
	});

	const dummyData = [{}, {}, {}, { stdout: '' }, { stdout: '' }];
	view.render(dummyData);

	const presenceOpt = view.map.lookupOption('_presence', 'dev1')[0];
	const ipOpt = view.map.lookupOption('ip', 'dev1')[0];

	// 用户输入非法 IP
	ipOpt.setFormValue('dev1', '999.999.999.999');

	const container = presenceOpt.textvalue('dev1');
	const btn = view.findNode(container, n => n.tag === 'button' && n.attrs?.click);

	const res = await btn.attrs.click();

	assert.equal(executedArgs, null, '输入非法显式 IP 绝不能发起网络探测');
	assert.equal(res.state, 'unknown');
	assert.match(res.reason, /非法|不支持|invalid/i);
});

test('真实表单点击链路: 控件缺失时安全回退至 UCI 配置', async () => {
	let executedArgs = null;
	const view = loadConfigView({
		exec: function(cmd, args) {
			executedArgs = { cmd, args };
			return Promise.resolve({ code: 0, stdout: '{}' });
		}
	});

	const dummyData = [{}, {}, {}, { stdout: '' }, { stdout: '' }];
	view.render(dummyData);

	const presenceOpt = view.map.lookupOption('_presence', 'dev1')[0];

	// 模拟控件缺失
	const originalLookup = view.map.lookupOption.bind(view.map);
	view.map.lookupOption = function(optname, sid) {
		if (optname === 'ip') return [];
		return originalLookup(optname, sid);
	};

	const container = presenceOpt.textvalue('dev1');
	const btn = view.findNode(container, n => n.tag === 'button' && n.attrs?.click);

	await btn.attrs.click();

	assert.ok(executedArgs, '控件缺失时应安全回退至已保存的 UCI IP');
	assert.equal(executedArgs.args[0], '192.168.1.50');
});

test('probeDevice: 非零退出码即使输出包含 online 也绝不能判定为 online', async () => {
	const view = loadConfigView();
	view._fs = {
		exec: function() {
			return Promise.resolve({
				code: 2,
				stdout: JSON.stringify({
					state: 'online',
					reason: 'spoofed',
					ip: '192.168.1.50',
					mac: 'AA:BB:CC:DD:EE:FF',
					observed_at: 1700000000
				}),
				stderr: 'fatal error'
			});
		}
	};

	const res = await view.probeDevice('dev1', '192.168.1.50', 'AA:BB:CC:DD:EE:FF', 'br-lan');
	assert.equal(res.online, false, '非零退出码绝不能判定为 online');
	assert.equal(res.state, 'unknown');
});

test('wakeDevice: 保留原有 etherwake 行为并支持即时表单值', async () => {
	let etherwakeArgs = null;
	const view = loadConfigView();
	view._context.fs.exec = function(cmd, args) {
		etherwakeArgs = { cmd, args };
		return Promise.resolve({ code: 0, stdout: '' });
	};

	const dummyData = [{}, {}, {}, { stdout: '' }, { stdout: '' }];
	view.render(dummyData);

	const macOpt = view.map.lookupOption('mac', 'dev1')[0];
	macOpt.setFormValue('dev1', '11:22:33:44:55:66');

	await view.wakeDevice('dev1');

	assert.ok(etherwakeArgs, '必须调用 etherwake');
	assert.equal(etherwakeArgs.cmd, '/usr/bin/etherwake');
	assert.equal(etherwakeArgs.args[2], '11:22:33:44:55:66', '唤醒应使用当前表单中的 MAC');
});
