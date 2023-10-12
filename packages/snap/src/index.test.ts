import { installSnap } from '@metamask/snaps-jest';
import { expect } from '@jest/globals';
import { assert } from '@metamask/utils';
import { Schema } from 'borsh';

const callMessageSchema: Schema = {
  enum: [
    {
      struct: {
        Invoke: {
          struct: {
            method: 'string',
            payload: { array: { type: 'u8' } },
          },
        },
      },
    },
    {
      struct: {
        Transfer: {
          struct: {
            from: { array: { type: 'u8', len: 32 } },
            to: { array: { type: 'u8', len: 32 } },
            amount: 'u64',
          },
        },
      },
    },
  ],
};

describe('onRpcRequest', () => {
  describe('getPublicKey', () => {
    it('returns a secp256k1 public key', async () => {
      const { request, close } = await installSnap();

      const response = await request({
        method: 'getPublicKey',
        params: {
          path: ['m', "44'", "1551'"],
          curve: 'secp256k1',
        },
      });

      expect(response).toRespondWith(
        '0x04237d3c3d7d80442704201691f8b05034cf7cff2e0f60afa77971f02ae640adb9654a5c736938c430fffccc883d42760eb1aaac3a2441485bfa817a089aae7ff5',
      );

      await close();
    });

    it('returns a ed25519 public key', async () => {
      const { request, close } = await installSnap();

      const response = await request({
        method: 'getPublicKey',
        params: {
          path: ['m', "44'", "1551'"],
          curve: 'ed25519',
        },
      });

      expect(response).toRespondWith(
        '0x00ff3c690d2a58db6d7f97e9ed0aa3455dd54a21246cf71492f36d60bb7c0a659f',
      );

      await close();
    });
  });

  describe('signTransaction', () => {
    it('returns a secp256k1 signature', async () => {
      const { request, close } = await installSnap();

      const response = request({
        method: 'signTransaction',
        params: {
          path: ['m', "44'", "1551'"],
          curve: 'secp256k1',
          schema: callMessageSchema,
          transaction: {
            Invoke: {
              method: 'someMethod',
              payload: Array(176).fill(5),
            },
          },
          nonce: 26,
        },
      });

      const ui = await response.getInterface();
      assert(ui.type === 'confirmation');
      await ui.ok();

      expect(await response).toRespondWith(
        '0x3044022037ed1abe499f6699943dc26299e5c24111002ad115e481d126868e68e73eebd40220552312cc86a09ba8160ffc496b24eb04319c6c25ad7f965b59a6938858f00ca5',
      );

      await close();
    });

    it('returns a ed25519 signature', async () => {
      const { request, close } = await installSnap();

      const response = request({
        method: 'signTransaction',
        params: {
          path: ['m', "44'", "1551'"],
          curve: 'ed25519',
          schema: callMessageSchema,
          transaction: {
            Transfer: {
              from: Array(32).fill(2),
              to: Array(32).fill(3),
              amount: 1582,
            },
          },
          nonce: 0,
        },
      });

      const ui = await response.getInterface();
      assert(ui.type === 'confirmation');
      await ui.ok();

      expect(await response).toRespondWith(
        '0xe563b3d772572e57bff43e31e449dbc8e98f7580fea10b2ad1ad8278b3edcf5ff5b3a24b85cef3192fcd70452c58e7c968e500da9e290aefadf5ef22a4efbf0d',
      );

      await close();
    });
  });
});
