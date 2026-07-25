# Vendored front-end libraries

These are committed binaries, not npm dependencies, so nothing tracks them for
advisories. This file is that tracking. Update it whenever a file here changes.

| File | Library | Version | SHA-256 | Loaded by |
|---|---|---|---|---|
| `chart.umd.min.js` | Chart.js | 4.4.0 | (not recorded - predates this file) | `analytics.html`, `expenses.html`, `income.html`, `index.html`, `interest.html` (static `<script src>`) |
| `xlsx.full.min.js` | SheetJS (Community) | 0.20.3 | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` | `expenses.js`, `income.js`, `subscriptions.js` - injected on demand for XLSX export only |

They are self-hosted deliberately: CSP is `script-src 'self' 'nonce-...'`, with no CDN
origin allowed, and the service worker precaches whatever the pages reference.

## SheetJS

0.20.3 is the current Community release (latest tag on `git.sheetjs.com`). It post-dates
both advisories that affected the vendored 0.18.5, per the vendor's own advisory pages at
<https://cdn.sheetjs.com/advisories/>:

- **CVE-2023-30533** - prototype pollution, affects "all versions through 0.19.2", fixed
  in 0.19.3.
- **CVE-2024-22363** - ReDoS, affects "all versions through 0.20.1", fixed in 0.20.2.

Both are in the workbook *parsing* path, which FiApp never enters - the only entry points
used are

    XLSX.utils.book_new, XLSX.utils.aoa_to_sheet, XLSX.utils.book_append_sheet, XLSX.writeFile

all write-side, all fed from the app's own state. The CSV/OFX/QIF import feature uses
hand-written parsers in `static/js/import.js`, not SheetJS. So the vulnerable code was
present but unreachable even before the upgrade; the upgrade removes it outright.

### Upgrading

SheetJS left npm after 0.18.x; releases now come from the vendor's own CDN, so
`npm install xlsx` fetches an abandoned package. Get the current build from
<https://cdn.sheetjs.com/>, replace `xlsx.full.min.js`, update the table above **including
the SHA-256**, and re-test an XLSX export from all three trackers (the overflow menu's
Export option).

**On verifying the download.** SheetJS publishes no SRI hash or signature for these
artifacts - there is no vendor-published digest to check against, so the usual advice
("verify against the published hash") is not actually available here. What was done for
0.20.3 instead, and what should be repeated on the next bump:

1. **TLS fetch from the vendor's own CDN** (`cdn.sheetjs.com`), not a third-party mirror.
2. **Two artifacts, one hash.** The standalone
   `xlsx-<v>/package/dist/xlsx.full.min.js` and the same file extracted from the release
   tarball `xlsx-<v>/xlsx-<v>.tgz` are byte-identical. Catches a corrupted or tampered
   single artifact, not a compromised CDN.
3. **Capability diff against the outgoing build.** Neither 0.18.5 nor 0.20.3 contains
   `XMLHttpRequest`, `fetch(`, `eval(`, `new Function`, `importScripts`, `WebSocket`,
   `sendBeacon` or `localStorage`, and the only http(s) literals in either are XML
   namespace URIs. A build that grew a network or eval capability would show up here.
4. **Functional check** of the four APIs above: `XLSX.version` reports the expected
   release, a workbook writes, and it round-trips back to the same cell values.

The SHA-256 in the table is the trust-on-first-use baseline: it is recorded so a later
unexplained change to the file is detectable, not because the vendor attests to it.
