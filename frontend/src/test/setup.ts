import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no modal <dialog> (showModal, close, Escape). Browsers all do; this stands in for
// the parts the Sheet uses: open/close, the close event, and Escape as a cancelable cancel.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const dialog = [...document.querySelectorAll("dialog")].reverse().find((d) => d.open);
    if (dialog?.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
  });
}
