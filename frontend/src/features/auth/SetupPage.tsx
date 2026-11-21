import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import { useRunSetup, useSetupState } from "../../api/hooks";
import { ErrorState, LoadingState } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";

const setupForm = z.object({
  absUrl: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/, "Enter the full address, starting with https:// or http://."),
  username: z.string().min(1, "Enter an Audiobookshelf admin's username."),
  password: z.string().min(1, "Enter the password."),
});
type SetupForm = z.infer<typeof setupForm>;

/** The server's words for a refused setup, made to read as a sentence. */
function failureOf(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Couldn't reach this app's server. Try again in a moment.";
  }
  const text = error.message.replace(/^absUrl /, "The Audiobookshelf address ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * The first run of a new server: where Audiobookshelf is, and an Audiobookshelf admin's login
 * to prove the person setting it up runs that server. They land on the admin screen, signed in,
 * to finish the rest. Once a server knows its Audiobookshelf, this page only points to sign-in.
 */
export function SetupPage() {
  const setup = useSetupState();
  const run = useRunSetup();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupForm>({ resolver: zodResolver(setupForm) });

  const onSubmit = handleSubmit((values) =>
    run.mutate(values, { onSuccess: () => navigate({ to: "/admin" }) }),
  );

  if (setup.isPending) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <LoadingState rows={1} label="Checking this server" />
      </main>
    );
  }
  if (setup.isError) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <ErrorState error={setup.error} onRetry={() => setup.refetch()} />
      </main>
    );
  }
  if (!setup.data.needed && !run.isSuccess) return <Navigate to="/sign-in" search={{}} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">Set up Hearsay</h1>
        <p className="mt-1 text-sm text-muted">
          Connect this app to your Audiobookshelf server. Sign in with an Audiobookshelf admin
          account; you'll finish the rest on the settings page.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="absUrl"
          label="Audiobookshelf address"
          error={errors.absUrl?.message}
          input={
            <input
              id="absUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://audiobooks.example.com"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
              aria-invalid={errors.absUrl ? "true" : undefined}
              {...register("absUrl")}
            />
          }
        />
        <Field
          id="username"
          label="Admin username"
          error={errors.username?.message}
          input={
            <input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
              aria-invalid={errors.username ? "true" : undefined}
              {...register("username")}
            />
          }
        />
        <Field
          id="password"
          label="Password"
          error={errors.password?.message}
          input={
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
              aria-invalid={errors.password ? "true" : undefined}
              {...register("password")}
            />
          }
        />
        {run.isError && (
          <p role="alert" className="text-sm text-danger">
            {failureOf(run.error)}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={run.isPending}>
          {run.isPending ? "Connecting…" : "Connect"}
        </Button>
      </form>
    </main>
  );
}

function Field({
  id,
  label,
  error,
  input,
}: {
  id: string;
  label: string;
  error: string | undefined;
  input: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {input}
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
