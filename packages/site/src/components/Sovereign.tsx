import axios, { AxiosRequestConfig } from 'axios';
import React, { useState } from 'react';
import { hexToBytes } from '@metamask/utils';
import { defaultSnapOrigin } from '../config';
import { ExecuteButton } from './Buttons';

let jsonRpcId = 0;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  method: string;
  params: any[];
  id: number;
};

const jsonRpcRequest = (method: string, params: any[]): JsonRpcRequest => {
  jsonRpcId += 1;
  return {
    jsonrpc: '2.0',
    method,
    params,
    id: jsonRpcId,
  };
};

const sendJsonRpcRequest = async (url: string, method: string, params: any[]): Promise<string> => {
  const requestData = jsonRpcRequest(method, params);

  const config: AxiosRequestConfig = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await axios.post(url, requestData, config);
  return response.data;
};

type MethodSelectorState = `signTransaction` | `getPublicKey`;
type CurveSelectorState = `ed25519` | `secp256k1`;

type SovereignState = {
  method: MethodSelectorState;
  curve: CurveSelectorState;
  keyId: number;
  nonce?: number;
  sequencer?: string;
  message?: string;
  response?: string;
};

export const Sovereign = () => {
  const initialState: SovereignState = {
    method: `signTransaction`,
    curve: `ed25519`,
    keyId: 0,
    nonce: 0,
    sequencer: 'http://localhost:9000',
    message:
      '{"bank":{"Freeze":{"token_address":"sov1lta047h6lta047h6lta047h6lta047h6lta047h6lta047h6ltaq5s0rwf"}}}',
  };
  const [state, setState] = useState(initialState);

  return (
    <div>
      <div>Method:</div>
      <div>
        <select
          value={state.method}
          onChange={(ev) =>
            setState({
              ...state,
              method: ev.target.value as MethodSelectorState,
            })
          }
        >
          <option value="signTransaction">Sign Transaction</option>
          <option value="getPublicKey">Get Public Key</option>
        </select>
      </div>
      <div>Curve:</div>
      <div>
        <select
          value={state.curve}
          onChange={(ev) =>
            setState({
              ...state,
              curve: ev.target.value as CurveSelectorState,
            })
          }
        >
          <option value="ed25519">ed25519</option>
          <option value="secp256k1">secp256k1</option>
        </select>
      </div>
      <div>Key ID:</div>
      <div>
        <input
          type="text"
          value={state.keyId}
          onChange={(ev) => {
            const { value } = ev.target;

            // Allow only positive integers (whole numbers greater than or equal to zero)
            const regex = /^[0-9\b]+$/u; // Allows digits only
            if (value === '' || regex.test(value)) {
              setState({
                ...state,
                keyId: parseInt(value, 10),
              });
            }
          }}
        />
      </div>
      <div>Nonce:</div>
      <div>
        <input
          type="text"
          value={state.nonce}
          onChange={(ev) => {
            const { value } = ev.target;

            // Allow only positive integers (whole numbers greater than or equal to zero)
            const regex = /^[0-9\b]+$/u; // Allows digits only
            if (value === '' || regex.test(value)) {
              setState({
                ...state,
                nonce: parseInt(value, 10),
              });
            }
          }}
        />
      </div>
      <div>Sequencer:</div>
      <div>
        <input
          type="text"
          disabled={state.method !== `signTransaction`}
          value={state.sequencer}
          placeholder="Sequencer address..."
          onChange={(ev) =>
            setState({
              ...state,
              sequencer: ev.target.value,
            })
          }
        />
      </div>
      <div>Signature message:</div>
      <div>
        <textarea
          disabled={state.method !== `signTransaction`}
          value={state.message}
          onChange={(ev) =>
            setState({
              ...state,
              message: ev.target.value,
            })
          }
          placeholder="Signed message..."
          rows={5}
          cols={40}
        />
      </div>
      <div>
        <ExecuteButton
          onClick={async () => {
            const { method, curve, keyId, nonce, message } = state;

            const path = ['m', "44'", "1551'"];
            if (curve === 'ed25519') {
              // ed25519 requires hardened paths
              path.push(`${keyId}'`);
            } else {
              path.push(keyId.toString());
            }

            let params;
            if (method === `signTransaction`) {
              params = {
                path,
                curve,
                transaction: {
                  message: message || '',
                  nonce: nonce || 0,
                },
              };
            } else {
              params = {
                path,
                curve,
              };
            }

            const request = {
              method: 'wallet_invokeSnap',
              params: {
                snapId: defaultSnapOrigin,
                request: {
                  method,
                  params,
                },
              },
            };

            try {
              let response = await window.ethereum.request<string>(request);
              response = response || '';

              console.log(response);

              if (method === `signTransaction`) {
                response =
                  (await sendJsonRpcRequest(
                    state.sequencer || '',
                    'sequencer_acceptTx',
                    [{ body: Array.from(hexToBytes(response)) }],
                  )) || '';
              }

              setState({
                ...state,
                response: response || '',
              });
            } catch (e) {
              setState({
                ...state,
                response: e.message,
              });
            }
          }}
        />
      </div>
      <div>Response:</div>
      <div>
        <textarea
          disabled
          value={state.response}
          placeholder="Snap response..."
          rows={5}
          cols={40}
        />
      </div>
    </div>
  );
};
