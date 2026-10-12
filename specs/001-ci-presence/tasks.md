# Tasks: Cloud IPK and reliable presence

Input: [spec.md](spec.md), [plan.md](plan.md), research/data-model/contracts/quickstart. Existing main only. One complete implementation work package.

## Phase 1: Setup and foundational verification
- [x] T001 Read related source/runtime; create/analyze this feature without branches
- [x] T002 Add failing isolated regression/behavior tests; red/green history retained

## Phase 2: US1 (P1) trustworthy presence
- [x] T003 Bounded identity-checked `root/usr/libexec/wol-api/probe.sh`, safe JSON/no glob, dependency/executable assurance
- [x] T004 Optional IPv4 and row probe/refresh/time in `config.js`; click-time form values, invalid explicit IP/no silent fallback, successful exec/state validation
- [x] T005 Exact helper ACL, verified with real temporary rpcd session; helper allowed and unauthorized command denied

## Phase 3: US2 (P2) cloud package
- [x] T006 Stable SDK child feed/manual/tag workflow, dynamic VERSION-rRELEASE, exactly-one tar-gzip plugin IPK/checksum, separate minimally privileged Release with GH_REPO
- [x] T007 `Makefile` 0.4.1-r1 and accurate README/tests

## Phase 4: gates and US3 (P3)
- [x] T008 Final isolated tests/static checks; 60 test cases (59 isolated plus optional external arping smoke)
- [x] T009 Independent review PASS rep_rev_whole_task_f70551fb-81e1-477e-b398-b63d03113371, references second rejection which references original; see gates.md
- [x] T010 Source commit 7dc28f013666dcb3162c676f5611e3240683cfae, fast-forward main push and v0.4.1 tag; no new branches
- [x] T011 Actions 38215815929 success, Release plugin IPK/checksum downloaded and control/payload verified
- [x] T012 Cloud IPK installed as 0.4.1-r1 with iputils-arping 20240905-r1, private rollback backup, unchanged config fingerprint, healthy plugin and real three-state probes/ACL checks
- [x] T013 Project experience/evidence and final delivery report prepared; QQ delivery receipt is external to this committed checklist

## Failures and reverification
Original review rep_rev_whole_task_b62e49c7-5df3-4c91-9c31-7293a45c719a rejected JSON/glob/version/form issues; second rep_rev_whole_task_b7f83fda-0dd0-4417-80e5-9605cfceef98 verified fixes but rejected missing GH_REPO. Final reviewer explicitly resolved that chain. No failed build/install concealed; real cloud build passed on approved source.

## Remaining coverage limitations
No actual WOL/power action or physical Windows awake/asleep/off-state test. No graphical/browser critic gate by frozen contract. Manual Actions trigger configured and visible, not separately dispatched (no local API-write credential); actual tag pipeline succeeded. Presence only local IPv4 ARP reachability, not confirmed physical OS power state. Private rollback backup retained outside public repository.
