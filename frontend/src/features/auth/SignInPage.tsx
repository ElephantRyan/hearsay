import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import { usePasswordSignIn, useSetupState, useSignInModes } from "../../api/hooks";
import { ErrorState, LoadingState } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { safeRedirect } from "../../lib/safeRedirect";

const credentials = z.object({
  username: z.string().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});
type Credentials = z.infer<typeof credentials>;

/** What each ?error= code from the Authentik callback means to a person. */
const callbackErrors: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  state: "That sign-in didn't start here, or took too long. Please try again.",
  missing: "Authentik didn't send a sign-in code. Please try again.",
  "no-account":
    "Authentik knows you, but Audiobookshelf has no account with your email. Sign in to Audiobookshelf once first, then come back.",
  refused: "Authentik didn't accept that sign-in.",
  unavailable: "Authentik or Audiobookshelf is unreachable right now. Try again in a moment.",
  disabled: "Sign-in with Authentik is turned off on this server.",
  method: "That sign-in method isn't available here.",
};

export function SignInPage() {
  const { redirect, error } = useSearch({ from: "/sign-in" });
  const navigate = useNavigate();
  const modes = useSignInModes();
  const setup = useSetupState();
  const signIn = usePasswordSignIn();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({ resolver: zodResolver(credentials) });

  const onSubmit = handleSubmit((values) =>
    signIn.mutate(values, {
      onSuccess: () => navigate({ to: safeRedirect(redirect) }),
    }),
  );

  const failure =
    signIn.error instanceof ApiError && signIn.error.status === 403
      ? "That username or password wasn't right."
      : signIn.error
        ? "Couldn't reach the server to sign you in. Try again in a moment."
        : undefined;

  // A new server can't sign anyone in until it knows its Audiobookshelf.
  if (setup.data?.needed) return <Navigate to="/setup" replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">Hearsay</h1>
        <p className="mt-1 text-sm text-muted">
          Rate books and see what everyone on this server loves.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-surface p-3 text-sm">
          {callbackErrors[error] ?? "Sign-in didn't work. Please try again."}
        </p>
      )}

      {modes.isPending && <LoadingState rows={1} label="Loading sign-in options" />}
      {modes.isError && <ErrorState error={modes.error} onRetry={() => modes.refetch()} />}

      {modes.data?.oidc && (
        // A full-page navigation: the server redirects to Authentik and back.
        <a
          href="/api/auth/login"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text no-underline hover:opacity-90"
        >
          <KeyRound aria-hidden="true" className="h-4 w-4" />
          Sign in with Authentik
        </a>
      )}

      {modes.data?.oidc && modes.data.password && (
        <p aria-hidden="true" className="text-center text-xs uppercase tracking-wide text-muted">
          or
        </p>
      )}

      {modes.data?.password && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Audiobookshelf username
            </label>
            <input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
              aria-invalid={errors.username ? "true" : undefined}
              {...register("username")}
            />
            {errors.username && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
              aria-invalid={errors.password ? "true" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.password.message}
              </p>
            )}
          </div>
          {failure && (
            <p role="alert" className="text-sm text-danger">
              {failure}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </main>
  );
}
