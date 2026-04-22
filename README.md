# luci-app-wol-api

一个用于 OpenWrt / ImmortalWrt 的 LuCI 插件项目，提供：

- LuCI 可视化配置界面
- 基于 Bearer Token 的 WOL HTTP API
- 通过设备名或直接 MAC 地址唤醒设备
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
    │   ├── libexec/wol-api/server.py
    │   └── share/rpcd/acl.d/luci-app-wol-api.json
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

## 安装方式

### 方式 1，通过 OpenWrt SDK / Buildroot 编译 ipk

将本项目放到 feeds 或 package 目录后编译。

示例：

```bash
make menuconfig
# LuCI -> Applications -> luci-app-wol-api
make package/luci-app-wol-api/compile V=s
```

编译后安装生成的 `.ipk`。

### 方式 2，手动拷贝测试

先确保目标设备安装：

```bash
opkg update
opkg install luci-base luci-compat rpcd python3-light etherwake curl
```

然后把以下文件复制到路由器对应路径：

- `root/etc/config/wol-api` -> `/etc/config/wol-api`
- `root/etc/init.d/wol-api` -> `/etc/init.d/wol-api`
- `root/usr/libexec/wol-api/server.py` -> `/usr/libexec/wol-api/server.py`
- `root/usr/share/rpcd/acl.d/luci-app-wol-api.json` -> `/usr/share/rpcd/acl.d/luci-app-wol-api.json`
- `htdocs/luci-static/resources/view/wol-api/config.js` -> `/www/luci-static/resources/view/wol-api/config.js`

然后赋权并启用：

```bash
chmod +x /etc/init.d/wol-api /usr/libexec/wol-api/server.py
/etc/init.d/wol-api enable
/etc/init.d/wol-api start
/etc/init.d/uhttpd reload
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
curl -X POST http://192.168.1.1:8037/api/wake \
  -H 'Authorization: Bearer your-token' \
  -H 'Content-Type: application/json' \
  -d '{"name":"nas"}'
```

### 按 mac

```bash
curl -X POST http://192.168.1.1:8037/api/wake \
  -H 'Authorization: Bearer your-token' \
  -H 'Content-Type: application/json' \
  -d '{"mac":"AA:BB:CC:DD:EE:FF"}'
```

### 健康检查

```bash
curl http://192.168.1.1:8037/healthz
```

## 安全建议

- 如果暴露到公网，建议配反代和 HTTPS
- 尽量限制来源 IP
- token 请使用高强度随机值
- 如果你不需要直传 MAC，把 `allow_raw_mac` 设为 `0`

## GitHub 仓库建议

建议仓库名：`openwrt-luci-app-wol-api`
