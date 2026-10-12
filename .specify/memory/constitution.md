# WOL API Constitution

## Core Principles

### I. Evidence, not power inference
Presence MUST describe current network reachability. Cached neighbors, health responses and successful WOL sends MUST NOT prove physical power state. No response MUST NOT be labelled confirmed shutdown.

### II. Preserve configuration and wake behavior
Updates MUST preserve user configuration, named devices and credentials. Existing wake authentication and request semantics MUST remain compatible. Presence MUST never send WOL or trigger power actions.

### III. Bounded privileged operations
Public source MUST contain no credentials. Probes MUST validate arguments and have a finite timeout. CI MUST build only, never connect to a router. Deployment requires explicit authorization and verified artifacts.

### IV. Verified changes
Changes MUST receive targeted self-tests and independent review before release or production installation. Failed gates MUST remain recorded until explicitly reverified.

## Operational Constraints
Use the existing main branch; planning, CI and releases MUST NOT create new branches. Normal version tags are allowed. Target the installed OpenWrt-compatible opkg/IPK platform; no firmware, network, firewall or unrelated service changes.

## Development Workflow
Freeze feature specification and boundary decisions before implementation. Keep docs with actual behavior and validate critical failure paths using isolated fixtures. Production checks for this feature are read-only except authorized package installation and plugin service loading.

## Governance
Changes to these principles require explicit justification and updated version/date. Review checks source, tests, packaging and authorization against these principles. This first constitution codifies current requirements; no pending placeholders.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
