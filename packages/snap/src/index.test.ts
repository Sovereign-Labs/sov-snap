import { installSnap } from '@metamask/snaps-jest';
import { expect } from '@jest/globals';
import { assert } from '@metamask/utils';

describe('onRpcRequest', () => {
  describe('getPublicKey', () => {
    it('returns a secp256k1 public key', async () => {
      const { request, close } = await installSnap();

      const response = await request({
        method: 'getPublicKey',
        params: {
          path: ['m', "44'", "1'"],
          curve: 'secp256k1',
        },
      });

      expect(response).toRespondWith(
        '0x048e129862c1de5ca86468add43b001d32fd34b8113de716ecd63fa355b7f1165f0e76f5dc6095100f9fdaa76ddf28aa3f21406ac5fda7c71ffbedb45634fe2ceb',
      );

      await close();
    });

    it('returns a ed25519 public key', async () => {
      const { request, close } = await installSnap();

      const response = await request({
        method: 'getPublicKey',
        params: {
          path: ['m', "44'", "1'"],
          curve: 'ed25519',
        },
      });

      expect(response).toRespondWith(
        '0x00c9aaf347832dc3b1dbb7aab4f41e5e04c64446b819c0761571c27b9f90eacb27',
      );

      await close();
    });
  });

  describe('signMessage', () => {
    it('returns a secp256k1 signature', async () => {
      const { request, close } = await installSnap();

      const response = request({
        method: 'signMessage',
        params: {
          path: ['m', "44'", "1'"],
          curve: 'secp256k1',
          message: 'some message',
        },
      });

      const ui = await response.getInterface();
      assert(ui.type === 'confirmation');
      await ui.ok();

      expect(await response).toRespondWith(
        '0x304402202832f86d32a486a33f11f7ccb483b262177d9729d4911d5ff965a84ee53c26ad02202a7e67964e39112de5d2c1a637aaeb59350c76c9350a94845e949dccd54f9c85',
      );

      await close();
    });

    it('returns a ed25519 signature', async () => {
      const { request, close } = await installSnap();

      const response = request({
        method: 'signMessage',
        params: {
          path: ['m', "44'", "1'"],
          curve: 'ed25519',
          message: 'some message',
        },
      });

      const ui = await response.getInterface();
      assert(ui.type === 'confirmation');
      await ui.ok();

      expect(await response).toRespondWith(
        '0x10804459eef93e52f9f01f38775ce4a21eb818d70cb637c602267f48c4e129fb2f68bc24bf74c84a1950227ea76d7c1ce860e4867941ef793c83399621c69c0d',
      );

      await close();
    });
  });
});
