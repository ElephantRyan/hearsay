import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AdminSettings, LinkedServer } from "../../api/types";
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
    serverName: { value: "The family library", source: "environment" },
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
      // As the real server answers: the request that saves reads the settings from before it.
      const before = current;
      current = {
        ...current,
        ...(typeof body.absUrl === "string"
          ? { absUrl: { value: body.absUrl, source: "saved" } }
          : {}),
        ...(typeof body.serverName === "string"
          ? { serverName: { value: body.serverName, source: "saved" } }
          : {}),
      };
      return HttpResponse.json(before);
    }),
    http.delete("/api/admin/settings/:name", ({ params }) => {
      sent.push({ method: "DELETE", path: `/admin/settings/${params.name}` });
      const before = current;
      current = { ...current, absUrl: { value: "https://from-env.test", source: "environment" } };
      return HttpResponse.json(before);
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

const copyA: LinkedServer = {
  id: "l-1",
  name: "Alex's library",
  address: "https://alex.test",
  linkedAt: Date.UTC(2026, 10, 21, 12),
  linkedBy: "invite",
};

/** Serves the linked-server routes over `serve`'s, and records what the page sends. */
function serveLinks(sent: { method: string; path: string; body?: unknown }[], told = true) {
  let links: LinkedServer[] = [copyA];
  server.use(
    http.get("/api/admin/links", () => HttpResponse.json(links)),
    http.post("/api/admin/links/invite", () => {
      sent.push({ method: "POST", path: "/admin/links/invite" });
      return HttpResponse.json({
        code: "http://localhost:3000#secret",
        expiresAt: Date.UTC(2026, 10, 22, 12),
      });
    }),
    http.post("/api/admin/links", async ({ request }) => {
      const body = (await request.json()) as { code: string };
      sent.push({ method: "POST", path: "/admin/links", body });
      if (!body.code.startsWith("https://sam.test#")) {
        return HttpResponse.json(
          "the other server refused: the link code was refused: it is used, expired, or mistyped; ask for a new one",
          { status: 502 },
        );
      }
      const linked = { ...copyA, id: "l-2", name: "Sam's library", address: "https://sam.test" };
      links = [...links, linked];
      return HttpResponse.json(linked);
    }),
    http.post("/api/admin/links/:id/refresh", ({ params }) => {
      sent.push({ method: "POST", path: `/admin/links/${params.id}/refresh` });
      links = links.map((link) =>
        link.id === params.id
          ? {
              ...link,
              lastFetchedAt: Date.UTC(2026, 10, 21, 14),
              ratings: 3,
              matched: 2,
              notAnsweringSince: Date.UTC(2026, 10, 21, 13),
              problem: "it didn't answer",
            }
          : link,
      );
      return HttpResponse.json(links.find((link) => link.id === params.id));
    }),
    http.delete("/api/admin/links/:id", ({ params }) => {
      sent.push({ method: "DELETE", path: `/admin/links/${params.id}` });
      links = links.filter((link) => link.id !== params.id);
      return HttpResponse.json({ name: "Alex's library", told });
    }),
  );
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

    // Authentik is folded on a server that doesn't use it yet.

    await userEvent.click(await screen.findByRole("heading", { name: "Authentik" }));

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

  it("folds each section under its heading, and Authentik starts folded when unused", async () => {
    serve(settingsOf("false"));
    mount("/admin");

    const signIn = await screen.findByText("How people sign in");
    expect(signIn).toBeVisible();
    expect(screen.getByLabelText("Issuer")).not.toBeVisible();

    await userEvent.click(screen.getByRole("heading", { name: "Authentik" }));
    expect(screen.getByLabelText("Issuer")).toBeVisible();
    await userEvent.click(screen.getByRole("heading", { name: "Sign-in" }));
    expect(signIn).not.toBeVisible();
    await userEvent.click(screen.getByRole("heading", { name: "Collections" }));
    expect(screen.queryByText(/Writing collections is off/)).not.toBeVisible();
  });

  it("lists linked servers, invites one, and links to another with its code", async () => {
    const sent = serve(settingsOf("false"));
    serveLinks(sent);
    mount("/admin");

    const list = await screen.findByRole("list", { name: "Linked servers" });
    expect(within(list).getByText("Alex's library")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Make a link code" }));
    expect(await screen.findByLabelText("Link code")).toHaveValue("http://localhost:3000#secret");

    const code = screen.getByLabelText(/Paste the link code the other server's admin made/);
    await userEvent.type(code, "https://old.test#used");
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(await screen.findByText(/used, expired, or mistyped/)).toBeInTheDocument();

    await userEvent.clear(code);
    await userEvent.type(code, "https://sam.test#fresh");
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(
      await screen.findByText(/Linked to Sam's library\. Its recommendations will show/),
    ).toBeInTheDocument();
    expect(await within(list).findByText("Sam's library")).toBeInTheDocument();
    expect(code).toHaveValue("");
    expect(sent).toEqual([
      { method: "POST", path: "/admin/links/invite" },
      { method: "POST", path: "/admin/links", body: { code: "https://old.test#used" } },
      { method: "POST", path: "/admin/links", body: { code: "https://sam.test#fresh" } },
    ]);
  });

  it("unlinks only after a second press, and says when the other server wasn't told", async () => {
    const sent = serve(settingsOf("false"));
    serveLinks(sent, false);
    mount("/admin");

    const list = await screen.findByRole("list", { name: "Linked servers" });
    await userEvent.click(within(list).getByRole("button", { name: "Unlink" }));
    expect(sent).toEqual([]);
    await userEvent.click(within(list).getByRole("button", { name: "Unlink Alex's library" }));

    expect(await screen.findByText(/it didn't answer/)).toBeInTheDocument();
    expect(await screen.findByText("No servers are linked yet.")).toBeInTheDocument();
    expect(sent).toEqual([{ method: "DELETE", path: "/admin/links/l-1" }]);
  });

  it("waits for this server's name before linking", async () => {
    const settings = settingsOf("false");
    const sent = serve({ ...settings, serverName: { value: null, source: "unset" } });
    serveLinks(sent);
    mount("/admin");

    expect(await screen.findByText(/Give this server a name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make a link code" })).toBeDisabled();
    expect(screen.getByLabelText("This server's name")).toHaveValue("");

    // Naming it makes linking possible at once, without a reload, and the name stays in the box.
    await userEvent.type(screen.getByLabelText("This server's name"), "The family library");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Make a link code" })).toBeEnabled();
    expect(screen.getByLabelText("This server's name")).toHaveValue("The family library");
    expect(sent).toContainEqual({
      method: "PUT",
      path: "/admin/settings",
      body: { serverName: "The family library" },
    });
  });

  it("fetches a linked server now, and says how many books matched or why it failed", async () => {
    const sent = serve(settingsOf("false"));
    serveLinks(sent);
    mount("/admin");

    const list = await screen.findByRole("list", { name: "Linked servers" });
    expect(within(list).getByText(/Not fetched yet/)).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Refresh now" }));

    expect(
      await within(list).findByText(/2 of 3 recommendations are books here/),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Not answering since .*: it didn't answer/)).toBeInTheDocument();
    expect(sent).toEqual([{ method: "POST", path: "/admin/links/l-1/refresh" }]);
  });
});
