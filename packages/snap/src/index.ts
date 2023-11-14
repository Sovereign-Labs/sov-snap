import { providerErrors, rpcErrors } from '@metamask/rpc-errors';
import { DialogType, OnRpcRequestHandler } from '@metamask/snaps-types';
import { copyable, heading, panel, text } from '@metamask/snaps-ui';
import { SLIP10Node } from '@metamask/key-tree';
import { add0x, assert, bytesToHex, remove0x } from '@metamask/utils';
import { sign as signEd25519 } from '@noble/ed25519';
import { sign as signSecp256k1 } from '@noble/secp256k1';

import type {
  GetBip32PublicKeyParams,
  SignTransactionParams,
  WasmInstance,
} from './types';
import { moduleBytes } from './module';

type InstanceMemorySlice = [number, number];
let allocs: InstanceMemorySlice[] = [];

const instance = new WebAssembly.Instance(new WebAssembly.Module(moduleBytes), {
  wasi_snapshot_preview1: {
    fd_write: (
      _fd: number,
      _iovsPtr: number,
      _iovsLen: number,
      _nwrittenPtr: number,
    ): number => {
      return 0;
    },
    environ_get: (_environ: number, _environBuf: number): number => {
      return 0;
    },
    environ_sizes_get: (
      _environCount: number,
      _environSize: number,
    ): number => {
      return 0;
    },
    proc_exit: (exitCode: number) => {
      throw `exit with exit code ${exitCode}`;
    },
  },
});

const instanceExports: WasmInstance = instance.exports;

const deallocAll = () => {
  for (const pair of allocs) {
    const [ptr, len] = pair;
    instanceExports.dealloc(ptr, len);
  }
  allocs = [];
};

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
    // the return is a plain hex string
    // https://docs.metamask.io/snaps/reference/rpc-api/#returns-5
    case 'getPublicKey':
      return await snap.request({
        method: 'snap_getBip32PublicKey',
        params: request.params as unknown as GetBip32PublicKeyParams,
      });

    case 'signTransaction': {
      const { transaction, curve, ...params } =
        request.params as SignTransactionParams;

      const encoder = new TextEncoder();
      const encodedTx = encoder.encode(transaction.message);
      let serializedTxBytesHex;

      try {
        const txLen = encodedTx.length;
        const txPtr = instanceExports.alloc(txLen);
        allocs.push([txPtr, txLen]);

        const txMem = new Uint8Array(
          instanceExports.memory.buffer,
          txPtr,
          txLen,
        );
        txMem.set(encodedTx);

        const nonceBuffer = new ArrayBuffer(8);
        const nonceDv = new DataView(nonceBuffer);
        nonceDv.setBigUint64(0, BigInt(transaction.nonce), true);
        const nonceArray = new Uint8Array(nonceBuffer);
        const noncePtr = instanceExports.alloc(8);
        allocs.push([noncePtr, 8]);

        const nonceMem = new Uint8Array(
          instanceExports.memory.buffer,
          noncePtr,
          8,
        );
        nonceMem.set(nonceArray);

        const msgRawPtr = instanceExports.serialize_call(
          txPtr,
          txLen,
          noncePtr,
        );
        allocs.push([msgRawPtr, 4]);

        const msgPtr = msgRawPtr + 4;
        if (msgRawPtr === 0) {
          throw rpcErrors.internal('Invalid transaction');
        }

        const msgLen = new DataView(instanceExports.memory.buffer).getUint32(
          msgRawPtr,
          true,
        );
        allocs.push([msgPtr, msgLen]);

        const msgArray = instanceExports.memory.buffer.slice(
          msgPtr,
          msgPtr + msgLen,
        );
        const msgBytes = new Uint8Array(msgArray);

        const json = await snap.request({
          method: 'snap_getBip32Entropy',
          params: {
            ...params,
            curve,
          },
        });

        // we define a SLIP-10 node from the response
        // https://docs.metamask.io/snaps/reference/rpc-api/#returns-4
        const node = await SLIP10Node.fromJSON(json);

        // while SLIP-10 does support NIST P-256, Metamask doesn't under the claim of insufficient
        // demand.
        // https://github.com/satoshilabs/slips/blob/master/slip-0010.md#master-key-generation
        // https://github.com/MetaMask/key-tree/blob/main/README.md#usage
        assert(node.privateKey);
        assert(curve === 'ed25519' || curve === 'secp256k1');

        const approved = await snap.request({
          method: 'snap_dialog',
          params: {
            type: DialogType.Confirmation,
            content: panel([
              heading('Signature request'),
              text(`Do you want to ${curve} sign`),
              copyable(transaction.message),
              text(`with nonce`),
              copyable(transaction.nonce.toString()),
              text(`and the following public key?`),
              copyable(add0x(node.publicKey)),
            ]),
          },
        });

        if (!approved) {
          throw providerErrors.userRejectedRequest();
        }

        const privateKey = remove0x(node.privateKey);

        let msgSignature;
        switch (curve) {
          case 'ed25519':
            msgSignature = await signEd25519(msgBytes, privateKey);
            break;
          case 'secp256k1':
            msgSignature = await signSecp256k1(msgBytes, privateKey);
            break;
          default:
            throw new Error(`Unsupported curve: ${String(curve)}.`);
        }

        let publicKey;
        if (curve === 'ed25519') {
          // ed25519 library will prefix the public key with `0`
          publicKey = node.publicKeyBytes.slice(1, node.publicKeyBytes.length);
        } else {
          publicKey = node.publicKeyBytes;
        }
        const publicKeyPtr = instanceExports.alloc(publicKey.length);
        allocs.push([publicKeyPtr, publicKey.length]);

        const publicKeyMem = new Uint8Array(
          instanceExports.memory.buffer,
          publicKeyPtr,
          publicKey.length,
        );
        publicKeyMem.set(publicKey);

        const signatureLen = msgSignature.length;
        const signaturePtr = instanceExports.alloc(signatureLen);
        allocs.push([signaturePtr, signatureLen]);

        const signatureMem = new Uint8Array(
          instanceExports.memory.buffer,
          signaturePtr,
          signatureLen,
        );
        signatureMem.set(msgSignature);

        const serializedTxRawPtr = instanceExports.serialize_transaction(
          publicKeyPtr,
          publicKey.length,
          msgPtr,
          msgLen,
          signaturePtr,
          signatureLen,
        );
        allocs.push([serializedTxRawPtr, 4]);

        if (serializedTxRawPtr === 0) {
          throw rpcErrors.internal('Error serializing transaction');
        }

        const serializedTxPtr = serializedTxRawPtr + 4;
        const serializedTxLen = new DataView(
          instanceExports.memory.buffer,
        ).getUint32(serializedTxRawPtr, true);
        allocs.push([serializedTxPtr, serializedTxLen]);

        const serializedTxArray = instanceExports.memory.buffer.slice(
          serializedTxPtr,
          serializedTxPtr + serializedTxLen,
        );
        const serializedTxBytes = new Uint8Array(serializedTxArray);
        serializedTxBytesHex = bytesToHex(serializedTxBytes);

        const txVerification = instanceExports.validate_transaction(
          serializedTxPtr,
          serializedTxLen,
        );
        if (txVerification !== 0) {
          throw rpcErrors.internal('Error validating serialized transaction');
        }
      } catch (e) {
        deallocAll();
        throw e;
      } finally {
        deallocAll();
      }

      return serializedTxBytesHex;
    }

    default: {
      throw rpcErrors.methodNotFound({
        data: { method: request.method },
      });
    }
  }
};
