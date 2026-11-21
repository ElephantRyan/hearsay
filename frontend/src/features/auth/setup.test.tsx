import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const settings = {
  absUrl: { value: "https://abs.home.test", source: "saved" },
  serviceToken: { value: null, source: "unset" },
  mirrorEnabled: { value: "false", source: "environment" },
  authMode: { value: "both", source: "environment" },
  frontendUrl: { value: "http://localhost:5173", source: "environment" },
  oidcIssuer: { value: null, source: "unset" },
  oidcClientId: { value: null, source: "unset" },
  oidcClientSecret: { value: null, source: "unset" },
  oidcRedirectUri: { value: null, source: "unset" },
};

/** A new server: nobody is signed in and setup is needed, until a setup succeeds. */
function newServer() {
  const sent: unknown[] = [];
  let claimed = false;
  server.use(
    http.get("/api/setup", () => HttpResponse.json({ needed: !claimed })),
    http.get("/api/me", () =>
      claimed
        ? HttpResponse.json({ userId: "r1", username: "owner", userType: "root" })
        : HttpResponse.json("sign in first", { status: 401 }),
    ),
    http.post("/api/setup", async ({ request }) => {
      const body = (await request.json()) as { absUrl: string; password: string };
      sent.push(body);
      if (body.absUrl.includes("wrong")) {
        return HttpResponse.json("absUrl didn't answer", { status: 400 });
      }
      claimed = true;
      return HttpResponse.json({ userId: "r1", username: "owner", userType: "root" });
    }),
    http.get("/api/admin/settings", () => HttpResponse.json(settings)),
    http.get("/api/admin/status", () =>
      HttpResponse.json({
        abs: "reachable",
        authentik: "not set up",
        serviceAccount: null,
        serviceAccountType: null,
        problem: "No Audiobookshelf token is set.",
      }),
    ),
  );
  return sent;
}

describe("first-run setup", () => {
  it("sends a new server's first visitor to setup, then to the settings to finish", async () => {
    const sent = newServer();
    const router = mount("/");

    expect(await screen.findByRole("heading", { name: "Set up Recommends" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Audiobookshelf address"), "https://wrong.test");
    await userEvent.type(screen.getByLabelText("Admin username"), "owner");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(
      await screen.findByText("The Audiobookshelf address didn't answer."),
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Audiobookshelf address"));
    await userEvent.type(screen.getByLabelText("Audiobookshelf address"), "https://abs.home.test");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/Almost done: paste an Audiobookshelf/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin");
    expect(sent).toEqual([
      { absUrl: "https://wrong.test", username: "owner", password: "pw" },
      { absUrl: "https://abs.home.test", username: "owner", password: "pw" },
    ]);
  });

  it("only points to sign-in once a server is set up", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json("sign in first", { status: 401 })));
    const router = mount("/setup");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
  });
});
