import { beginCell, toNano } from "@ton/ton";
import { safeParseAddress } from "./address";

export const FAVOR_JETTON_TRANSFER_GAS_NANO = "70000000";

/**
 * Builds the binary payload for a standard Jetton transfer transaction.
 * This payload is serialized as Base64 BOC and sent via TonConnect.
 * 
 * Jetton Transfer Message Schema:
 * transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
 *                     response_destination:MsgAddress custom_payload:(Maybe ^Cell)
 *                     forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
 */
export function buildJettonTransferPayload({
  amount,
  recipientAddress,
  responseAddress,
  reference,
  forwardTonAmount = "0.05",
}: {
  amount: bigint;
  recipientAddress: string;
  responseAddress: string;
  reference: string;
  forwardTonAmount?: string;
}): string {
  const destAddr = safeParseAddress(recipientAddress);
  const respAddr = safeParseAddress(responseAddress);

  // Build the forward_payload containing the text comment reference
  const forwardPayload = beginCell()
    .storeUint(0, 32) // opcode 0 means simple text comment
    .storeStringTail(reference)
    .endCell();

  // Build the main Jetton transfer message cell
  const transferCell = beginCell()
    .storeUint(0xf8a7ea5, 32) // op::transfer opcode
    .storeUint(0, 64)        // query_id
    .storeCoins(amount)       // raw jetton amount using the token's decimals
    .storeAddress(destAddr)   // recipient main wallet address
    .storeAddress(respAddr)   // response_destination to return excess gas (user wallet)
    .storeBit(0)              // custom_payload is null
    .storeCoins(toNano(forwardTonAmount)) // forward_ton_amount (TON forwarded with notification)
    .storeBit(1)              // forward_payload as a ref cell
    .storeRef(forwardPayload)
    .endCell();

  return transferCell.toBoc().toString("base64");
}
