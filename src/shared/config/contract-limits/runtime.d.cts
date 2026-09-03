export type ContractPublishingLimits = {
  maxNormalContracts: number;
  maxScoutedContracts: number;
};

export const CONTRACT_LIMITS: Readonly<{
  free: Readonly<{
    maxNormalContracts: 1;
    maxScoutedContracts: 10;
  }>;
  plus: Readonly<{
    maxNormalContracts: 5;
    maxScoutedContracts: 50;
  }>;
}>;

export function getContractLimits(isPremium: boolean): ContractPublishingLimits;
