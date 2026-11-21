import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AdminSettings } from "../../api/types";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedInAs = (userType: string) =>
  http.get("/api/me", () => HttpResponse.json({ userId: "u-1", username: "ryan", userType }));

function settingsOf(mirror: "true" | "false", source = "environment"): AdminSettings {
  return {
    absUrl: { value: "https://abs.home.test", source },
    serviceToken: { value: null, source: "saved" },
    mirrorEnabled: { value: mirror, source: "environment" },
    authMode: { value: "abs", source: "environment" },
    frontendUrl: { value: "http://localhost:3000", source: "environment" },
    oidcIssuer: { value: null, source: "unset" },
    oidcClientId: { value: null, source: "unset" },
    oidcClientSecret: { value: null, source: "unset" },
    oidcRedirectUri: { value: null, source: "unset" },
  };
}

/** Serves the admin routes, and records what the page sends. */
function serve(settings: AdminSettings) {
  const sent: { method: string; path: string; body?: unknown }[] = [];
  let current = settings;
  server.use(
    signedInAs("admin"),
    http.get("/api/admin/settings", () => HttpResponse.json(current)),
    http.get("/api/admin/status", () =>
      HttpResponse.json({
        abs: "reachable",
        serviceAccount: "recommendation-bot",
        serviceAccountType: "admin",
        authentik: "not set up",
        problem: null,
      }),
    ),
    http.put("/api/admin/settings", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.push({ method: "PUT", path: "/admin/settings", body });
      current = {
        ...current,
        ...(typeof body.absUrl === "string"
          ? { absUrl: { value: body.absUrl, source: "saved" } }
          : {}),
      };
      return HttpResponse.json(current);
    }),
    http.delete("/api/admin/settings/:name", ({ params }) => {
      sent.push({ method: "DELETE", path: `/admin/settings/${params.name}` });
      current = { ...current, absUrl: { value: "https://from-env.test", source: "environment" } };
      return HttpResponse.json(current);
    }),
    http.post("/api/sync", ({ request }) => {
      const dryRun = new URL(request.url).searchParams.get("dryRun");
      sent.push({ method: "POST", path: `/sync?dryRun=${dryRun}` });
      return HttpResponse.json([
        {
          userId: "u-1",
          libraryId: "lib-1",
          action: dryRun === "true" ? "would-create" : "created",
          books: 3,
          error: null,
        },
      ]);
    }),
  );
  return sent;
}

describe("the admin screen", () => {
  it("is only for admins, and only they see the way in", async () => {
    server.use(signedInAs("user"));
    mount("/admin");

    expect(await screen.findByText("Only an admin can see this page")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows whether Audiobookshelf answers and whose token the app holds", async () => {
    serve(settingsOf("false"));
    mount("/");

    await userEvent.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByText("recommendation-bot (admin)")).toBeInTheDocument();
    expect(screen.getByText("Answering")).toBeInTheDocument();
  });

  it("saves only what changed, and never shows the token", async () => {
    const sent = serve(settingsOf("false"));
    mount("/admin");

    const address = await screen.findByLabelText("Audiobookshelf address");
    expect(address).toHaveValue("https://abs.home.test");
    expect(screen.getByText("From ABS_URL on the server.")).toBeInTheDocument();
    const token = screen.getByLabelText("Audiobookshelf token");
    expect(token).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Nothing has changed.")).toBeInTheDocument();
    expect(sent).toEqual([]);

    await userEvent.clear(address);
    await userEvent.type(address, "https://abs.new.test");
    await userEvent.type(token, "new-token");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        method: "PUT",
        path: "/admin/settings",
        body: { absUrl: "https://abs.new.test", serviceToken: "new-token" },
      },
    ]);
    expect(token).toHaveValue("");
    // The address and the token are both saved now.
    expect(screen.getAllByText("Saved in this app.")).toHaveLength(2);
  });

  it("goes back to the environment's value", async () => {
    const sent = serve(settingsOf("false", "saved"));
    mount("/admin");

    await userEvent.click(await screen.findByRole("button", { name: "Use ABS_URL instead" }));
    expect(await screen.findByText("From ABS_URL on the server.")).toBeInTheDocument();
    expect(sent).toEqual([{ method: "DELETE", path: "/admin/settings/absUrl" }]);
  });

  it("previews collections before writing them, by name", async () => {
    const sent = serve(settingsOf("true"));
    mount("/admin");

    await userEvent.click(await screen.findByRole("button", { name: "Preview" }));
    const preview = await screen.findByRole("list", { name: "What would change" });
    expect(await within(preview).findByText("ryan · Audiobooks")).toBeInTheDocument();
    expect(within(preview).getByText("Would create, 3 books")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));
    const done = await screen.findByRole("list", { name: "What changed" });
    expect(within(done).getByText("Created, 3 books")).toBeInTheDocument();
    expect(sent).toEqual([
      { method: "POST", path: "/sync?dryRun=true" },
      { method: "POST", path: "/sync?dryRun=false" },
    ]);
  });

  it("says when writing collections is off", async () => {
    serve(settingsOf("false"));
    mount("/admin");

    expect(await screen.findByText(/Writing collections is off/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });

  it("switches sign-in to Authentik with everything it needs, in one save", async () => {
    const sent = serve(settingsOf("false"));
    mount("/admin");

    await userEvent.type(
      await screen.findByLabelText("Issuer"),
      "https://auth.test/application/o/recommends/",
    );
    await userEvent.type(screen.getByLabelText("Client ID"), "cid");
    await userEvent.type(screen.getByLabelText("Client secret"), "csec");
    await userEvent.click(
      screen.getByRole("button", { name: `Use ${window.location.origin}/api/auth/callback` }),
    );
    await userEvent.click(screen.getByRole("radio", { name: "Authentik only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        method: "PUT",
        path: "/admin/settings",
        body: {
          oidcIssuer: "https://auth.test/application/o/recommends/",
          oidcClientId: "cid",
          oidcRedirectUri: `${window.location.origin}/api/auth/callback`,
          oidcClientSecret: "csec",
          authMode: "oidc",
        },
      },
    ]);
    expect(screen.getByLabelText("Client secret")).toHaveValue("");
  });
});
