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
    it('returns a ed25519 signed transaction', async () => {
      const { request, close } = await installSnap();

      const response = request({
        method: 'signTransaction',
        params: {
          path: ['m', "44'", "1551'"],
          curve: 'ed25519',
          transaction: {
            message: {
              bank: {
                Freeze: {
                  token_address: 'sov1lta047h6lta047h6lta047h6lta047h6lta047h6lta047h6ltaq5s0rwf',
                },
              },
            },
            nonce: 0,
          },
        },
      });

      const ui = await response.getInterface();
      assert(ui.type === 'confirmation');
      await ui.ok();

      expect(await response).toRespondWith(
        '0x59aef6220a77b31e6bc24fb643be3e2ff701b839eec55e538dacc98b813a141d39d217be7c37e36d3a9c54770e51da96ee5b70543748238633c677b91fcfe10653c19b062b51d011cbbdda344b3da4e714a6eca698bf62583c715ef7d8c70828220000000004fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa0000000000000000',
      );

      await close();
    });
  });
});
