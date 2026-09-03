"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ContractDto } from "@/entities/contract";
import {
  ContractFormFields,
  ContractImagesPreview,
  TelegramPostButtonControl,
  TelegramPostInput,
} from "@/entities/contract/ui";
import {
  ActionCard,
  ActionCardButton,
  Button,
  ConfirmationDialog,
} from "@/shared/ui";

import { useEditContractForm } from "../lib/use-edit-contract-form";

type Props = {
  contract: ContractDto;
  botUsername: string;
  draftOwnerId: number;
};

export function EditContractForm({ contract, botUsername, draftOwnerId }: Props) {
  return (
    <EditContractFormInner
      key={`${draftOwnerId}-${contract.id}-${contract.updatedAt}`}
      contract={contract}
      botUsername={botUsername}
      draftOwnerId={draftOwnerId}
    />
  );
}

function EditContractFormInner({ contract, botUsername, draftOwnerId }: Props) {
  const t = useTranslations("EditContract");
  const [isSaveConfirmationOpen, setIsSaveConfirmationOpen] = useState(false);
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] =
    useState(false);
  const {
    form,
    preview,
    titleValidation,
    submitError,
    submitSuccess,
    hasHydrated,
    draftPersistenceError,
    wasRestored,
    hasRevisionConflict,
    moderationResult,
    updateMutation,
    previewMutation,
    selectedImagesCount,
    getFieldError,
    updateFormField,
    handleFetchPreview,
    prepareSubmit,
    submitChanges,
    toggleImage,
    setPrimaryImage,
    acceptLatestRevision,
    discardDraft,
  } = useEditContractForm(contract, draftOwnerId);

  if (!hasHydrated) {
    return (
      <section
        className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-zinc-600 shadow-sm"
        aria-busy="true"
      >
        {t("draft_restoring")}
      </section>
    );
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          if (prepareSubmit(event)) {
            setIsSaveConfirmationOpen(true);
          }
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">{t("tg_post_title")}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {t("tg_post_desc1")}
                {t("tg_post_desc2")}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold text-zinc-950">{t("why_convenient")}</h3>
            <div className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">
              <p>{t("why_1")}</p>
              <p>{t("why_2")}</p>
              <p>{t("why_3")}</p>
            </div>
          </div>

          <div className="mt-6">
            <TelegramPostInput
              form={form}
              updateFormField={updateFormField}
              handleFetchPreview={handleFetchPreview}
              isPending={previewMutation.isPending}
              canFetchPreview={form.telegramPostUrl.trim().length > 0}
              description={t("refetch_button_desc")}
            />

            {form.telegramPostUrl.trim() ? (
              <TelegramPostButtonControl
                key={`${contract.slug}-${form.telegramPostUrl.trim()}`}
                variant="edit"
                botUsername={botUsername}
                slug={contract.slug}
                isPostLinkSaved={
                  form.telegramPostUrl.trim() ===
                  (contract.telegramPostUrl?.trim() ?? "")
                }
                className="mt-5"
              />
            ) : null}

            <ContractFormFields
              form={form}
              updateFormField={updateFormField}
              getFieldError={getFieldError}
              descriptionPlaceholder={t("desc_placeholder")}
            />
          </div>

          {preview ? (
            <ContractImagesPreview
              preview={preview}
              selectedMediaRefs={form.mediaRefs}
              toggleImage={toggleImage}
              setPrimaryImage={setPrimaryImage}
              selectedImagesCount={selectedImagesCount}
              description={t("images_desc")}
            />
          ) : null}
        </section>

        <aside className="flex flex-col gap-4">
          <p className="px-1 text-xs text-zinc-500" role="status">
            {draftPersistenceError
              ? t("draft_autosave_unavailable")
              : wasRestored
                ? t("draft_restored")
                : t("draft_autosave")}
          </p>

          {hasRevisionConflict ? (
            <section
              className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              role="alert"
            >
              <h3 className="font-semibold">{t("draft_conflict_title")}</h3>
              <p className="mt-2 leading-6">
                {t("draft_conflict_description")}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={acceptLatestRevision}
                >
                  {t("draft_conflict_keep")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  fullWidth
                  onClick={() => setIsDiscardConfirmationOpen(true)}
                >
                  {t("draft_conflict_discard")}
                </Button>
              </div>
            </section>
          ) : null}

          {titleValidation ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {titleValidation}
            </section>
          ) : null}

          {submitError ? (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {submitError}
            </section>
          ) : null}

          {moderationResult.isBlocked ? (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p>{moderationResult.summary}</p>
            </section>
          ) : null}

          {submitSuccess ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {submitSuccess}
            </section>
          ) : null}

          <ActionCard
            title={t("saving_title")}
            description={
              <>
                {t("saving_desc1")}
                {t("saving_desc2")}
                {t("saving_desc3")}
              </>
            }
          >
            <ActionCardButton
              type="submit"
              disabled={
                updateMutation.isPending ||
                previewMutation.isPending ||
                moderationResult.isBlocked ||
                hasRevisionConflict
              }
              className="mt-auto"
            >
              {updateMutation.isPending ? t("saving_btn") : t("save_btn")}
            </ActionCardButton>
          </ActionCard>
        </aside>
      </form>

      <ConfirmationDialog
        isOpen={isSaveConfirmationOpen}
        onClose={() => setIsSaveConfirmationOpen(false)}
        onConfirm={async () => {
          await submitChanges();
          setIsSaveConfirmationOpen(false);
        }}
        description={t("save_confirmation")}
        confirmLabel={t("confirm_save_btn")}
        pendingLabel={t("saving_btn")}
        isPending={updateMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={isDiscardConfirmationOpen}
        onClose={() => setIsDiscardConfirmationOpen(false)}
        onConfirm={() => {
          discardDraft();
          setIsDiscardConfirmationOpen(false);
        }}
        description={t("draft_conflict_discard_confirmation")}
        confirmLabel={t("draft_conflict_discard_confirm")}
        confirmVariant="danger"
      />
    </>
  );
}
