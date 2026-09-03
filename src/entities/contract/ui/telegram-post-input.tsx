import { useTranslations } from "next-intl";
import type { ContractFormState } from "../model/form";

type Props = {
  form: ContractFormState;
  updateFormField: <T extends keyof ContractFormState>(field: T, value: ContractFormState[T]) => void;
  handleFetchPreview: () => void;
  isPending: boolean;
  canFetchPreview: boolean;
  description: string;
};

export function TelegramPostInput({
  form,
  updateFormField,
  handleFetchPreview,
  isPending,
  canFetchPreview,
  description,
}: Props) {
  const t = useTranslations("CreateContract");

  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-zinc-900">
        {t("TelegramPostUrl")}
        <div className="flex gap-2">
          <input
            value={form.telegramPostUrl}
            onChange={(event) => updateFormField("telegramPostUrl", event.target.value)}
            placeholder="https://t.me/channel_name/123"
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
          />
          <button
            type="button"
            onClick={handleFetchPreview}
            disabled={isPending || !canFetchPreview}
            className="shrink-0 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isPending ? t("Loading") : t("FetchFromPost")}
          </button>
        </div>
        <span className="text-sm font-normal leading-6 text-zinc-500">{description}</span>
      </label>

      {/* Scouting mode fields (optional based on isScouting presence in form context or we handle it in Create Form) */}
      <label className="flex items-center gap-3 text-sm font-medium text-zinc-900 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={form.isScouting}
          onChange={(event) => updateFormField("isScouting", event.target.checked)}
          className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        {t("IsScouting")}
      </label>

      {form.isScouting ? (
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("ScoutedUsername")}
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              @
            </span>
            <input
              value={form.scoutedTelegramUsername?.replace(/^@/, "") || ""}
              onChange={(event) => updateFormField("scoutedTelegramUsername", event.target.value.trim())}
              placeholder="username"
              className="w-full rounded-2xl border border-zinc-200 py-3 pl-8 pr-4 text-sm outline-none transition focus:border-zinc-900"
            />
          </div>
        </label>
      ) : null}
    </div>
  );
}
