"use strict";

const CONTRACT_LIMITS = Object.freeze({
  free: Object.freeze({
    maxNormalContracts: 1,
    maxScoutedContracts: 10,
  }),
  plus: Object.freeze({
    maxNormalContracts: 5,
    maxScoutedContracts: 50,
  }),
});

function getContractLimits(isPremium) {
  const limits = isPremium ? CONTRACT_LIMITS.plus : CONTRACT_LIMITS.free;

  return { ...limits };
}

module.exports = {
  CONTRACT_LIMITS,
  getContractLimits,
};
