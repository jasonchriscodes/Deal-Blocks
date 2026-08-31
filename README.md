# Deal Blocks

A block-puzzle game built for the Vouchermatic HTML5 Game Developer hiring challenge, by Jason Christian.

**Play it live:** https://jasonchriscodes.github.io/Deal-Blocks/

Drag voucher-shaped pieces onto an 8×8 board. Fill a full row or column to clear it and score points — clear several lines in one move for a combo bonus. No build step, no dependencies: open `index.html` in a browser and play.

## How to play

- **Mouse / touch** — drag a piece from the tray onto the board and drop it on a valid (highlighted) spot. Tap the ⟳ button on a piece to rotate it 90° before placing.
- **Keyboard** — Tab to a piece, `Enter`/`Space` to pick it up, arrow keys to move it over the board, `Enter` to place, `Esc` to cancel. Tab to a piece's ⟳ button and press `Enter`/`Space` to rotate it.
- Clear a row or column to score. Clear 2+ at once for a combo multiplier.
- Rare **golden voucher** pieces are worth a bonus when the line they're part of clears.
- The board, tray, and score persist across a refresh (`localStorage`) until the game ends.

## Features

- Drag-and-drop with a full keyboard-accessible alternative and screen-reader announcements (`aria-live` status region, ARIA labels)
- Light/dark theme that follows the OS preference by default, with a manual override
- Procedural sound effects (Web Audio API — no audio files) and haptic feedback on supported devices, both mutable
- Combo scoring, golden voucher bonus, animated feedback (placement pop, line clears, combo flash)
- Best score and in-progress game saved to `localStorage`

## Project structure

- `index.html` — markup
- `deal-blocks.css` — styles and theming
- `deal-blocks.js` — game logic (vanilla JS, no framework or build tooling)
