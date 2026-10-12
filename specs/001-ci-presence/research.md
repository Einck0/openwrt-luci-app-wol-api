# Research and resolved decisions

## Existing detection
Read config.js: STALE/DELAY/PROBE/PERMANENT treated Online, absence Offline; page load only. Target has many STALE entries. Decision: replace classification, not bolt on parallel contradictory status.

## Probe primitive
Target has BusyBox ping supporting -W and no arping. Investigative ping to requested PC had no response (not shutdown evidence). Scout suggested ping+neighbor; rejected as final proof because preexisting REACHABLE does not prove reply to that probe and timeout/routed IP/identity races can mislead. Decision: add official OpenWrt iputils-arping package (/usr/bin/arping, packages openwrt-24.10 net/iputils/Makefile confirms installation) and inspect its actual bounded reply output. Parsing validated response MAC enables fresh identity check without ICMP acceptance. Standby NIC and proxy ARP remain limitations.

## Build
openwrt/gh-action-sdk official docs and Dockerfile use SDK ARCH image. Stable OpenWrt 24.10 suffix retains IPK; snapshot may APK. Pure PKGARCH all package can build under x86_64-openwrt-24.10 without emulating router architecture. v11 resolved via GitHub public API to 7fc2640243284ecc44f4a9c3f749a61746ee02cb. The cloud run remains required verification, not presumed success from documents. SDK bin contains dependency IPKs too; select plugin only.

## Release authorization
Tag push with authorized Git SSH avoids unavailable local gh/API write credential. Runner GITHUB_TOKEN contents write can create Release. No recurring automatic installation. Normal tag allowed; branch proliferation explicitly forbidden.

## Current source
Root .exp.md absent. Initial HEAD b618f255e3e8f3c12312556740371192a60e09c8; origin/main e2c7ec8 is ancestor, not competing new remote code. 12 unpublished plugin commits are user-existing work; preserve and fast-forward publish as requested, no reset/rebase/force.

## Evidence
Investigative artifacts under authorized scratch /home/service/tmp/wol-api/current/ (not public repo); runtime ImmortalWrt 24.10.0, opkg, br-lan, ucode extensions. No physical wake test performed.
