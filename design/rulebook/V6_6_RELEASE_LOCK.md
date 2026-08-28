# The Quiet Vale Printed Rules v6.6

Status: **approved and locked on 28 August 2026**

This record fixes the byte identity of the approved v6.6 Main Rulebook, six
Steward Aids and the carried-forward five-player Steward's Ledger. The
immutable local release package is:

`output/releases/The_Quiet_Vale_Printed_Rules_v6_6_LOCKED.zip`

Archive SHA-256:

`0f986083cc95237c0a3aeefa65fb2aa89a6a97b9a7c657f4c7babd2326dd2767`

The package contains the editable Rulebook DOCX, the production Rulebook PDF,
all six role-specific Steward Aid PDFs, the verified v6.5 five-player Steward's
Ledger carried forward unchanged, a release notice, an artifact manifest and
independently verifiable SHA-256 checksums.

Do not overwrite the locked package or any artifact named in
`v6_6-release-lock.json`. Any later content or layout revision must use a new
version number and receive a new lock record.

The discontinued bot is outside the physical rules suite and was not touched.

To verify the unpacked local package:

```sh
cd output/releases/the-quiet-vale-printed-rules-v6_6-locked
shasum -a 256 -c SHA256SUMS.txt
```
