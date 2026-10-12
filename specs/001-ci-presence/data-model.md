# Data model

## Device
Existing UCI device.name and device.mac unchanged; add optional device.ip (valid unicast IPv4). Existing main.interface selects LAN for probe as well as wake. Configuration survives upgrades; missing ip remains compatible.

## Observation
JSON helper output: state `online|unreachable|unknown`, reason/evidence string, ip when valid, mac when validated, observed_at Unix seconds. Frontend displays formatted observation timestamp, never persists power state. Unknown includes invalid input, missing address, unsupported target/interface, tool failure and identity mismatch; unreachable means valid probe completed without response; online requires fresh matching ARP reply. A new probe replaces the row result. Initial and unsaved/no-address states unknown.

## Release
Version Makefile PKG_VERSION 0.4.1 + PKG_RELEASE 1; normal v0.4.1 tag; IPK control architecture all. CI source commit/run are tied to asset and SHA256 file. No database or extra config schema.
