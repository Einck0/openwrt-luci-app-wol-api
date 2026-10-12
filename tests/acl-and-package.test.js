const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aclPath = path.join(__dirname, '..', 'root', 'usr', 'share', 'rpcd', 'acl.d', 'luci-app-wol-api.json');
const makefilePath = path.join(__dirname, '..', 'Makefile');
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'build-ipk.yml');

test('RPCD ACL 授权文件必须语法正确且包含探针受控执行权限', () => {
	const content = fs.readFileSync(aclPath, 'utf8');
	const acl = JSON.parse(content);
	assert.ok(acl['luci-app-wol-api'], '必须包含 luci-app-wol-api 节点');
	const readFiles = acl['luci-app-wol-api'].read?.file || {};

	// 必须放行探针执行权限
	const probeKey = Object.keys(readFiles).find(k => k.includes('/usr/libexec/wol-api/probe.sh'));
	assert.ok(probeKey, 'ACL 必须显式声明 /usr/libexec/wol-api/probe.sh 路径');
	assert.ok(readFiles[probeKey].includes('exec'), '必须授予 exec 权限');
});

test('Makefile 必须更新版本号为 0.4.1-r1 且声明 iputils-arping 依赖', () => {
	const content = fs.readFileSync(makefilePath, 'utf8');
	assert.match(content, /PKG_VERSION:=0\.4\.1/, '版本号必须为 0.4.1');
	assert.match(content, /PKG_RELEASE:=1/, 'Release 必须为 1');
	assert.match(content, /DEPENDS:=.*(?:\+iputils-arping)/, 'DEPENDS 必须增加 +iputils-arping');
	assert.match(content, /probe\.sh/, 'install 逻辑必须安装 probe.sh 探针');
});

test('GitHub Actions 工作流配置规范验证', () => {
	assert.ok(fs.existsSync(workflowPath), '工作流文件必须存在');
	const content = fs.readFileSync(workflowPath, 'utf8');

	// 1 验证不可变 SHA pin
	assert.match(content, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/, '必须 pin actions/checkout commit');
	assert.match(content, /openwrt\/gh-action-sdk@7fc2640243284ecc44f4a9c3f749a61746ee02cb/, '必须 pin 官方 gh-action-sdk commit');
	assert.match(content, /actions\/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1/, '必须 pin actions/upload-artifact commit');
	assert.match(content, /actions\/download-artifact@cc203385981b70ca67e1cc392babf9cc229d5806/, '必须 pin actions/download-artifact commit');

	// 2 验证架构为 x86_64-openwrt-24.10
	assert.match(content, /ARCH:\s*x86_64-openwrt-24\.10/, '必须指定稳定版 x86_64-openwrt-24.10 SDK');

	// 3 触发条件必须包含 tag 与 manual
	assert.match(content, /workflow_dispatch/, '必须支持手动触发');
	assert.match(content, /tags:\s*\n\s*-\s*['"]?v\*/, '必须支持 v* tag 触发');

	// 4 全局最小权限与独立 Release 权限
	assert.match(content, /permissions:\s*\n\s*contents:\s*read/, '全局必须限制为 contents: read');
	assert.match(content, /release:\s*[\s\S]*permissions:\s*\n\s*contents:\s*write/, 'Release 任务必须按需授予 contents: write');

	// 5 单包 feed 暂存目录结构，规避 scan.mk -mindepth 1 忽略根 Makefile 缺陷
	assert.match(content, /FEED_STAGING=.*feed-staging/, '必须声明 feed-staging 临时暂存路径');
	assert.match(content, /mkdir -p "\${FEED_STAGING}\/luci-app-wol-api"/, '暂存区必须以插件名为子目录');
	assert.match(content, /FEED_DIR:\s*\${{\s*runner\.temp\s*}}\/feed-staging/, 'FEED_DIR 必须指向暂存目录');
	assert.doesNotMatch(content, /INDEX:\s*1/, '非完整官方软件源无需生成全量 INDEX');

	// 6 动态版本匹配，严格遵循 OpenWrt 24.10 的 PKG_VERSION-rPKG_RELEASE 格式
	assert.match(content, /EXPECTED_VER="\${MAKEFILE_VER}-r\${MAKEFILE_REL}"/, '版本号必须动态推导为 PKG_VERSION-rPKG_RELEASE 格式');
	assert.doesNotMatch(content, /"0\.4\.1-1"/, '严禁硬编码未来版本字面量 0.4.1-1');

	// 7 严格校验且仅能匹配到一个本插件候选包
	assert.match(content, /CANDIDATE_COUNT=.*grep -c/, '必须对插件 IPK 候选包数量计数');
	assert.match(content, /\[ "\${CANDIDATE_COUNT}" -ne 1 \]/, '当候选包数量不等于 1 时必须报错中断');

	// 8 严禁包含远程路由器运维或自动部署逻辑
	assert.doesNotMatch(content, /ssh.*einck\.top/i, '工作流中严禁出现路由器部署');

	// 9 独立 Release 任务必须显式声明 GH_REPO 仓库上下文以支持 gh release
	const releaseJobMatch = content.match(/release:\s*[\s\S]*?(?=\n\S|$)/);
	assert.ok(releaseJobMatch, '必须包含 release 任务定义');
	const releaseJob = releaseJobMatch[0];
	assert.doesNotMatch(releaseJob, /actions\/checkout/, '独立 Release 任务无 checkout 步骤');
	assert.match(releaseJob, /GH_REPO:\s*\${{\s*github\.repository\s*}}/, 'Release 任务必须注入 GH_REPO 环境变量');
});

test('Release 独立任务在无 checkout 场景下必须提供 GH_REPO 仓库上下文', () => {
	const content = fs.readFileSync(workflowPath, 'utf8');
	const releaseMatch = content.match(/release:\s*[\s\S]*?(?=\n\S|$)/);
	assert.ok(releaseMatch, '必须包含 release 任务定义');
	const releaseJob = releaseMatch[0];

	// 无 checkout 步骤时必须通过 GH_REPO 环境变量告知 gh 命令目标仓库
	assert.doesNotMatch(releaseJob, /actions\/checkout/, 'Release 任务未执行 checkout');
	assert.match(releaseJob, /GH_REPO:\s*\${{\s*github\.repository\s*}}/, 'Publish GitHub Release 步骤必须配置 GH_REPO 环境变量');
});

test('IPK 真实归档解包与版本动态校验逻辑测试', () => {
	const os = require('node:os');
	const { execSync } = require('node:child_process');

	const testDir = path.join(os.tmpdir(), `test-ipk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	fs.mkdirSync(testDir, { recursive: true });

	function createMockIpk(destDir, pkgName, pkgVer, pkgArch) {
		const pkgDir = path.join(testDir, `build-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const controlDir = path.join(pkgDir, 'ctrl');
		const dataDir = path.join(pkgDir, 'data');
		fs.mkdirSync(controlDir, { recursive: true });
		fs.mkdirSync(dataDir, { recursive: true });

		fs.writeFileSync(path.join(controlDir, 'control'), [
			`Package: ${pkgName}`,
			`Version: ${pkgVer}`,
			`Architecture: ${pkgArch}`,
			'Maintainer: Einck',
			'Description: test package\n'
		].join('\n'));

		fs.writeFileSync(path.join(dataDir, 'dummy.txt'), 'hello');
		fs.writeFileSync(path.join(pkgDir, 'debian-binary'), '2.0\n');

		execSync('tar -czf control.tar.gz ./control', { cwd: controlDir });
		execSync('tar -czf data.tar.gz ./dummy.txt', { cwd: dataDir });

		fs.copyFileSync(path.join(controlDir, 'control.tar.gz'), path.join(pkgDir, 'control.tar.gz'));
		fs.copyFileSync(path.join(dataDir, 'data.tar.gz'), path.join(pkgDir, 'data.tar.gz'));

		const ipkName = `${pkgName}_${pkgVer}_${pkgArch}.ipk`;
		const ipkPath = path.join(destDir, ipkName);

		// 按照 scripts/ipkg-build 格式打包外层 tar.gz
		execSync(`tar -czf "${ipkPath}" ./debian-binary ./data.tar.gz ./control.tar.gz`, { cwd: pkgDir });
		return ipkPath;
	}

	try {
		const binDir = path.join(testDir, 'bin');
		fs.mkdirSync(binDir, { recursive: true });

		// 生成真实的 0.4.1-r1 all IPK
		const ipkPath = createMockIpk(binDir, 'luci-app-wol-api', '0.4.1-r1', 'all');
		assert.ok(fs.existsSync(ipkPath));

		// 执行工作流中的校验逻辑片段
		const runWorkflowVerification = (customBinDir, makefileVer, makefileRel) => {
			const script = `
				set -e
				MAKEFILE_VER="${makefileVer}"
				MAKEFILE_REL="${makefileRel}"
				EXPECTED_VER="\${MAKEFILE_VER}-r\${MAKEFILE_REL}"

				CANDIDATES=$(find "${customBinDir}" -type f -name 'luci-app-wol-api_*_all.ipk')
				CANDIDATE_COUNT=$(echo "\${CANDIDATES}" | grep -c . || true)
				if [ "\${CANDIDATE_COUNT}" -ne 1 ]; then
					echo "Error: Expected exactly 1 candidate, got \${CANDIDATE_COUNT}" >&2
					exit 1
				fi

				PLUGIN_IPK="\${CANDIDATES}"
				TMP_DIR=$(mktemp -d)
				tar -zxf "\${PLUGIN_IPK}" ./control.tar.gz -O | tar -zxf - -C "\${TMP_DIR}" ./control || \
				tar -zxf "\${PLUGIN_IPK}" control.tar.gz -O | tar -zxf - -C "\${TMP_DIR}" control

				PKG_NAME=$(grep '^Package:' "\${TMP_DIR}/control" | awk '{print $2}')
				PKG_VER=$(grep '^Version:' "\${TMP_DIR}/control" | awk '{print $2}')
				PKG_ARCH=$(grep '^Architecture:' "\${TMP_DIR}/control" | awk '{print $2}')
				rm -rf "\${TMP_DIR}"

				[ "\${PKG_NAME}" = "luci-app-wol-api" ] || exit 2
				[ "\${PKG_ARCH}" = "all" ] || exit 3
				[ "\${PKG_VER}" = "\${EXPECTED_VER}" ] || exit 4
			`;
			return execSync(script, { shell: '/bin/sh', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
		};

		// 1 验证当前版本 0.4.1-r1
		assert.doesNotThrow(() => {
			runWorkflowVerification(binDir, '0.4.1', '1');
		}, '当前 0.4.1-r1 必须验证通过');

		// 2 验证未来版本如 0.4.2-r1 自动继承支持，无需改动工作流
		const futureBinDir = path.join(testDir, 'bin_future');
		fs.mkdirSync(futureBinDir, { recursive: true });
		createMockIpk(futureBinDir, 'luci-app-wol-api', '0.4.2-r1', 'all');
		assert.doesNotThrow(() => {
			runWorkflowVerification(futureBinDir, '0.4.2', '1');
		}, '未来版本 0.4.2-r1 必须自动兼容通过');

		// 3 验证版本不匹配时中断退出
		assert.throws(() => {
			runWorkflowVerification(binDir, '0.4.1', '2');
		}, /exit/i, '版本号不匹配时必须报错中断');

		// 4 验证多候选包时中断退出
		createMockIpk(binDir, 'luci-app-wol-api', '0.4.1-r2', 'all');
		assert.throws(() => {
			runWorkflowVerification(binDir, '0.4.1', '1');
		}, /Expected exactly 1 candidate/, '存在多个候选包时必须报错中断');
	}
	finally {
		try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
	}
});
