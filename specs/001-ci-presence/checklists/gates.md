# Gate and release evidence

## Source gates (2026-10-12)
- Executor source self-test d1676f88-0ade-4ce6-8fc6-497628f06bf4 PASS final true; static checks/Node exit 0, 59 isolated tests plus optional external arping smoke (60 with binary).
- Independent review rep_rev_whole_task_f70551fb-81e1-477e-b398-b63d03113371 PASS final true; suites/static checks exit 0. Reviewer chain references rep_rev_whole_task_b7f83fda-0dd0-4417-80e5-9605cfceef98 (GH_REPO failure, earlier source fixes verified), which references rep_rev_whole_task_b62e49c7-5df3-4c91-9c31-7293a45c719a (JSON/glob/version/form failure). All failure facts retained.
- Critic not applicable by frozen dispatch contract (backend/no isolated preview); no visual acceptance claimed.

## Real release/install
- Source commit: `7dc28f013666dcb3162c676f5611e3240683cfae`; normal fast-forward main push and annotated v0.4.1 tag. Remote heads after release contain main only.
- Actions: https://github.com/Einck0/openwrt-luci-app-wol-api/actions/runs/38215815929 — event push, head SHA above, completed/success; build and Release succeeded.
- Release: https://github.com/Einck0/openwrt-luci-app-wol-api/releases/tag/v0.4.1
- Artifact: `luci-app-wol-api_0.4.1-r1_all.ipk` (11,532 bytes), SHA256 `4760dee972c2419d92f125e555c820c210e5849eb13704732b795dd26890b97c`; downloaded checksum matches, actual control name/version/architecture verified and installed payloads match source.
- Installed plugin 0.4.1-r1; iputils-arping 20240905-r1. Main independently verified opkg list-installed, /usr/bin/arping version and plugin health after executor report.
- Configuration fingerprint before/after unchanged, existing one device retained. Backup/rollback documentation retained privately, no config or credentials published.
- Runtime health 200; wake GET 405 (wget returns expected HTTP error code 8), no valid wake POST sent.
- Real target PC probe: Unreachable 2.07s; known responding LAN peer: Online 1.12s; wrong identity: Unknown 1.17s. None is physical power proof. Real temporary rpcd ACL session allowed helper and denied unrelated command, session destroyed.
- Deployment executor 5f02f419-8f72-40ae-8cb6-3e90e9205c01 PASS final true, references source executor; necessary write/check commands exit 0. No new source changes during release/install.

## Limits
No WOL or computer/router power actions. Plugin-only wol-api loading and rpcd ACL restart; no network/firewall/global uhttpd/gateway changes. Only tag pipeline executed in cloud; manual workflow is configured, not separately dispatched. IPv6-only/routed/physical power and browser rendering not claimed verified. Source tag remains fixed; later task/evidence documentation commits do not replace or retag released source.
