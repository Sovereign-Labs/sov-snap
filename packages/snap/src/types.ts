import { Bip32PathStruct } from '@metamask/snaps-utils';
import {
  boolean,
  object,
  optional,
  type,
  string,
  number,
  array,
} from 'superstruct';

/**
 * `type` is used instead of `object` to allow unknown properties.
 */
export const GetBip32PublicKeyParamsStruct = type({
  /**
   * The BIP-32 path to the account.
   */
  path: Bip32PathStruct,
  /**
   * Whether to return the public key in compressed form.
   */
  compressed: optional(boolean()),
});

/**
 * The transaction object to be submitted by the UI so the signature can be generated.
 */
export const TransactionStruct = object({
  /**
   * The JSON transaction to sign.
   */
  message: string(),
  /**
   * The nonce for the transaction signature.
   */
  nonce: number(),
});

/**
 * The parameters for calling the `signTransaction` JSON-RPC method.
 */
export const SignTransactionStruct = object({
  /**
   * The JSON transaction to sign.
   */
  transaction: TransactionStruct,

  /**
   * The BIP-32 path to the account.
   */
  path: array(string()),
});

/**
 * The expected WASM interface from the imported module.
 */
export type WasmInstance = {
  /**
   * Allocs `len` bytes and returns the pointer.
   */
  alloc: (len: number) => number;

  /**
   * Deallocs `len` bytes from the address `ptr`.
   */
  dealloc: (ptr: number, len: number) => void;

  /**
   * Serializes a call message into a signable message and returns its pointer.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  serialize_call: (txPtr: number, txLen: number, noncePtr: number) => number;

  /**
   * Serializes a transaction into a format that can be sent to a sequencer.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  serialize_transaction: (
    pkPtr: number,
    pkLen: number,
    msgPtr: number,
    msgLen: number,
    signaturePtr: number,
    signatureLen: number,
  ) => number;

  /**
   * Validates the signature of a provided transaction.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  validate_transaction: (txPtr: number, txLen: number) => number;

  /**
   * The WASM memory.
   */
  memory: Uint8Array;
};
