import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves my account, starting as `ElephantRyan`, and records each change sent. */
function serveAccount() {
  const sent: unknown[] = [];
  let account = { username: "ElephantRyan", displayName: "ElephantRyan" };
  server.use(
    http.get("/api/me", () =>
      HttpResponse.json({ userId: "u-1", username: "ElephantRyan", userType: "user" }),
    ),
    http.get("/api/me/account", () => HttpResponse.json(account)),
    http.put("/api/me/account", async ({ request }) => {
      const body = (await request.json()) as { displayName: string };
      sent.push(body);
      if (body.displayName.trim() === "")
        return HttpResponse.json("displayName must not be blank", { status: 400 });
      account = { ...account, displayName: body.displayName.trim() };
      return HttpResponse.json(account);
    }),
  );
  return sent;
}

describe("the account page", () => {
  it("changes the name everyone sees, and shows the collection it names", async () => {
    const sent = serveAccount();
    mount("/me/account");

    const box = await screen.findByLabelText("Display name");
    expect(box).toHaveValue("ElephantRyan");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.clear(box);
    await userEvent.type(box, "Ryan");
    expect(screen.getByText("Ryan Recommends")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
    expect(sent).toEqual([{ displayName: "Ryan" }]);
    // the header shows the new name, and the username stays
    expect(await screen.findByRole("link", { name: "Account" })).toHaveTextContent("Ryan");
    expect(screen.getByText(/You sign in as/)).toHaveTextContent("ElephantRyan");
  });

  it("goes back to the username in one tap", async () => {
    serveAccount();
    mount("/me/account");

    const box = await screen.findByLabelText("Display name");
    await userEvent.clear(box);
    await userEvent.type(box, "Someone");
    await userEvent.click(screen.getByRole("button", { name: "Use my username" }));
    expect(box).toHaveValue("ElephantRyan");
    expect(screen.queryByRole("button", { name: "Use my username" })).not.toBeInTheDocument();
  });

  it("says why when the server refuses the name", async () => {
    serveAccount();
    server.use(
      http.put("/api/me/account", () =>
        HttpResponse.json("displayName must be at most 40 characters", { status: 400 }),
      ),
    );
    mount("/me/account");

    const box = await screen.findByLabelText("Display name");
    await userEvent.type(box, "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The display name must be at most 40 characters",
    );
  });
});
