# Encounter artwork delivery — 27 September 2026

## Change and preservation

The browser now chooses a 420 px, approximately 840 px, or full-resolution WebP background using native `srcset`/`sizes`. Web cards use native lazy loading and asynchronous decoding. Live HTML names, effects and controls remain available while artwork loads. Explicit dimensions preserve the existing aspect ratio.

The approved full-bleed PNGs and existing trimmed PNGs are unchanged. Print mode continues to use the original full-bleed file, eagerly, without responsive candidates. No content, cropping, card typography, game data or rules were changed. Smaller copies are Lanczos3 resamples of the same trimmed image, never enlarged. All candidates are encoded losslessly. The generator decodes every result and compares its pixels against the expected resample, and compares the full-size result against the original pixels exactly. It also preserves any source ICC profile. These checks passed for all ten images with Sharp 0.35.4 / libwebp 1.6.0.

## Measured asset sizes

Bytes are file payload sizes, decimal MB. The approximately 840 px copies of Boon and Golden Boon stop at their original width of 829 px.

| Background | Prior PNG bytes | 420 px WebP | About 840 px WebP | Full-size WebP |
| --- | ---: | ---: | ---: | ---: |
| Arrival | 5,430,048 | 274,066 | 1,111,664 | 4,110,840 |
| Boon | 1,587,505 | 301,834 | 1,125,430 | 1,125,430 |
| Burden | 2,685,654 | 126,460 | 507,792 | 1,739,946 |
| Golden Boon | 1,521,315 | 292,114 | 1,091,340 | 1,091,340 |
| **Four-type total** | **11,224,522** | **994,474** | **3,836,226** | **8,067,556** |

A four-type 420 px set is 91.1% smaller. The approximately 840 px set is 65.8% smaller, and the full-resolution set 28.1% smaller. The browser loads candidates for the images it needs, not all ten files. Repeated cards share a background URL. These figures measure image payloads, not total game page weight or real-world page-load time.

## Browser observations

- Before: Council's settlement demo had four 420 px-wide cards, using the original Boon, Arrival and Burden PNGs (9,703,207 unique background bytes). Both Arrivals use one file.
- After, on the default desktop surface: the browser selected Boon 829 and Arrival 840 for 420 px cards. The off-screen Burden had no current source yet. This showed actual responsive source selection, rather than only checking markup.
- At a 768×1024 viewport override: cards rendered at 382 px and selected the 420 px files. Scrolling to Burden caused its 420 px file to load. Boon, Arrival and Burden total 702,360 bytes in this case, 92.8% less than their previous PNGs. The temporarily unpainted background left all card text and controls readable.
- Before/after screenshots and the loaded Burden were inspected inline. The artwork, border, text alignment and seasonal copy remained intact.
- The browser tool's read-only evaluation does not expose `performance.getEntriesByType`. No resource timing, mobile-network timing, LCP, CLS, Lighthouse score or certification is claimed. Viewport overrides do not constitute physical-device testing.

## Reproduce

The derivatives are checked in. Normal `npm run build` and `npm test` need no image tool or regeneration.

`npm run artwork:encode` requires the optional development tool Sharp. It uses a locally installed `sharp`, or a preinstalled package named by `QV_SHARP_MODULE`. The run in this workspace used:

```sh
QV_SHARP_MODULE=/Users/robertlittle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp npm run artwork:encode
```

The encoder writes only `src/assets/encounter-cards/web/responsive/`. Its manifest includes file hashes, decoded pixel hashes, exact dimensions, byte sizes and encoder versions. `responsiveArtwork.test.tsx` detects missing/stale derivatives or changed source/print files, guards the 1.1 MB small-set budget, and checks the web/print image routes.

## Remaining work

The 1.43 MB approved map is still unchanged. No field measurements over a constrained connection have been made. Future optimization should be driven by actual loading evidence, and preserve the full map detail needed by zoom.
