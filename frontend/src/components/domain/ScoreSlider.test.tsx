import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ScoreSlider } from "./ScoreSlider";

function Harness({ initial }: { initial?: number }) {
  const [score, setScore] = useState<number | undefined>(initial);
  return (
    <>
      <ScoreSlider value={score} onChange={setScore} />
      <span data-testid="score">{score ?? "none"}</span>
    </>
  );
}

describe("ScoreSlider", () => {
  it("is a labelled 1-10 slider that starts with no score", () => {
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Your score, out of 10" });
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "10");
    expect(slider).toHaveAttribute("aria-valuetext", "No score");
    expect(screen.getByText("No score")).toBeInTheDocument();
    expect(screen.getByTestId("score")).toHaveTextContent("none");
  });

  it("picks where it's moved to, and shows the number", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "8" } });
    expect(screen.getByTestId("score")).toHaveTextContent("8");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "8 out of 10");
  });

  it("picks the shown value on a first tap that doesn't move it", () => {
    render(<Harness />);
    fireEvent.pointerUp(screen.getByRole("slider"));
    expect(screen.getByTestId("score")).toHaveTextContent("6");
  });

  // Arrow keys step a native range input in a browser; jsdom doesn't, so this checks only that a
  // key on an unset slider picks the value it shows.
  it("picks the shown value on a first key press", () => {
    render(<Harness />);
    fireEvent.keyUp(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(screen.getByTestId("score")).toHaveTextContent("6");
  });
});
