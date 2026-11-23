import { fireEvent, screen } from "@testing-library/react";

/**
 * Sets the score slider (the only one on screen, or `slider`). A real drag can't run in jsdom;
 * a change is what the slider hears from one.
 */
export function pickScore(score: number, slider: HTMLElement = screen.getByRole("slider")) {
  const input = slider as HTMLInputElement;
  // An unset slider already shows its middle value; picking that one is a tap, not a move.
  if (input.getAttribute("aria-valuetext") === "No score" && input.value === String(score)) {
    fireEvent.pointerUp(input);
    return;
  }
  fireEvent.change(input, { target: { value: String(score) } });
}
