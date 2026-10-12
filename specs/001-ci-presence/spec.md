# Feature Specification: Cloud IPK builds and reliable presence

**Feature Branch**: `main` (existing; no new branches)
**Created**: 2026-10-12
**Status**: Ready
**Input**: Add GitHub package builds, fix online detection, then push/build/update the current OpenWrt plugin. Do not create branches for builds or releases.

## User Scenarios & Testing

### User Story 1 - Obtain trustworthy presence (Priority: P1)
An authenticated LuCI user probes a configured device and sees current evidence rather than a cached neighbor being called online.
**Why this priority**: Existing detection is reported broken and conflates stale cache with liveness.
**Independent Test**: Isolated positive, no-response, stale-cache, wrong-MAC and unknown-target fixtures; bounded safe live probe without wake.
**Acceptance Scenarios**:
1. Given only historical neighbor information, when the page opens, then it does not claim a current online device.
2. Given a known device address and a fresh response matching its identity, when probed, then it shows Online with address and observation time.
3. Given a known address with no response, when probed, then it shows Unreachable, not confirmed off.
4. Given no address, invalid input, mismatched identity or probe error, then it shows Unknown and the reason.
5. Given a probe button, when used repeatedly, then the result refreshes without reloading or sending WOL; concurrent clicks for the same row are prevented.

### User Story 2 - Download cloud-built packages (Priority: P2)
The maintainer runs a manual cloud build or pushes a version tag and obtains an installable package; tagged builds publish a Release.
**Why this priority**: Removes local SDK maintenance while retaining normal releases.
**Independent Test**: Real GitHub run and downloaded package metadata/version/checksum.
**Acceptance Scenarios**:
1. A manual run produces the plugin package as a downloadable artifact.
2. A normal version tag creates its Release and package assets without creating a branch.
3. CI never connects to the router or triggers any power operation.

### User Story 3 - Update current router safely (Priority: P3)
After tests and independent review, update the existing router from the real cloud-built package while retaining settings.
**Why this priority**: User explicitly authorized this one-time deployment.
**Independent Test**: Installed version, preserved configuration fingerprints and read-only endpoint/probe checks.
**Acceptance Scenarios**:
1. Approved source is pushed to existing main, with a version tag pointing to the intended source.
2. Installation preserves configuration and allows rollback from a private backup.
3. Read-only checks succeed without router reboot, network change or computer wake.

### Edge Cases
Missing or reused IPv4 address; ICMP blocked but LAN ARP responding; stale/permanent neighbors; wrong responding MAC; unsupported interface; timeout or missing dependency; SDK accidentally using APK; tag/package version mismatch; public repository secret exposure; unauthorized Actions dispatch API; upgrade conffile changes.

## Requirements
### Functional Requirements
- **FR-001**: Replace cached neighbor online/offline inference with fresh bounded identity-checked probing in LuCI, retaining existing wake controls.
- **FR-002**: Show Online, Unreachable or Unknown with evidence, address and timestamp; initial/unprobed and stale results MUST NOT imply online.
- **FR-003**: Support optional per-device IPv4 and automatic known-address hints, with explicit address taking precedence. Absence of an address yields Unknown; no subnet scan.
- **FR-004**: Probe failures MUST NOT claim physical shutdown; no service or request-success evidence substitutes for host liveness.
- **FR-005**: Validate all privileged probe arguments, limit probe time and preserve narrow authenticated LuCI permissions.
- **FR-006**: Provide manual GitHub builds and version-tag Releases producing opkg-compatible architecture-all IPK packages, with integrity metadata and version validation.
- **FR-007**: Reuse main without new branches, no CI automatic router deployment, and no credentials in public source/logs.
- **FR-008**: Preserve existing wake API, device mappings and config; deploy only after targeted self-tests and independent review.
- **FR-009**: Report actual commit/tag/run/package/install evidence and honestly state unverified physical scenarios or permission blockers.

### Key Entities
- Device: existing name/MAC, optional IPv4, existing WOL interface and configuration.
- Observation: state, evidence/reason, tested IPv4 and time; transient, not a persisted power fact.
- Release: source commit/tag, build run, plugin IPK version/architecture/checksum.

## Success Criteria
### Measurable Outcomes
- **SC-001**: All deterministic presence fixtures distinguish stale history, correct identity, wrong identity, no response and errors correctly; a single probe completes within five seconds on the target under normal conditions.
- **SC-002**: Real cloud build succeeds and its downloaded package is accepted by the installed package manager.
- **SC-003**: Installed new version and preserved configuration are verified; only the existing main branch is pushed, no new build/release branches.
- **SC-004**: No real power action is used during tests/deployment; each claim is backed by evidence and independent review.

## Assumptions
The device is on the selected local IPv4 LAN; ARP reachability is not physical power telemetry. IPv6-only and routed remote hosts may be Unknown. A normal v0.4.1 tag is authorized; future CI deployments are not. Runtime dependency installation needed by the plugin is within this update; unrelated packages are not.
