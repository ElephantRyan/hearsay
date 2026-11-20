import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RatingInput } from "./RatingInput";

function Harness({ initial }: { initial?: number }) {
  const [score, setScore] = useState<number | undefined>(initial);
  return (
    <>
      <RatingInput value={score} onChange={setScore} />
      <output data-testid="score">{score ?? "none"}</output>
    </>
  );
}

describe("RatingInput", () => {
  it("is a labelled radio group of ten scores", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: /your score/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(10);
  });

  it("selects a score on click", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("7"));
    expect(screen.getByTestId("score")).toHaveTextContent("7");
    expect(screen.getByLabelText("7")).toBeChecked();
  });

  it("moves with the arrow keys, as a native radio group does", async () => {
    render(<Harness initial={4} />);
    screen.getByLabelText("4").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByTestId("score")).toHaveTextContent("5");
  });

  it("takes number keys, with 0 meaning 10", async () => {
    render(<Harness />);
    screen.getByLabelText("1").focus();
    await userEvent.keyboard("8");
    expect(screen.getByTestId("score")).toHaveTextContent("8");
    await userEvent.keyboard("0");
    expect(screen.getByTestId("score")).toHaveTextContent("10");
  });
});
