/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {
  getContractLimits,
} = require("../../../shared/config/contract-limits/runtime.cjs");

const freeContractLimits = getContractLimits(false);
const plusContractLimits = getContractLimits(true);

const SUBSCRIPTION_BENEFITS = Object.freeze([
  Object.freeze({
    id: "active_contracts",
    free: freeContractLimits.maxNormalContracts,
    plus: plusContractLimits.maxNormalContracts,
  }),
  Object.freeze({
    id: "scout_contracts",
    free: freeContractLimits.maxScoutedContracts,
    plus: plusContractLimits.maxScoutedContracts,
  }),
  Object.freeze({ id: "contact_views", free: "limited", plus: "unlimited" }),
  Object.freeze({ id: "feed_priority", free: false, plus: true }),
  Object.freeze({ id: "og_previews", free: false, plus: true }),
]);

module.exports = {
  SUBSCRIPTION_BENEFITS,
};
