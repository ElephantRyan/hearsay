import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRateItem, useRemoveRating } from "../../api/hooks";
import { NoteField } from "../../components/domain/NoteField";
import { RatingInput } from "../../components/domain/RatingInput";
import { RecommendToggle } from "../../components/domain/RecommendToggle";
import { messageFor } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { type RatingForm, ratingSchema } from "../../lib/ratings";

interface Props {
  itemId: string;
  /** The viewer's existing rating, if any; the form edits it. A recommendation may have no score. */
  existing?: { score?: number | null; note: string; recommended: boolean } | undefined;
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
            <RatingInput
              value={field.value}
              onChange={field.onChange}
              invalid={errors.score !== undefined}
            />
          )}
        />
        {score !== undefined && recommended && (
          <Button
            variant="ghost"
            className="mt-1"
            onClick={() => setValue("score", undefined, { shouldValidate: true })}
          >
            Clear score
          </Button>
        )}
        {score === undefined && recommended && (
          <p className="mt-1 text-sm text-muted">No score: recommended without one.</p>
        )}
        {errors.score && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {errors.score.message}
          </p>
        )}
      </div>

      <NoteField {...register("note")} value={note} error={errors.note?.message} />

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
        <Button type="submit" className="flex-1" disabled={rate.isPending}>
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
