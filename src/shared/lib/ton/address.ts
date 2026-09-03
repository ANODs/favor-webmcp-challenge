import { Address } from "@ton/ton";

/**
 * Robustly parses a TON address string.
 * Bypasses mathematically incorrect CRC16 checksums of user-friendly formats
 * (which can occur on certain testnets or custom wallets) by fallback decoding
 * the base64 friendly address and directly instantiating the raw Address object.
 */
export function safeParseAddress(src: string): Address {
  try {
    return Address.parse(src);
  } catch (error: unknown) {
    if (typeof src === "string" && Address.isFriendly(src)) {
      const normalized = src.replace(/\-/g, "+").replace(/_/g, "\/");
      const data = Buffer.from(normalized, "base64");
      if (data.length === 36) {
        const workchain = data[1] === 0xff ? -1 : data[1];
        const hash = data.subarray(2, 34);
        return new Address(workchain, hash);
      }
    }
    throw error;
  }
}

export const areTonAddressesEqual = (left: string, right: string) => {
  try {
    return Address.parse(left).equals(Address.parse(right));
  } catch {
    return false;
  }
};
