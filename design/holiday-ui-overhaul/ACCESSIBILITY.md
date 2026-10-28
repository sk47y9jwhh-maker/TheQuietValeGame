# Accessibility review — 2 October 2026

This bounded review covers the three experimental player designs. It records observed fixes and remaining checks; it is not WCAG certification or a study with assistive-technology users.

## What changed

- **Tile inspection isolates its background.** Tab already stayed in the inspector, but the native accessibility tree still exposed the game behind it. The inspector now makes every surrounding branch inert and hidden to assistive navigation, including inspectors nested inside a Golden or Steward choice. It restores existing attributes and body scrolling when closed or unmounted. Reset confirmations share this boundary. Focus returns to the exact opener, including SVG hexes.
- **Repeated tiles have distinct control names.** Strain, support and cascade controls include all their tile coordinates. For example, `Decrease Strain adjustment for Cabin at A7` differs from H1 and A5. Support and cascade selections expose their pressed state. The legacy Warden icon button also has an explicit name.
- **Golden Signet back navigation retains focus.** Returning from destinations to tile selection previously left focus on the page body. The selection heading now receives focus. Initial parent announcements, individual checkbox edits and unconfirmed destinations retain their existing behaviour.
- **Phone resources remain readable.** At 320 pixels, horizontal names and two-digit totals crowded each other. Below 621 pixels, the three new designs stack 12-pixel labels above 18-pixel values, using relative font units. All six measured label/value pairs fit without overlap.
- **Contrast and focus are clearer.** The map credit is larger and darker. A pale outline marks keyboard focus in the dark turn guide. Pocket's selected action-count badge has a solid, contrasting background. Adjustment buttons have 12 pixels of scroll margin so their focus rings do not sit against the bottom edge in landscape.

No game rule, artwork, scenario fixture or saved-game format changed. Classic's layout remains the baseline; the shared modal semantics and explicit control names also improve its accessibility.

## Measured samples

Ratios use rendered foreground/background colours and the WCAG relative-luminance formula. Transparent colours were composited over their opaque background. Text sampling excluded disabled controls, hidden content, image/gradient backgrounds and SVG artwork. This is a sample of current views, not an exhaustive contrast scan.

| Sample | Before | After |
| --- | ---: | ---: |
| Map credit on Living Table's map panel | 3.66:1 at 9px | 5.68:1 at 12px |
| Focus outline on Living Table's dark guide | 2.19:1 | 7.52:1 |
| Focus outline on Council's dark guide | 2.10:1 | 8.38:1 |
| Focus outline on Pocket's dark guide | 1.71:1 | 6.81:1 |
| Pocket selected action-count badge | 3.83:1 | 7.70:1 |

The relevant targets are 4.5:1 for ordinary text and 3:1 for large text in [W3C's contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Modal isolation and focus recovery follow the [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). These targeted repairs do not establish whole-product conformance.

## Browser evidence

- **Living Table, 1440×900:** keyboard I opened Lumber Yard at G1. The native accessibility tree contained only inspector content. Tab and Shift+Tab stayed on Close; Escape restored the actual G1 SVG button. No inert attributes or body scroll lock remained. The updated sampled visible text had no sub-threshold result.
- **Council, 320×740:** all six resource labels/totals were contained and vertically separate. Document width was 320. Keyboard controls removed the A7 suggested Strain and substituted one Goods, retaining H1/A5 in the preview. Restore suggested Strain returned the initial draft. No payment was applied. The pale help-focus outline was measured against the actual guide background.
- **Council Signet, 768×1024:** selected Lumber Yard, planned B8, and inspected Cabin H1 inside the nested plan. The native tree excluded surrounding game controls; Escape returned to H1 and B8 stayed selected. Change selected tiles initially lost focus, then correctly focused its heading after repair. The draft was cleared back to zero selected tiles without committing a move. Document width was 768.
- **Pocket, 390×844:** inspected the saved one-action intention menu, clearer resource names/totals and selected count badge. Document width was 390 and the final sampled visible text had no sub-threshold result. Pointer navigation left the menu uncluttered by a keyboard-only outline.
- **Pocket pending effect, 844×390:** keyboard Tab from Apply reached Spend 1 Goods. Its 44×44 control initially touched the bottom edge; after the scroll-margin fix its bounds were y334.08–378.08 within a390-pixel viewport. No effect was applied. Document width was844.

Two new unedited JPEGs are in [the screenshot gallery](SCREENSHOTS.md): narrow Council with keyboard focus and the revised Pocket phone menu. The earlier six images remain preserved as evidence of the preceding milestone.

## Verification and limits

Final full suite: **65 files / 733 tests pass**. Production TypeScript/Vite build and whitespace checks pass. Six added regressions cover nested StrictMode isolation, preservation of earlier background attributes/scroll settings, coordinate-specific payment choices across all three designs, and Signet back-navigation focus/draft retention. Five initial tests reproduced the modal/label defects; the Signet test separately reproduced the focus loss. Existing tests were updated to use the clearer names. Two hidden-element query assumptions and two test-only TypeScript options were corrected during validation.

Source review found no automatic CSS animations. The three existing short hover/map transitions are covered by each experience's `prefers-reduced-motion: reduce` rules. Programmatic scrolling does not request smooth motion. The system reduced-motion setting was **not emulated or changed**, so this is source evidence, not a browser test under that preference.

The in-app browser's zoom shortcut did not change the viewport or text. No supported text-size or media-preference emulation was exposed. The 320-pixel checks establish narrow reflow only; they do not substitute for actual 200% text resizing or browser zoom. See [W3C's reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) for the distinct check. Physical phone/tablet testing, spoken screen-reader output, forced colours and an exhaustive contrast/target audit remain unverified. Printed card artwork and map typography need separate visual review at enlarged scale.

Final logs: `/private/tmp/quiet-vale-accessibility-final-tests.log` and `/private/tmp/quiet-vale-accessibility-final-build.log`. All previous demo game states were preserved; this review changed drafts only and restored them before leaving.
