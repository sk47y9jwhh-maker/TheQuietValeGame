# Continuous browser acceptance journey — saved for review

2 October 2026, following local checkpoint55199d4. This is a scripted acceptance playthrough operated through the real visible UI, not independent player research or an optimal strategy claim. No engine state injection, saved-game editing or scenario restart is used.

Route: `http://127.0.0.1:5174/?experience=tabletop&scenario=welcome`. This existing isolated demo already had two players set up and seeded by earlier checks: Ranger N4 and Warden J9. This continuous journey starts immediately before round1's first reveal. Earlier setup/seeding evidence is separate.

## Round 1

The Break Holds and Ancient Paths Reopen entered play and were acknowledged. Ranger placed Gathering Outpost N4, activated it for Herbs10→12, built CabinN3 (Wood10→8, Food10→5), then used temporary reach at N1 and placed Farmstead there for the last ordinary action. The handoff explicitly announced temporary reach expiry and four actions for Warden.

Warden placed Salvage CampJ9 and produced Metal10→12, built CabinJ8 (Wood8→6, Food5→0), then placed Common LandJ7 (Metal12→10, Herbs12→10). The preview correctly stated that CabinJ8 gains Supported. Both players used all four ordinary actions. Round end had no Arrival timer consequences.

## Round 2

Shared Hands and Crafting Fair entered play and were acknowledged. Ranger produced2Food, upgraded FarmsteadN1 to Artisan Farm for no resources and one action, then activated twice. The visible previews matched Food0→2→5→8 and Goods10→12→14. All four actions used.

Warden used The Break Holds (Wood6→9) and prepared Crafting Fair; these Boon uses left the four ordinary actions available. WorkshopsI8 showed Payment choice next before opening review. The prepared Wood discount previewed1Wood+1Metal and actions4→3, and confirmation paid exactly that (Wood9→8, Metal10→9). Upgrading CabinJ8 used2Stone and4Food under the Workshop passive (Stone10→8, Food8→4), and used one action. Salvage CampJ9 upgraded to Reclamation Works free of resources for one action. Its production preview correctly capped Goods14→15 (+1, Full) while adding Metal9→12. The fourth action produced exactly that.

## Round 3

Remnants of the Fleet and Blade to Herb were revealed and acknowledged. Ranger completed both through review: Fleet paid2Wood+4Herbs+2Goods (Docks unlocked), Blade paid2Wood+2Metal+2Food (The Root Weavers Respite unlocked). Each cost one action. Ranger produced3Food+2Goods at Artisan Farm, then placed PathN2, connecting the northern tiles and ending atN2. All four actions used.

Warden built CabinK8 (2Wood+5Food), upgraded Common LandJ7 to The Pleasance using1Metal+2Herbs with the Workshop discount, and the preview correctly announced CabinK8 gaining Supported. DocksL7 cost no resources and one action. Reclamation Works produced3Metal and no Goods because Goods was full. All four actions used. Warehouse ended2Wood/8Stone/12Metal/0Food/4Herbs/15Goods.

## Round 4

No Soul Goes Unserved and Strong Foundations entered play. Ranger completed each for2Herbs+2Goods and one action, unlocking Alms House and House of Learning respectively. Two Artisan Farm activations ended Food6 and Goods15. All four actions used.

Warden applied Ancient Paths Reopen, preparing +1Wood for the next Lumber production; it did not cost an ordinary action. House of LearningI7, Mine TunnelM7 and Alms HouseH8 were built free of resources for one action each. Alms House preview announced Workshops gaining Supported. Mine Tunnel produced2Stone for the last action. The Docks network correctly exposed distant riverbank placement choices. The browser window narrowed during this run and hid the board behind its responsive Board tab; the desktop viewport was restored to1440×900 before continuing. One initial Alms House click had not committed; this was detected from remaining supply/action state and the final placement was explicitly verified.

## Current continuation point

At the start of **Season II, round5**, private seeding correctly hides Ranger’s hand behind **Reveal Ranger’s hand**. No actions deliberately passed. Warehouse2Wood/10Stone/12Metal/6Food/0Herbs/15Goods. Thirteen placed tiles, including DocksL7, House of LearningI7, Alms HouseH8 and Mine TunnelM7. RangerN1, WardenM7. Other demo saves untouched.

Robert returned and requested wrap-up at this point on2October. No further game actions were taken. If resumed later, seed SeasonII through both private handoff gates, then continue rounds5–12 and Ledger recording. This continuous journey remains incomplete; separate late-game/finale checks are documented elsewhere. No confirmed gameplay defect was found in these four rounds. The tested implementation checkpoint is55199d4; final handoff changes are documentation only.
