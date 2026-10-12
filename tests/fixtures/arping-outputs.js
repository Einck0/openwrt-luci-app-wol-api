const realIputilsOutputs = {
	successUnicast: {
		stdout: 'ARPING 192.168.1.100 from 192.168.1.1 br-lan\nUnicast reply from 192.168.1.100 [AA:BB:CC:DD:EE:FF]  0.549ms\nSent 1 probes (1 broadcast(s))\nReceived 1 response(s)\n',
		stderr: '',
		code: 0
	},
	successBroadcast: {
		stdout: 'ARPING 192.168.1.100 from 192.168.1.1 br-lan\nBroadcast reply from 192.168.1.100 [AA:BB:CC:DD:EE:FF]  0.549ms\nSent 1 probes (1 broadcast(s))\nReceived 1 response(s)\n',
		stderr: '',
		code: 0
	},
	timeoutZeroReplies: {
		stdout: 'ARPING 192.168.1.100 from 192.168.1.1 br-lan\nSent 2 probes (2 broadcast(s))\nReceived 0 response(s)\n',
		stderr: '',
		code: 1
	},
	deviceNotAvailable: {
		stdout: '',
		stderr: 'arping: Device br-lan not available.\n',
		code: 2
	},
	mismatchedMac: {
		stdout: 'ARPING 192.168.1.100 from 192.168.1.1 br-lan\nUnicast reply from 192.168.1.100 [11:22:33:44:55:66]  0.549ms\nSent 1 probes (1 broadcast(s))\nReceived 1 response(s)\n',
		stderr: '',
		code: 0
	},
	mixedMacs: {
		stdout: 'ARPING 192.168.1.100 from 192.168.1.1 br-lan\nUnicast reply from 192.168.1.100 [AA:BB:CC:DD:EE:FF]  0.549ms\nUnicast reply from 192.168.1.100 [11:22:33:44:55:66]  0.550ms\nSent 2 probes (2 broadcast(s))\nReceived 2 response(s)\n',
		stderr: '',
		code: 0
	}
};

module.exports = {
	realIputilsOutputs
};
