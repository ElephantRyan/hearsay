import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useResetSetting, useSaveSettings } from "../../api/hooks";
import type {
  AdminSettings,
  AuthMode,
  SettingName,
  SettingsChange,
  SettingValue,
} from "../../api/types";
import { messageFor } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { Collapsible } from "../../components/ui/Collapsible";

type TextName =
  | "absUrl"
  | "frontendUrl"
  | "oidcIssuer"
  | "oidcClientId"
  | "oidcRedirectUri"
  | "serverName";
type SecretName = "serviceToken" | "oidcClientSecret";

const textNames: TextName[] = [
  "absUrl",
  "frontendUrl",
  "oidcIssuer",
  "oidcClientId",
  "oidcRedirectUri",
  "serverName",
];
const secretNames: SecretName[] = ["serviceToken", "oidcClientSecret"];

const modes = [
  { value: "abs", label: "Audiobookshelf username and password" },
  { value: "both", label: "Both" },
  { value: "oidc", label: "Authentik only" },
] as const;

function textsOf(settings: AdminSettings): Record<TextName, string> {
  return Object.fromEntries(textNames.map((name) => [name, settings[name].value ?? ""])) as Record<
    TextName,
    string
  >;
}

const noSecrets: Record<SecretName, string> = { serviceToken: "", oidcClientSecret: "" };

/**
 * Every setting an admin can change. Saves only what changed; secrets are never shown, so
 * their boxes start empty and an empty box keeps what is saved.
 */
export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const save = useSaveSettings();
  const [texts, setTexts] = useState(() => textsOf(settings));
  const [secrets, setSecrets] = useState(noSecrets);
  const [mirror, setMirror] = useState(settings.mirrorEnabled.value === "true");
  const [topSeries, setTopSeries] = useState(settings.topSeries.value === "true");
  const [topStandalones, setTopStandalones] = useState(settings.topStandalones.value === "true");
  const [mode, setMode] = useState(settings.authMode.value ?? "both");
  const [notice, setNotice] = useState<string | null>(null);
  // Authentik starts folded on a server that doesn't use it.
  const authentikInUse =
    settings.authMode.value !== "abs" || settings.oidcIssuer.source !== "unset";

  const setText = (name: TextName) => (value: string) =>
    setTexts((current) => ({ ...current, [name]: value }));
  const setSecret = (name: SecretName) => (value: string) =>
    setSecrets((current) => ({ ...current, [name]: value }));

  function changes(): SettingsChange {
    const change: SettingsChange = {};
    for (const name of textNames) {
      if (texts[name].trim() !== (settings[name].value ?? "")) change[name] = texts[name];
    }
    for (const name of secretNames) {
      if (secrets[name].trim() !== "") change[name] = secrets[name];
    }
    if (mirror !== (settings.mirrorEnabled.value === "true")) change.mirrorEnabled = mirror;
    if (topSeries !== (settings.topSeries.value === "true")) change.topSeries = topSeries;
    if (topStandalones !== (settings.topStandalones.value === "true"))
      change.topStandalones = topStandalones;
    if (mode !== settings.authMode.value) change.authMode = mode as AuthMode;
    return change;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const change = changes();
    if (Object.keys(change).length === 0) {
      setNotice("Nothing has changed.");
      return;
    }
    setNotice(null);
    save.mutate(change, {
      onSuccess: (saved) => {
        setTexts(textsOf(saved));
        setSecrets(noSecrets);
        setNotice("Saved.");
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="divide-y divide-border border-y border-border">
        <Section title="Audiobookshelf">
          <fieldset className="space-y-5" aria-label="Audiobookshelf">
            <TextField
              label="Audiobookshelf address"
              type="url"
              placeholder="https://audiobooks.example.com"
              value={texts.absUrl}
              onChange={setText("absUrl")}
              footer={<Source name="absUrl" setting={settings.absUrl} variable="ABS_URL" />}
            />
            <TextField
              label="Audiobookshelf token"
              secret
              placeholder={
                settings.serviceToken.source === "unset"
                  ? "Paste a token"
                  : "Leave empty to keep it"
              }
              value={secrets.serviceToken}
              onChange={setSecret("serviceToken")}
              hint="An API token of an Audiobookshelf admin account. The app uses it to look up books, read listening progress, and write collections. It is never shown again once saved."
              footer={
                <Source
                  name="serviceToken"
                  setting={settings.serviceToken}
                  variable="ABS_SERVICE_TOKEN"
                />
              }
            />
            <MirrorField checked={mirror} onChange={setMirror} setting={settings.mirrorEnabled} />
          </fieldset>
        </Section>

        <Section title="Top collections">
          <fieldset className="space-y-5" aria-label="Top collections">
            <p className="text-sm text-muted">
              Server-wide collections in every library, listed before everyone's own, most
              recommended first (ties to the higher average score). Linked servers' recommendations
              count too.
              {!mirror && " Written only while recommendation collections are."}
            </p>
            <TopField
              label='"Top 10 Series"'
              hint="The series the most people recommend, each as its book 1."
              checked={topSeries}
              onChange={setTopSeries}
              setting={settings.topSeries}
              name="topSeries"
              variable="TOP_SERIES"
            />
            <TopField
              label='"Top 25 Standalones"'
              hint="The books in no series that the most people recommend."
              checked={topStandalones}
              onChange={setTopStandalones}
              setting={settings.topStandalones}
              name="topStandalones"
              variable="TOP_STANDALONES"
            />
          </fieldset>
        </Section>

        <Section title="Sign-in">
          <fieldset className="space-y-5" aria-label="Sign-in">
            <ModeField value={mode} onChange={setMode} setting={settings.authMode} />
            <TextField
              label="This app's address"
              type="url"
              placeholder="https://hearsay.example.com"
              value={texts.frontendUrl}
              onChange={setText("frontendUrl")}
              hint="Where people open this app. Authentik sends them back here after they sign in."
              footer={
                <Source name="frontendUrl" setting={settings.frontendUrl} variable="FRONTEND_URL" />
              }
            />
          </fieldset>
        </Section>

        <Section title="Linked servers">
          <fieldset className="space-y-5" aria-label="Linked servers">
            <TextField
              label="This server's name"
              placeholder="The family library"
              value={texts.serverName}
              onChange={setText("serverName")}
              hint="What the servers linked to this one call it. Linking waits until it has one."
              footer={
                <Source name="serverName" setting={settings.serverName} variable="SERVER_NAME" />
              }
            />
          </fieldset>
        </Section>

        <Section title="Authentik" defaultOpen={authentikInUse}>
          <fieldset className="space-y-5" aria-label="Authentik">
            <p className="text-sm text-muted">
              Only needed for signing in with Authentik. Make an OAuth2/OpenID provider and
              application for this app in Authentik, then copy its details here. Authentik sign-in
              is offered once all four are filled in.
            </p>
            <TextField
              label="Issuer"
              type="url"
              placeholder="https://auth.example.com/application/o/recommends/"
              value={texts.oidcIssuer}
              onChange={setText("oidcIssuer")}
              hint="The application's OpenID Configuration Issuer, from its provider page in Authentik."
              footer={
                <Source name="oidcIssuer" setting={settings.oidcIssuer} variable="OIDC_ISSUER" />
              }
            />
            <TextField
              label="Client ID"
              value={texts.oidcClientId}
              onChange={setText("oidcClientId")}
              footer={
                <Source
                  name="oidcClientId"
                  setting={settings.oidcClientId}
                  variable="OIDC_CLIENT_ID"
                />
              }
            />
            <TextField
              label="Client secret"
              secret
              placeholder={
                settings.oidcClientSecret.source === "unset"
                  ? "Paste the secret"
                  : "Leave empty to keep it"
              }
              value={secrets.oidcClientSecret}
              onChange={setSecret("oidcClientSecret")}
              footer={
                <Source
                  name="oidcClientSecret"
                  setting={settings.oidcClientSecret}
                  variable="OIDC_CLIENT_SECRET"
                />
              }
            />
            <TextField
              label="Redirect URI"
              type="url"
              placeholder="https://hearsay.example.com/api/auth/callback"
              value={texts.oidcRedirectUri}
              onChange={setText("oidcRedirectUri")}
              hint="This app's address followed by /api/auth/callback. Enter the same address in Authentik as the provider's redirect URI."
              footer={
                <Source
                  name="oidcRedirectUri"
                  setting={settings.oidcRedirectUri}
                  variable="OIDC_REDIRECT_URI"
                />
              }
            />
          </fieldset>
        </Section>
      </div>

      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(save.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  secret,
  placeholder,
  hint,
  footer,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
  secret?: boolean;
  placeholder?: string | undefined;
  hint?: string;
  footer?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={secret ? "password" : type}
        inputMode={type === "url" ? "url" : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {footer}
    </div>
  );
}

function ModeField({
  value,
  onChange,
  setting,
}: {
  value: string;
  onChange: (value: string) => void;
  setting: SettingValue;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={`${name}-label`}>
      <p id={`${name}-label`} className="mb-1 text-sm font-medium">
        How people sign in
      </p>
      <div className="space-y-1">
        {modes.map((mode) => (
          <label key={mode.value} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="radio"
              name={name}
              value={mode.value}
              checked={value === mode.value}
              onChange={() => onChange(mode.value)}
              className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
            />
            {mode.label}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">
        Authentik only can be chosen once the Authentik settings below are all filled in. Until
        then, the username and password sign-in stays on.
      </p>
      <Source name="authMode" setting={setting} variable="AUTH_MODE" />
    </div>
  );
}

function MirrorField({
  checked,
  onChange,
  setting,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  setting: SettingValue;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        />
        <label htmlFor={id} className="text-sm">
          <span className="font-medium">Write recommendation collections into Audiobookshelf</span>
          <span className="block text-muted">
            Each person's recommended books become a collection there, brought up to date every
            hour. The app only ever creates, changes and removes its own collections.
          </span>
        </label>
      </div>
      <Source name="mirrorEnabled" setting={setting} variable="MIRROR_ENABLED" />
    </div>
  );
}

/** One server-wide Top collection, on or off; written only while collections are written at all. */
function TopField({
  label,
  hint,
  checked,
  onChange,
  setting,
  name,
  variable,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  setting: SettingValue;
  name: "topSeries" | "topStandalones";
  variable: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        />
        <label htmlFor={id} className="text-sm">
          <span className="font-medium">Add {label}</span>
          <span className="block text-muted">{hint}</span>
        </label>
      </div>
      <Source name={name} setting={setting} variable={variable} />
    </div>
  );
}

/** Where a setting's value comes from, with a way back to the environment's. */
function Source({
  name,
  setting,
  variable,
}: {
  name: SettingName;
  setting: SettingValue;
  variable: string;
}) {
  const reset = useResetSetting();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
      {setting.source === "saved" && (
        <>
          <span>Saved in this app.</span>
          <button
            type="button"
            onClick={() => reset.mutate(name)}
            disabled={reset.isPending}
            className="min-h-11 underline hover:text-text sm:min-h-0"
          >
            Use {variable} instead
          </button>
        </>
      )}
      {setting.source === "environment" && <span>From {variable} on the server.</span>}
      {setting.source === "unset" && <span>Not set.</span>}
      {reset.isError && (
        <span role="alert" className="text-danger">
          {messageFor(reset.error)}
        </span>
      )}
    </div>
  );
}

/** One group of settings: a heading that folds it away, between divider lines. */
function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      title={<h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h3>}
      defaultOpen={defaultOpen}
      className="py-2"
    >
      <div className="pb-4">{children}</div>
    </Collapsible>
  );
}
