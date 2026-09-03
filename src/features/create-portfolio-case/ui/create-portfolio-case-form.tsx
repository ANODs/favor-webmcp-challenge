import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { contractsClient } from "@/entities/contract";
import {
  portfolioClient,
  type CreatePortfolioCasePayload,
} from "@/entities/portfolio-case";
import { sessionQueryKeys } from "@/entities/session";
import { userQueryKeys } from "@/entities/user";
import { Button } from "@/shared/ui";
import { SurfaceCard } from "@/shared/ui/surface-card";
import { actionCardFieldClassName } from "@/shared/ui/action-card";
import { Trash2 } from "lucide-react";

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<CreatePortfolioCasePayload>;
};

export function CreatePortfolioCaseForm({ onSuccess, onCancel, initialData }: Props) {
  const t = useTranslations("PortfolioCaseForm");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [telegramPostUrl, setTelegramPostUrl] = useState(initialData?.telegramPostUrl || "");
  const [links, setLinks] = useState<{ url: string; label: string }[]>(
    initialData?.links?.map((l) => ({ url: l.url, label: l.label || "" })) || []
  );
  const [contractId] = useState(initialData?.contractId || null);
  const [errorMessage, setErrorMessage] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: CreatePortfolioCasePayload) => portfolioClient.createCase(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.currentUser });
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.profiles });
      await queryClient.invalidateQueries({
        queryKey: userQueryKeys.profileSections,
      });
      onSuccess();
    },
    onError: () => {
      setErrorMessage(t("CreateError"));
    },
  });

  const previewMutation = useMutation({
    mutationFn: (url: string) => contractsClient.previewTelegramPost(url),
    onSuccess: (preview) => {
      if (preview.telegramPostUrl && preview.telegramPostUrl !== telegramPostUrl.trim()) {
        setTelegramPostUrl(preview.telegramPostUrl);
      }
    },
    onError: () => {
      // Ignore preview errors silently for portfolio
    },
  });

  const handleAddLink = () => {
    if (links.length >= 10) return;
    setLinks([...links, { url: "", label: "" }]);
  };

  const handleLinkChange = (index: number, field: "url" | "label", value: string) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage(t("TitleRequired"));
      return;
    }
    
    const validLinks = links
      .filter((l) => l.url.trim())
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() || undefined }));

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      telegramPostUrl: telegramPostUrl.trim() || null,
      links: validLinks.length > 0 ? validLinks : null,
      contractId,
    });
  };

  return (
    <SurfaceCard className="max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-semibold text-zinc-950 mb-6">
        {t("Title")}
      </h2>
      
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6">
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TitleLabel")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("TitlePlaceholder")}
            className={actionCardFieldClassName}
            required
            maxLength={255}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("DescriptionLabel")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("DescriptionPlaceholder")}
            className={actionCardFieldClassName}
            rows={4}
            maxLength={2000}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TelegramPostLabel")}
          <div className="flex gap-2">
            <input
              value={telegramPostUrl}
              onChange={(e) => setTelegramPostUrl(e.target.value)}
              placeholder="https://t.me/channel_name/123"
              className={actionCardFieldClassName}
            />
            <Button
              type="button"
              onClick={() => {
                if (telegramPostUrl.trim()) previewMutation.mutate(telegramPostUrl.trim());
              }}
              disabled={!telegramPostUrl.trim() || previewMutation.isPending}
              loading={previewMutation.isPending}
              variant="primary"
              shape="rounded-2xl"
              size="md"
              className="shrink-0"
            >
              {t("CheckPost")}
            </Button>
          </div>
        </label>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-900">
              {t("LinksLabel")}
            </label>
            {links.length < 10 && (
              <Button
                type="button"
                onClick={handleAddLink}
                variant="ghost"
                size="sm"
                shape="rounded-xl"
                className="text-zinc-900 hover:text-zinc-600"
              >
                {t("AddLink")}
              </Button>
            )}
          </div>
          
          {links.map((link, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="grid gap-2 flex-1">
                <input
                  value={link.url}
                  onChange={(e) => handleLinkChange(index, "url", e.target.value)}
                  placeholder="https://example.com"
                  className={actionCardFieldClassName}
                  type="url"
                />
                <input
                  value={link.label}
                  onChange={(e) => handleLinkChange(index, "label", e.target.value)}
                  placeholder={t("LinkLabelPlaceholder")}
                  className={actionCardFieldClassName}
                  maxLength={100}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveLink(index)}
                className="p-3 text-zinc-400 hover:text-red-500 transition mt-1"
                aria-label={t("RemoveLink")}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        {contractId && (
          <div className="text-sm text-zinc-500">
            {t("LinkedContract", { id: contractId })}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            onClick={onCancel}
            disabled={createMutation.isPending}
            variant="secondary"
            shape="rounded-2xl"
            size="md"
          >
            {t("Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            loading={createMutation.isPending}
            variant="primary"
            shape="rounded-2xl"
            size="md"
          >
            {t("Save")}
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}
