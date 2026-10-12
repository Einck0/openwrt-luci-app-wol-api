# Presence contract

Authenticated LuCI uses rpcd file exec of `/usr/libexec/wol-api/probe.sh` with exactly three positional arguments: IPv4, expected MAC, interface. Missing/invalid input is rejected before network operations. Helper emits one JSON observation with fields described in [data model](../data-model.md). Expected semantic outcomes are machine-readable JSON; tool exceptions cannot become Online.

Fresh bounded ARP reply from the requested IP with matching normalized MAC => online. Valid probe with zero replies => unreachable. Reply from another MAC, mixed identity, invalid/unsupported input or operational failure => unknown. No cached neighbors alone yield online. Deadline/count must limit the whole call to five seconds under normal conditions.

Optional configured IPv4 overrides matching host hints/cache. Unknown address means no network call. Existing POST /wol-api auth/body and response semantics unchanged. GET /wol-api/healthz remains service health only. No new public status API.

CI workflow_dispatch builds artifact; push tags v* builds and validates matching Makefile version before Release. Only plugin architecture-all IPK and checksum go to release; package control version must match. No branch writes or router credentials.
