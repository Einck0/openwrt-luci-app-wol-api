# luci-app-wol-api

一个用于 OpenWrt / ImmortalWrt 的 LuCI 插件项目，提供：

- LuCI 可视化配置界面
- 基于 Bearer Token 的 WOL HTTP API
- 通过设备名或直接 MAC 地址唤醒设备
- 基于 `uhttpd + CGI + ucode` 的更贴近 OpenWrt 生态实现
- procd 自启动服务

## 项目结构

```text
luci-app-wol-api/
├── Makefile
├── htdocs/luci-static/resources/view/wol-api/config.js
└── root/
    ├── etc/
    │   ├── config/wol-api
    │   └── init.d/wol-api
    ├── usr/
    │   ├── bin/wol-api
    │   ├── libexec/wol-api/
    │   │   └── wake_client.sh
    │   └── share/
    │       ├── luci/menu.d/luci-app-wol-api.json
    │       ├── rpcd/acl.d/luci-app-wol-api.json
    │       └── ucode/wol-api/wake.uc
    └── www/cgi-bin/wol-api
```

## 功能说明

### API

接口：`POST /api/wake`

Header:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

Body 二选一：

```json
{"name":"nas"}
```

或：

```json
{"mac":"AA:BB:CC:DD:EE:FF"}
```

### LuCI 配置项

- 服务开关
- 监听地址
- 监听端口
- WOL 接口，默认 `br-lan`
- Bearer Token
- 是否允许直接传入原始 MAC
- 设备名到 MAC 的映射表

### LuCI 菜单位置

安装后可在：

- `服务` -> `WOL API`

中进行可视化维护。

## 安装方式

### 方式 1，通过 OpenWrt SDK / Buildroot 编译 ipk

将本项目放到 feeds 或 package 目录后编译。

示例：

```bash
make menuconfig
# LuCI -> Applications -> luci-app-wol-api
make package/luci-app-wol-api/compile V=s
```

编译前建议先做这几个检查：

```bash
find . -type f | sort
```

编译后安装生成的 `.ipk`。

### 方式 2，手动拷贝测试

先确保目标设备安装：

```bash
opkg update
opkg install luci-base rpcd uhttpd ucode etherwake curl
```

然后把以下文件复制到路由器对应路径：

- `root/etc/config/wol-api` -> `/etc/config/wol-api`
- `root/etc/init.d/wol-api` -> `/etc/init.d/wol-api`
- `root/usr/bin/wol-api` -> `/usr/bin/wol-api`
- `root/usr/share/ucode/wol-api/wake.uc` -> `/usr/share/ucode/wol-api/wake.uc`
- `root/usr/share/rpcd/acl.d/luci-app-wol-api.json` -> `/usr/share/rpcd/acl.d/luci-app-wol-api.json`
- `root/usr/share/luci/menu.d/luci-app-wol-api.json` -> `/usr/share/luci/menu.d/luci-app-wol-api.json`
- `root/usr/libexec/wol-api/wake_client.sh` -> `/usr/libexec/wol-api/wake_client.sh`
- `root/www/cgi-bin/wol-api` -> `/www/cgi-bin/wol-api`
- `htdocs/luci-static/resources/view/wol-api/config.js` -> `/www/luci-static/resources/view/wol-api/config.js`

然后赋权并启用：

```bash
chmod +x /etc/init.d/wol-api /usr/bin/wol-api /usr/libexec/wol-api/wake_client.sh /www/cgi-bin/wol-api
/etc/init.d/wol-api enable
/etc/init.d/wol-api start
/etc/init.d/uhttpd reload
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
```

## 配置方式

### LuCI 中配置

安装后可在 LuCI 中进入对应应用页，设置：

- Bearer token
- 接口名
- 端口
- 设备列表
- 是否允许 raw MAC

### UCI 命令配置

```bash
uci set wol-api.main.enabled='1'
uci set wol-api.main.host='0.0.0.0'
uci set wol-api.main.port='8037'
uci set wol-api.main.interface='br-lan'
uci set wol-api.main.token='your-token'
uci set wol-api.main.allow_raw_mac='1'
uci commit wol-api
/etc/init.d/wol-api restart
```

新增设备映射：

```bash
uci add wol-api device
uci set wol-api.@device[-1].name='nas'
uci set wol-api.@device[-1].mac='AA:BB:CC:DD:EE:FF'
uci commit wol-api
/etc/init.d/wol-api restart
```

## API 调用示例

### 按 name

```bash
curl -X POST http://192.168.1.1:8037/cgi-bin/wol-api \
  -H 'Authorization: Bearer your-token' \
  -H 'Content-Type: application/json' \
  -d '{"name":"nas"}'
```

### 按 mac

```bash
curl -X POST http://192.168.1.1:8037/cgi-bin/wol-api \
  -H 'Authorization: Bearer your-token' \
  -H 'Content-Type: application/json' \
  -d '{"mac":"AA:BB:CC:DD:EE:FF"}'
```

### 健康检查

```bash
curl http://192.168.1.1:8037/cgi-bin/wol-api/healthz
```

## 当前实现审查

### 已具备

- 标准 LuCI 应用目录结构雏形
- UCI 配置文件
- procd 启动脚本
- LuCI JS 配置页
- 菜单入口
- rpcd ACL
- 基于 token 的 API
- 基于 `uhttpd + CGI + ucode` 的实现骨架

### 目前仍然偏简化的点

- 目前是用独立 `uhttpd` 实例监听配置端口，不是直接复用主 Web 管理口
- 还没补 i18n、po 翻译文件
- 还没做 package 安装后的自动 service reload / postinst 细节
- 还没有完整的 OpenWrt SDK 构建验证

### 本轮检查结果

我已经做过的近似校验：

- 项目关键文件齐全性检查通过
- 菜单入口补齐
- 启动脚本补了 reload trigger
- 客户端脚本已纳入插件目录
- 依赖从 `python3-light` 收敛到更 OpenWrt 风格的 `uhttpd + ucode`

### 结论

当前这版已经比之前**更接近 OpenWrt 生态原生实现**，不再依赖 Python 作为 API 主后端。
如果你要把它继续打磨成更“像官方包”的状态，下一步建议是：

1. 改成复用主 uhttpd 或更标准的 rpcd/ubus 接法
2. 增加翻译与菜单细节
3. 做一次真实 OpenWrt SDK 编译验证
4. 补 package 安装后的细节处理

## 安全建议

- 如果暴露到公网，建议配反代和 HTTPS
- 尽量限制来源 IP
- token 请使用高强度随机值
- 如果你不需要直传 MAC，把 `allow_raw_mac` 设为 `0`

## 后续优化建议

如果你继续迭代这个项目，优先级我建议这样排：

1. 用真实 OpenWrt SDK 编译一遍，确认 `.ipk` 安装链路
2. 增加 i18n / po 翻译
3. 增加更细的访问控制、日志和错误提示
4. 如果需要，再补 shutdown 配套能力

## GitHub 仓库建议

建议仓库名：`openwrt-luci-app-wol-api`
