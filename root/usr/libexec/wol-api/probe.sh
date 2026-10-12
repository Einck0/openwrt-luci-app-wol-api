#!/bin/sh
set -ef

START_TS=$(date +%s 2>/dev/null || echo 0)

safe_json_str() {
	printf '%s' "$1" | tr '\r\n\t' '   ' | tr -d '\001-\037\177' | sed 's/\\/\\\\/g; s/"/\\"/g' | sed 's/[[:space:]]*$//'
}

# 输出标准 JSON 格式探测结果
emit_json() {
	_state="$1"
	case "$_state" in
		online|unreachable|unknown)
			;;
		*)
			_state="unknown"
			;;
	esac

	_reason="$(safe_json_str "$2")"

	_ip="$3"
	case "$_ip" in
		[0-9]*.[0-9]*.[0-9]*.[0-9]*)
			;;
		*)
			_ip=""
			;;
	esac

	_mac="$4"
	case "$_mac" in
		[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F])
			;;
		*)
			_mac=""
			;;
	esac

	_ts="${5:-$START_TS}"
	case "$_ts" in
		[0-9]*)
			;;
		*)
			_ts=0
			;;
	esac

	printf '{"state":"%s","reason":"%s","ip":"%s","mac":"%s","observed_at":%s}\n' \
		"$_state" "$_reason" "$_ip" "$_mac" "$_ts"
	exit 0
}

# 校验命令行入参个数
if [ $# -ne 3 ]; then
	emit_json "unknown" "参数不足，必须传入 IPv4、MAC 以及网卡名" "" "" "$START_TS"
fi

RAW_IP="$1"
RAW_MAC="$2"
RAW_IFACE="$3"

# 校验网络接口名称合规性
case "$RAW_IFACE" in
	""|[-.]*|*/*|*[!a-zA-Z0-9_.-]*)
		emit_json "unknown" "非法网卡名" "" "" "$START_TS"
		;;
esac
if [ "${#RAW_IFACE}" -gt 15 ]; then
	emit_json "unknown" "非法网卡名" "" "" "$START_TS"
fi

# 校验并规范化 MAC 地址
NORM_MAC=$(printf '%s' "$RAW_MAC" | tr 'a-f-' 'A-F:')
case "$NORM_MAC" in
	[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F])
		;;
	*)
		emit_json "unknown" "非法 MAC 地址" "" "" "$START_TS"
		;;
esac

# 校验并解析 IPv4 地址
case "$RAW_IP" in
	*[!0-9.]*|"")
		emit_json "unknown" "非法或不支持的 IPv4 地址" "" "" "$START_TS"
		;;
	*.*.*.*)
		;;
	*)
		emit_json "unknown" "非法或不支持的 IPv4 地址" "" "" "$START_TS"
		;;
esac

OIFS="$IFS"
IFS='.'
set -- $RAW_IP
IFS="$OIFS"

if [ $# -ne 4 ]; then
	emit_json "unknown" "非法或不支持的 IPv4 地址" "" "" "$START_TS"
fi

for octet in "$1" "$2" "$3" "$4"; do
	case "$octet" in
		0)
			;;
		[1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])
			;;
		*)
			emit_json "unknown" "非法或不支持的 IPv4 地址" "" "" "$START_TS"
			;;
	esac
done

# 排除环回、组播、全零、广播
if [ "$1" -eq 127 ] || [ "$1" -eq 0 ] || [ "$1" -ge 224 ]; then
	emit_json "unknown" "非法或不支持的 IPv4 地址" "" "" "$START_TS"
fi
VALID_IP="$RAW_IP"

# 定位 arping 工具可执行文件
ARPING_BIN="${WOL_API_ARPING:-/usr/bin/arping}"
if [ ! -x "$ARPING_BIN" ]; then
	ARPING_BIN="$(command -v arping 2>/dev/null || true)"
fi

if [ -z "$ARPING_BIN" ] || [ ! -x "$ARPING_BIN" ]; then
	emit_json "unknown" "未安装或无法执行 arping 工具" "$VALID_IP" "$NORM_MAC" "$START_TS"
fi

# 执行有界 ARP 探测
set +e
ARP_OUT="$(LC_ALL=C "$ARPING_BIN" -c 2 -w 3 -I "$RAW_IFACE" "$VALID_IP" 2>&1)"
ARP_CODE=$?
set -e
FINISH_TS=$(date +%s 2>/dev/null || echo "$START_TS")

# 非零退出码绝不能判定为在线
if [ "$ARP_CODE" -eq 0 ]; then
	# 解析探测输出中的 MAC 地址
	REPLIED_MACS=$(printf '%s\n' "$ARP_OUT" | sed -n 's/.*reply from.*\[\([0-9a-zA-Z:-]*\)\].*/\1/p' | tr 'a-f-' 'A-F:')
	if [ -n "$REPLIED_MACS" ]; then
		UNIQ_MACS=$(printf '%s\n' "$REPLIED_MACS" | sort -u)
		UNIQ_COUNT=$(printf '%s\n' "$UNIQ_MACS" | grep -c . || true)
		if [ "$UNIQ_COUNT" -eq 1 ] && [ "$UNIQ_MACS" = "$NORM_MAC" ]; then
			emit_json "online" "收到来自 $NORM_MAC 的实时 ARP 响应" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
		else
			FORMATTED_MACS=$(printf '%s\n' "$UNIQ_MACS" | tr '\n' ' ' | sed 's/[[:space:]]*$//')
			emit_json "unknown" "身份不匹配: 期望 MAC 为 $NORM_MAC，实际收到 $FORMATTED_MACS" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
		fi
	fi

	if printf '%s\n' "$ARP_OUT" | grep -q "Received 0 response(s)"; then
		emit_json "unreachable" "在截止时间内未收到 ARP 响应" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
	fi

	emit_json "unknown" "无法从 arping 响应中解析出有效 MAC 地址" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
elif [ "$ARP_CODE" -eq 1 ] || printf '%s\n' "$ARP_OUT" | grep -q "Received 0 response(s)"; then
	emit_json "unreachable" "在截止时间内未收到 ARP 响应" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
else
	FIRST_ERR=$(printf '%s\n' "$ARP_OUT" | head -n 1)
	emit_json "unknown" "arping 执行异常: $FIRST_ERR" "$VALID_IP" "$NORM_MAC" "$FINISH_TS"
fi
