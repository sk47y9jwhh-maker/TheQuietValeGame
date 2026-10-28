# Living Table — selected alternative concept

28 October 2026. This handoff publishes **Living Table only**, with the original
layout available as a baseline. Start with [the Claude handover](../../CLAUDE_HANDOFF.md).
The live site remains on `main`; this is a review branch.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5184 --strictPort
```

Open `http://127.0.0.1:5184/`, then enter Living Table or choose a demonstration.
Sixteen situations are available in the selected concept and the baseline.
Each has a separate save namespace. Unrecognised/retired layout links are
rejected before the game mounts.

The curated source passed 64 test files / 692 tests and the production build.
Historical test counts for the original three-layout exploration remain in
the archive below and must not be reported as this branch's results.

## Review evidence

- [Recommendation and tradeoffs](RECOMMENDATION.md)
- [Initial experience audit](AUDIT.md)
- [Historical screenshots](SCREENSHOTS.md)
- [Accessibility evidence and limits](ACCESSIBILITY.md)
- [Performance record](PERFORMANCE.md)
- [Unfinished continuous playthrough](ACCEPTANCE_PLAYTHROUGH.md)
- [Original 2 October review](HISTORICAL_REVIEW_2026-10-02.md)
- [Original three-candidate preview guide](HISTORICAL_PREVIEW.md)
- [Implementation history](STATUS.md)

Council/Pocket names, links and screenshots in these historical records explain
earlier evaluation; those playable implementations are not included here.
Original local paths and port 5174 links describe that earlier laptop preview.
Use the current run command above for this branch.

The continuous 12-round journey remains unfinished after round 4. The old
browser save was not exported into this handoff. Independent player research,
spoken screen-reader output, real enlarged text/zoom, forced colours and
physical devices remain unverified. Confirmed state survives reload, but
unconfirmed payment drafts reset. The closed holiday automation does not run.
