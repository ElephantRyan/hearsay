import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRateItem, useRemoveRating } from "../../api/hooks";
import { NoteField } from "../../components/domain/NoteField";
import { RecommendToggle } from "../../components/domain/RecommendToggle";
import { ScoreSlider } from "../../components/domain/ScoreSlider";
import { messageFor } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { hasSomething, type RatingForm, ratingSchema } from "../../lib/ratings";

interface Props {
  itemId: string;
  /** The viewer's existing rating, if any; the form edits it. A recommendation may have no score. */
  existing?:
    | { score?: number | null; note: string; recommended: boolean; noteShared: boolean }
    | undefined;
  onDone?: () => void;
}

/** Rate, change or remove my rating of one book. */
export function RatingFormPanel({ itemId, existing, onDone }: Props) {
  const rate = useRateItem();
  const remove = useRemoveRating();
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RatingForm>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      score: existing?.score ?? undefined,
      note: existing?.note ?? "",
      recommended: existing?.recommended ?? false,
      noteShared: existing?.noteShared ?? false,
    },
  });
  const note = watch("note");
  const score = watch("score");
  const recommended = watch("recommended");

  const submit = handleSubmit((values) =>
    rate.mutate(
      { itemId, ...values, score: values.score ?? null },
      { onSuccess: () => onDone?.() },
    ),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Controller
          control={control}
          name="score"
          render={({ field }) => (
            <ScoreSlider
              // the watched value: a cleared field reads back as its default otherwise
              value={score}
              onChange={field.onChange}
            />
          )}
        />
        {score !== undefined && (
          <div className="mt-1 text-center">
            <Button variant="ghost" onClick={() => setValue("score", undefined)}>
              Clear score
            </Button>
          </div>
        )}
        {score === undefined && recommended && (
          <p className="mt-1 text-center text-sm text-muted">No score: recommended without one.</p>
        )}
      </div>

      <div className="space-y-2">
        <NoteField {...register("note")} value={note} error={errors.note?.message} />
        {recommended && note.trim() !== "" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              {...register("noteShared")}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>
              Share my note with everyone
              <span className="block text-xs text-muted">
                Off: everyone sees your score and recommendation, but the note is yours alone.
              </span>
            </span>
          </label>
        )}
      </div>

      <Controller
        control={control}
        name="recommended"
        render={({ field }) => <RecommendToggle checked={field.value} onChange={field.onChange} />}
      />

      {(rate.isError || remove.isError) && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(rate.error ?? remove.error)}
        </p>
      )}

      <div className="flex gap-3">
        {/* Nothing to save until there's a score, a recommendation, or a note. */}
        <Button
          type="submit"
          className="flex-1"
          disabled={rate.isPending || !hasSomething({ score, recommended, note })}
        >
          {rate.isPending ? "Saving…" : existing ? "Update rating" : "Save rating"}
        </Button>
        {existing && (
          <Button
            variant="secondary"
            disabled={remove.isPending}
            onClick={() => remove.mutate(itemId, { onSuccess: () => onDone?.() })}
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
