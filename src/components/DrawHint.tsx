/** One line telling the player they can mark up the board. Mouse or touch wording, chosen by CSS. */
export function DrawHint() {
  return (
    <p className="draw-hint mono mono--sm mono--mute">
      <span className="draw-hint--mouse">Right-click a square to mark it, right-drag to draw an arrow. Shift, Alt or Ctrl change the colour; a left-click clears.</span>
      <span className="draw-hint--touch">Press and hold a square, then tap another to draw an arrow, or the same one to mark it.</span>
    </p>
  )
}
