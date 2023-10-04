import { providerErrors, rpcErrors } from '@metamask/rpc-errors';
import { DialogType, OnRpcRequestHandler } from '@metamask/snaps-types';
import { copyable, heading, panel, text } from '@metamask/snaps-ui';
import { SLIP10Node } from '@metamask/key-tree';
import {
  add0x,
  assert,
  bytesToHex,
  remove0x,
  valueToBytes,
} from '@metamask/utils';
import { sign as signEd25519 } from '@noble/ed25519';
import { sign as signSecp256k1 } from '@noble/secp256k1';

import type { GetBip32PublicKeyParams, SignMessageParams } from './types';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of the method.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  switch (request.method) {
    case 'getPublicKey':
      return await snap.request({
        method: 'snap_getBip32PublicKey',
        params: request.params as unknown as GetBip32PublicKeyParams,
      });

    case 'signMessage': {
      const { message, curve, ...params } = request.params as SignMessageParams;
      const json = await snap.request({
        method: 'snap_getBip32Entropy',
        params: {
          ...params,
          curve,
        },
      });
      const node = await SLIP10Node.fromJSON(json);

      assert(node.privateKey);
      assert(curve === 'ed25519' || curve === 'secp256k1');

      const approved = await snap.request({
        method: 'snap_dialog',
        params: {
          type: DialogType.Confirmation,
          content: panel([
            heading('Signature request'),
            text(
              `Do you want to ${curve} sign "${message}" with the following public key?`,
            ),
            copyable(add0x(node.publicKey)),
          ]),
        },
      });

      if (!approved) {
        throw providerErrors.userRejectedRequest();
      }

      if (curve === 'ed25519') {
        const signed = await signEd25519(
          valueToBytes(message),
          remove0x(node.privateKey),
        );
        return bytesToHex(signed);
      }

      if (curve === 'secp256k1') {
        const signed = await signSecp256k1(
          valueToBytes(message),
          remove0x(node.privateKey),
        );
        return bytesToHex(signed);
      }

      // This is guaranteed to never happen because of the `assert` above. But
      // TypeScript doesn't know that, so we need to throw an error here.
      throw new Error(`Unsupported curve: ${String(curve)}.`);
    }

    default: {
      throw rpcErrors.methodNotFound({
        data: { method: request.method },
      });
    }
  }
};
