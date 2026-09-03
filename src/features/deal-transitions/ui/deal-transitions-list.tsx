"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { dealTransitionLabels } from "@/entities/deal";
import type { DealDto } from "@/entities/deal";
import { Button, ResponsiveSelect } from "@/shared/ui";

type DealTransitionMutation = {
  mutate: (status: DealDto["status"]) => void;
  isPending: boolean;
  variables?: string;
};

type Props = {
  availableTransitions: DealDto["status"][];
  transitionMutation: DealTransitionMutation;
};

export function DealTransitionsList({ availableTransitions, transitionMutation }: Props) {
  const tActions = useTranslations("DealActions");
  const tStatus = useTranslations("DealStatuses");
  const [selectedTransitionDraft, setSelectedTransitionDraft] = useState<DealDto["status"] | "">("");
  const selectedTransition = availableTransitions.includes(
    selectedTransitionDraft as DealDto["status"],
  )
    ? selectedTransitionDraft
    : (availableTransitions[0] ?? "");
  const options = availableTransitions.map((status) => ({
    value: status,
    label: tStatus(dealTransitionLabels[status].labelKey),
  }));

  if (!selectedTransition) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <ResponsiveSelect
        value={selectedTransition}
        onChange={setSelectedTransitionDraft}
        options={options}
        ariaLabel={tActions("select_action")}
      />
      <Button
        onClick={() => transitionMutation.mutate(selectedTransition)}
        loading={
          transitionMutation.isPending && transitionMutation.variables === selectedTransition
        }
        disabled={
          transitionMutation.isPending && transitionMutation.variables !== selectedTransition
        }
        variant="primary"
        shape="rounded-2xl"
        size="md"
        fullWidth
      >
        {tStatus(dealTransitionLabels[selectedTransition].labelKey)}
      </Button>
    </div>
  );
}
