# Sovereign SDK MetaMask Snap

The Sovereign SDK MetaMask Snap enables transaction signing for users.

This Snap is configured to use the designated [coin type 1551](https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types), allocated for the SDK-Sovereign SDK. In accordance with Metamask's Snap permissions design, the coin type is hardcoded. If you require a different coin type, you can fork this repository and modify the authorized path in the [Snap manifest](./packages/snap/snap.md).

## Methods

#### `getPublicKey`

Returns the public key of the wallet as hexadecimal string.

##### Params

- `path`: The BIP-32 derivation path of the wallet (`string[]`).
- `curve`: The curve of the public key (`secp256k1` or `ed25519`).

##### Example

```typescript
const response = await request({
  method: 'getPublicKey',
  params: {
    path: ['m', "44'", "1551'"],
    curve: 'ed25519',
  },
});
if (
  !response ===
  '0x00c9aaf347832dc3b1dbb7aab4f41e5e04c64446b819c0761571c27b9f90eacb27'
) {
  throw new Error('Invalid public key');
}
```

#### `signTransaction`

Returns the signature of the message as hexadecimal string.

Will emit a confirmation dialog for the user.

##### Params

- `path`: The BIP-32 derivation path of the wallet (`string['m', "44'", "1551'", ...]`).
- `curve`: The curve of the public key (`secp256k1` or `ed25519`).
- `schema`: A [borsh](https://www.npmjs.com/package/borsh) schema for the transaction.
- `transaction`: A transaction to be serialized using the provided schema. The signature will be performed over the serialized transaction.
- `nonce`: An unsigned 64-bits number to be appended to the serialized transaction.

##### Example

```typescript
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

if (
  !response ===
  '0xe563b3d772572e57bff43e31e449dbc8e98f7580fea10b2ad1ad8278b3edcf5ff5b3a24b85cef3192fcd70452c58e7c968e500da9e290aefadf5ef22a4efbf0d',
) {
  throw new Error('Invalid signature');
}
```

## Testing

To test the snap, run `yarn test` in this directory. This will use [`@metamask/snaps-jest`](https://github.com/MetaMask/snaps/tree/main/packages/snaps-jest) to run the tests in `src/index.test.ts`.

If a change to the snap code was performed, you will need to run `yarn build` before the tests.
