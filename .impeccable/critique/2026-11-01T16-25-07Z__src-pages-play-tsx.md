---
target: play page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/den/Projects/Web/chess/src/pages/Play.tsx"
target_fingerprint: "sha256:0a9528164438fa36d650284ee6d7675c8655453547da0d0cc7b2e5be831b7db8"
target_path: /home/den/Projects/Web/chess/src/pages/Play.tsx
timestamp: 2026-11-01T16-25-07Z
slug: src-pages-play-tsx
---
Method: dual-agent (A: design review subagent · B: detector subagent)

## Design Health Score (before fixes)
Landing (7 and 10 n/a): 1:3 2:4 3:3 4:4 5:3 6:4 8:4 9:3 = 28/32 (Good).
Play (Operate): 1:3 2:3 3:2 4:3 5:2 6:3 7:3 8:4 9:2 10:2 = 27/40 (Acceptable).

## Design specificity
Authored, not templated: the imagery is the product (live board), the split king is a motif only this product owns, copy in the product's voice. Detector: CLI scan 0 findings; browser overlay reported em-dash-overuse (advisory, the pinned LABEL — VALUE micro-copy) and cream-palette (the pinned paper token). Both are brief, not defects. Contrast probe: 0 text pairs under 4.5:1.

## Priority issues (all fixed in the polish pass)
- [P1] Dark-square state marks at 2.83:1 (red on ink) → 1px paper edge on the red rules, paper halo on target dots, one check colour on both tones.
- [P1] Square focus ring merged with neighbours → ring inset 3px from the edge.
- [P1] Phone: 38px squares, own clock below the fold → board edge to edge in the frame (44px squares), side panel dissolved into the frame grid so the player's clock sits under the board.
- [P1] Game end had no presence → result card over the board, focus moves to New game.
- [P2] Status corner wrapped and shifted the board → status moved below the board on phones; one live region.
- [P2] Promotion focus (mouse-triggered chooser never took focus, Tab escaped, focus dropped to body) → rAF focus, Tab trap, focus returns to the destination square, tap elsewhere cancels, chooser stacked over the file.
- [P2] Current-ply focus ring ink on ink → paper outline.
- [P2] Undo during history review truncated the live game; New game / Resign fired on one press → Undo disabled while reviewing; two-step arm/confirm.
- [P2] Coordinates 8px at 375 → floor 10px, nudged off the piece feet.
- Minor: piece body/base seam removed, king cross enlarged, red seam on the split king dropped (outside the red rule), unused paper-3/error/success tokens and dead square onClick removed, disabled opacity 55%, footer link 44px hit area, player labels no longer promise a second player, ArrowLeft/Right walk the move list, PageUp/PageDown on the board, touch keeps page scroll.
