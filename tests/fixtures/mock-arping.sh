#!/bin/sh
# 模拟不同场景下的 arping 输出与退出码
case "$MOCK_ARPING_SCENARIO" in
	success_unicast)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Unicast reply from %s [AA:BB:CC:DD:EE:FF]  0.549ms\n" "$4"
		printf "Sent 1 probes (1 broadcast(s))\n"
		printf "Received 1 response(s)\n"
		exit 0
		;;
	success_broadcast)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Broadcast reply from %s [AA:BB:CC:DD:EE:FF]  0.549ms\n" "$4"
		printf "Sent 1 probes (1 broadcast(s))\n"
		printf "Received 1 response(s)\n"
		exit 0
		;;
	timeout_zero_replies)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Sent 2 probes (2 broadcast(s))\n"
		printf "Received 0 response(s)\n"
		exit 1
		;;
	device_error)
		printf "arping: Device %s not available.\n" "$3" >&2
		exit 2
		;;
	mismatched_mac)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Unicast reply from %s [11:22:33:44:55:66]  0.549ms\n" "$4"
		printf "Sent 1 probes (1 broadcast(s))\n"
		printf "Received 1 response(s)\n"
		exit 0
		;;
	mixed_macs)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Unicast reply from %s [AA:BB:CC:DD:EE:FF]  0.549ms\n" "$4"
		printf "Unicast reply from %s [11:22:33:44:55:66]  0.550ms\n" "$4"
		printf "Sent 2 probes (2 broadcast(s))\n"
		printf "Received 2 response(s)\n"
		exit 0
		;;
	nonzero_with_matching_reply)
		printf "ARPING %s from 192.168.1.1 %s\n" "$4" "$3"
		printf "Unicast reply from %s [AA:BB:CC:DD:EE:FF]  0.549ms\n" "$4"
		printf "arping: permission or operational fatal error\n" >&2
		exit 2
		;;
	hostile_stderr)
		printf "arping: fatal error with \"quoted\" text, \\backslash\\, \t tab and \001 control chars\n" >&2
		exit 2
		;;
	*)
		printf "mock-arping: 未知测试场景 %s\n" "$MOCK_ARPING_SCENARIO" >&2
		exit 1
		;;
esac
