"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  contractQuestionsClient,
  type ContractQuestionDto,
} from "@/entities/contract-question";

import { ContractQuestionsPanelView } from "./contract-questions-panel-view";

type Props = {
  slug: string;
  authorId: number;
  viewerId?: number | null;
  isViewerLoading?: boolean;
  questions: ContractQuestionDto[];
  onAuthRequired?: () => void;
  compact?: boolean;
};

export function ContractQuestionsPanel({
  slug,
  authorId,
  viewerId,
  isViewerLoading = false,
  questions,
  onAuthRequired,
  compact = false,
}: Props) {
  const t = useTranslations("ContractQuestions");
  const [question, setQuestion] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isAuthor = viewerId === authorId;

  const mutation = useMutation({
    mutationFn: () => contractQuestionsClient.ask(slug, question),
    onSuccess: () => {
      setQuestion("");
      setSuccessMessage(t("Sent"));
    },
    onError: () => setSuccessMessage(""),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage("");

    if (!viewerId) {
      onAuthRequired?.();
      return;
    }

    if (!isAuthor && question.trim().length >= 5) {
      mutation.mutate();
    }
  };

  return (
    <ContractQuestionsPanelView
      isAuthor={isAuthor}
      isAuthenticated={Boolean(viewerId)}
      isViewerLoading={isViewerLoading}
      questions={questions}
      question={question}
      successMessage={successMessage}
      errorMessage={
        mutation.isError ? t("Error") : undefined
      }
      isPending={mutation.isPending}
      compact={compact}
      onQuestionChange={(value) => {
        setQuestion(value);
        setSuccessMessage("");
      }}
      onSubmit={handleSubmit}
    />
  );
}
