# Implementation Plan: Cloud IPK and presence

**Branch**: `main` (no checkout/new branch) | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Summary
Replace cached inference with bounded active IPv4 ARP probing, identity-checked against the configured MAC. Reuse the authenticated LuCI/rpcd file exec path with one validated helper, not a new public HTTP status endpoint. Add manual/tag GitHub SDK builds for OpenWrt 24.10 architecture-all IPK; once gates pass, push main/tag and install the real Release package once.

## Technical Context
**Language/Version**: existing LuCI JavaScript, POSIX ash shell, ucode; GitHub YAML
**Primary Dependencies**: existing luci-base/rpcd/uhttpd/ucode/etherwake; add iputils-arping for fresh direct ARP reply evidence
**Storage**: existing UCI config, optional device.ip only; observations ephemeral
**Testing**: Node native assert/test for LuCI/helper behavior, isolated executable tool fixtures, shell syntax and JSON/YAML static checks; target ucode syntax checks when possible
**Target Platform**: ImmortalWrt 24.10.0/opkg, mediatek/mt7622; PKGARCH all
**Project Type**: LuCI plugin/package
**Performance Goals**: one bounded probe under five seconds, no duplicate in-flight row calls
**Constraints**: no WOL or physical power actions during validation; no global scans; no production writes until review; no branch creation
**Scale/Scope**: existing device rows, single helper, one build workflow

## Constitution Check
Before/after design: PASS. Presence is network reachability only; configs/wake preserved; privileged helper validates input; CI has no router credentials/deployment; independent review precedes authorized release. Initial scaffold created only because this project had no Spec Kit. No git extension/hooks registered or executed; setup-plan resolves feature identifier 001-ci-presence, not a Git branch. Actual branch remains main.

## Project Structure
- `.specify/feature.json` pins this feature; `.specify/memory/constitution.md` contains current principles
- `specs/001-ci-presence/`: spec, plan, research, data-model, contracts, quickstart, tasks
- `htdocs/luci-static/resources/view/wol-api/config.js`: optional IPv4, row probe/result, preserve wake
- `root/usr/libexec/wol-api/probe.sh`: validated bounded ARP helper
- `root/usr/share/rpcd/acl.d/luci-app-wol-api.json`: exact helper grant
- `Makefile`: dependency and 0.4.1-r1 version; ensure helper executable installed
- `.github/workflows/build-ipk.yml`: SDK, artifacts, tag Release
- `tests/`: isolated behavior checks (no real etherwake)
- `README.md`: accurate usage, build and status limits

## Frozen decisions and boundaries
1. Use iputils-arping, not ping+neighbor cache. A ping can fail on ICMP firewalls; an existing REACHABLE entry is not proof of a new reply. Shell invokes arping with bounded count/deadline on chosen interface, parses fresh reply address and MAC; no response => unreachable, mismatch/tool failure/invalid input/no address => unknown. No unconditional cached-positive path. Do not flush or rewrite neighbor state. Add only this direct package dependency.
2. Interface comes from existing WOL interface (default br-lan). Strict safe interface identifier and IPv4/MAC validation in helper, reject loopback/multicast/unspecified/broadcast inputs. Only local IPv4 is supported; explicit unsupported cases unknown. Global environment-specific paths are forbidden; standard OpenWrt runtime paths are permitted. Helper execution is via rpcd file exec, no bearer token needs to be exposed to frontend. Do not add public HTTP endpoint in this scope.
3. Manual optional device IPv4 > hostHints matching MAC > matching local neighbor address; hints/cache only choose address, never prove liveness. Rows start unknown/not-probed, display observation time and evidence after probe. Button may safely refresh repeatedly; do not trigger wake or change service config. Auto probing is optional only if bounded/non-blocking; manual probe required.
4. Online means a matching fresh ARP reply on the selected LAN, not confirmed OS awake; ARP proxies/NIC standby may reply. Explicitly document this limitation. No-response is unreachable, not off. IPv6-only unknown.
5. Workflow uses pinned openwrt/gh-action-sdk v11 commit 7fc2640243284ecc44f4a9c3f749a61746ee02cb and ARCH x86_64-openwrt-24.10. Validate resulting plugin IPK control version 0.4.1-r1/arch all, only upload plugin IPK/checksum, do not publish dependency packages. Pin checkout/upload actions by actual known immutable SHA. Manual workflow artifacts; v* tags validate Makefile version and publish Release using scoped GITHUB_TOKEN. No branches created, no router operations.
6. Local HEAD includes 12 legitimate unpublished plugin commits after remote main; git merge-base confirms remote main ancestor. Push must be normal fast-forward, never force. v0.4.1 must be absent or verified same commit; never replace existing tag.
7. Production after review: private backup outside public repo, config/device/token fingerprints compared without printing values, retrieve cloud artifact/checksum and needed compatible runtime dependency through router opkg feed if available. Install with normal conffile preservation, no force-overwrite. Reload/restart only plugin service (and narrowly required rpcd ACL reload if necessary). No gateway/network/router restart. If feed dependency/build/push blocked, stop and report instead of substituting a fake local package.

## Complexity Tracking
No constitutional exceptions. One extra runtime dependency is justified by direct fresh identity evidence and ICMP-independent LAN detection; avoids implementing raw packet sender or treating cache as proof.
