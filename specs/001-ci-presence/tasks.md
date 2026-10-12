# Tasks: Cloud IPK and reliable presence

Input: [spec.md](spec.md), [plan.md](plan.md), research/data-model/contracts/quickstart. Existing main only. One complete implementation work package.

## Phase 1: Setup and foundational verification
- [x] T001 Read existing related files and target runtime; create/analyze this feature without branches
- [x] T002 Add failing isolated regression/behavior tests in `tests/`; original red/green evidence retained, review uncovered missing boundary cases

## Phase 2: US1 (P1) trustworthy presence
- [x] T003 [US1] Bounded identity-checked `root/usr/libexec/wol-api/probe.sh`; Makefile dependency/executable assurance; remediation: always safe JSON, no glob split, real exit/output semantics and mixed-identity observation
- [x] T004 [US1] Optional IPv4, safe candidates, row probe/refresh/time in `htdocs/luci-static/resources/view/wol-api/config.js`; remediation: click-time form IPv4/MAC/interface values, invalid explicit IPv4 never falls back, valid result only on successful exec
- [x] T005 [US1] Exact helper exec in `root/usr/share/rpcd/acl.d/luci-app-wol-api.json`; final independent check still required

## Phase 3: US2 (P2) cloud package
- [x] T006 [US2] `.github/workflows/build-ipk.yml`; remediation: staged feed with plugin as child directory (SDK scan -mindepth 1 ignores root Makefile), dynamic exact Makefile VERSION-rRELEASE, actual tar-gzip IPK and exactly-one control validation, no broad write permission for manual build, GH_REPO context for isolated release job
- [x] T007 [US2] `Makefile` 0.4.1-r1 and `README.md`; align future-proof actual cloud semantics and tests

## Phase 4: gates and US3 (P3)
- [x] T008 Final isolated regression/static/source checks including newly found boundaries, retain failed independent review facts
- [ ] T009 Independent reviewer verifies corrected implementation. Original rejected report rep_rev_whole_task_b62e49c7-5df3-4c91-9c31-7293a45c719a remains; new final report must reference it
- [ ] T010 [US3] Explicit-path commit, fast-forward push main and v0.4.1 tag, no new branch
- [ ] T011 [US2] Real Actions success/Release/download checksum/control proof
- [ ] T012 [US3] Private backup/install cloud IPK preserving config; plugin-only loading and safe checks
- [ ] T013 `.exp.md`/final evidence and plain-text QQ report

## Dependencies and findings
T001 → T002 → T003–T005; T006–T007 before T008 → T009 → T010 → T011 → T012 → T013. No invented gate success. Reviewer rejection rep_rev_whole_task_b7f83fda-0dd0-4417-80e5-9605cfceef98 confirmed prior source fixes pass but separate release job lacked repository context for gh CLI; remediation injected GH_REPO: ${{ github.repository }} and added regression asserting release job repository context. Remediation stays same feature; no new branch/tag before passing source gates.
