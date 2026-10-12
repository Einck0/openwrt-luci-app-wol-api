const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const probeScriptPath = path.join(__dirname, '..', 'root', 'usr', 'libexec', 'wol-api', 'probe.sh');
const mockArpingPath = path.join(__dirname, 'fixtures', 'mock-arping.sh');

function runProbe(args = [], env = {}) {
	const res = spawnSync('sh', [probeScriptPath, ...args], {
		encoding: 'utf8',
		env: {
			...process.env,
			...env
		}
	});
	let json = null;
	try {
		json = JSON.parse(res.stdout);
	}
	catch (e) {
	}
	return {
		exitCode: res.status,
		stdout: res.stdout,
		stderr: res.stderr,
		json: json
	};
}

test('probe.sh 语法必须合规', () => {
	const res = spawnSync('sh', ['-n', probeScriptPath], { encoding: 'utf8' });
	assert.equal(res.status, 0, `语法检查失败: ${res.stderr}`);
});

test('参数不足时输出 unknown 状态', () => {
	const res = runProbe(['192.168.1.100']);
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unknown');
	assert.match(res.json.reason, /参数/);
});

test('校验非法 IPv4 地址', async (t) => {
	const badIps = [
		'127.0.0.1',
		'224.0.0.1',
		'239.255.255.250',
		'0.0.0.0',
		'255.255.255.255',
		'192.168.1.1; whoami',
		'192.168.1.1 && ls',
		'999.999.999.999',
		'abc',
		'1.1.1.1"',
		'1.1.1.1\\',
		'1.1.1.1\\\\',
		'192.168.1.1\t',
		'192.168.1.1\n',
		'*.*.*.*'
	];
	for (const ip of badIps) {
		await t.test(`拒绝非法 IP: ${ip}`, () => {
			const res = runProbe([ip, 'AA:BB:CC:DD:EE:FF', 'br-lan']);
			assert.equal(res.exitCode, 0);
			assert.ok(res.json, `输出必须为合法 JSON, 实际输出: ${res.stdout}`);
			assert.equal(res.json.state, 'unknown');
			assert.equal(res.json.ip, '', '非法或未校验的 IPv4 不能回显到 ip 字段中');
		});
	}
});

test('校验非法 MAC 地址', async (t) => {
	const badMacs = [
		'not-a-mac',
		'AA:BB:CC',
		'AA:BB:CC:DD:EE:FF; rm -rf',
		'AA-BB-CC-DD-EE'
	];
	for (const mac of badMacs) {
		await t.test(`拒绝非法 MAC: ${mac}`, () => {
			const res = runProbe(['192.168.1.100', mac, 'br-lan']);
			assert.equal(res.exitCode, 0);
			assert.ok(res.json);
			assert.equal(res.json.state, 'unknown');
		});
	}
});

test('校验非法网卡名', async (t) => {
	const badIfaces = [
		'br-lan; whoami',
		'br-lan && id',
		'../eth0',
		'eth0/foo',
		'-v',
		'--help',
		'.eth0',
		'a'.repeat(20),
		'a'.repeat(16)
	];
	for (const iface of badIfaces) {
		await t.test(`拒绝非法网卡: ${iface}`, () => {
			const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', iface]);
			assert.equal(res.exitCode, 0);
			assert.ok(res.json);
			assert.equal(res.json.state, 'unknown');
		});
	}
});

test('arping 工具缺失时返回 unknown', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: '/nonexistent/path/to/arping',
		PATH: '/bin:/usr/bin'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unknown');
});

test('目标返回匹配的单播 ARP 响应判为 online', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'success_unicast'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'online');
	assert.equal(res.json.ip, '192.168.1.100');
	assert.equal(res.json.mac, 'AA:BB:CC:DD:EE:FF');
	assert.ok(typeof res.json.observed_at === 'number');
});

test('目标返回匹配的广播 ARP 响应判为 online', () => {
	const res = runProbe(['192.168.1.100', 'aa:bb:cc:dd:ee:ff', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'success_broadcast'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'online');
	assert.equal(res.json.mac, 'AA:BB:CC:DD:EE:FF');
});

test('ARP 响应 MAC 与预期不一致判为 unknown', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'mismatched_mac'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unknown');
	assert.match(res.json.reason, /mismatch|不匹配|身份/i);
});

test('多个混合 ARP 响应判为 unknown', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'mixed_macs'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unknown');
});

test('超时无 ARP 响应判为 unreachable', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'timeout_zero_replies'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unreachable');
});

test('网卡不存在或工具报错判为 unknown', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'device_error'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.equal(res.json.state, 'unknown');
});

test('参数校验失败前严禁发起任何外部网络或 arping 调用', () => {
	const fs = require('node:fs');
	const os = require('node:os');
	const marker = path.join(os.tmpdir(), `probe-network-call-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
	const spyArping = path.join(os.tmpdir(), `spy-arping-${Date.now()}.sh`);

	fs.writeFileSync(spyArping, `#!/bin/sh\ntouch "${marker}"\nexit 0\n`, { mode: 0o755 });

	try {
		const invalidRuns = [
			['1.1.1.1"', 'AA:BB:CC:DD:EE:FF', 'br-lan'],
			['192.168.1.100', 'invalid-mac', 'br-lan'],
			['192.168.1.100', 'AA:BB:CC:DD:EE:FF', '-v'],
			['*.*.*.*', 'AA:BB:CC:DD:EE:FF', 'br-lan']
		];

		for (const args of invalidRuns) {
			const res = runProbe(args, { WOL_API_ARPING: spyArping });
			assert.equal(res.exitCode, 0);
			assert.equal(fs.existsSync(marker), false, `非法入参 ${JSON.stringify(args)} 绝不能执行 arping 调用`);
		}
	}
	finally {
		try { fs.unlinkSync(spyArping); } catch (e) {}
		try { fs.unlinkSync(marker); } catch (e) {}
	}
});

test('arping 输出包含控制字符或双引号反斜杠时必须始终输出合法 JSON', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'hostile_stderr'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json, `输出必须为合法 JSON, 实际输出: ${res.stdout}`);
	assert.equal(res.json.state, 'unknown');
	assert.match(res.json.reason, /quoted/);
});

test('arping 退出码非零但包含匹配响应时绝不能判定为 online', () => {
	const res = runProbe(['192.168.1.100', 'AA:BB:CC:DD:EE:FF', 'br-lan'], {
		WOL_API_ARPING: mockArpingPath,
		MOCK_ARPING_SCENARIO: 'nonzero_with_matching_reply'
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.notEqual(res.json.state, 'online', '非零运行异常退出绝不能判定为 online');
	assert.equal(res.json.state, 'unknown');
});

test('基于真实 iputils-arping 二进制执行探测行为验证', (t) => {
	// 如果环境变量或临时路径提供了官方 deb 提取的 arping, 进行真实二进制调用测试
	const realArping = process.env.WOL_API_REAL_ARPING || (process.env.TMPDIR ? path.join(process.env.TMPDIR, 'wol-api', 'current', 'usr', 'bin', 'arping') : null);
	const fs = require('node:fs');
	if (!realArping || !fs.existsSync(realArping)) {
		t.skip('环境未提供实机提取的 arping 二进制');
		return;
	}

	// 使用真实二进制向不可达 IP 发起探测
	const res = runProbe(['10.254.254.254', 'AA:BB:CC:DD:EE:FF', 'eth0'], {
		WOL_API_ARPING: realArping
	});
	assert.equal(res.exitCode, 0);
	assert.ok(res.json);
	assert.ok(['online', 'unreachable', 'unknown'].includes(res.json.state));
	assert.equal(res.json.ip, '10.254.254.254');
	assert.ok(typeof res.json.observed_at === 'number');
});
