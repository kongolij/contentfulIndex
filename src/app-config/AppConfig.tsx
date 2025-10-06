import React, { useEffect, useRef, useState } from 'react';
import type { AppExtensionSDK } from '@contentful/app-sdk';
import {
  Form,
  TextInput,
  Heading,
  Note,
  Subheading,
  Box,
  Flex,
  FormControl,
} from '@contentful/f36-components';
import { Workbench } from '@contentful/f36-workbench';

type ConstructorParams = {
  key_en?: string;
  key_fr?: string;
  token?: string;
  section?: string;
};

type Params = {
  constructor?: ConstructorParams;
  contentful?: { deliveryToken?: string };
  appAction?: { appActionId?: string };
};

export default function AppConfig({ sdk }: { sdk: AppExtensionSDK }) {
  const [params, setParams] = useState<Params>({
    constructor: {},
    contentful: {},
    appAction: {},
  });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    (async () => {
      const current = (await sdk.app.getParameters()) as Params | null;

      const next: Params = {
        constructor: { ...(current?.constructor ?? {}) },
        contentful: { ...(current?.contentful ?? {}) },
        appAction: { ...(current?.appAction ?? {}) },
      };

      // back-compat: map legacy single key → EN if EN/FR not set
      const legacyKey = (current as any)?.constructor?.key as string | undefined;
      if (legacyKey && !next.constructor?.key_en && !next.constructor?.key_fr) {
        next.constructor = { ...(next.constructor ?? {}), key_en: legacyKey };
      }

      setParams(next);
      await sdk.app.setReady();
    })();
  }, [sdk]);

  useEffect(() => sdk.app.onConfigure(async () => ({ parameters: paramsRef.current })), [sdk.app]);

  const ctor = params.constructor ?? {};
  const ctf = params.contentful ?? {};
  const act = params.appAction ?? {};

  const setCtor =
    (field: keyof ConstructorParams) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams((p) => ({ ...p, constructor: { ...(p.constructor ?? {}), [field]: e.target.value } }));

  const setCtf =
    (field: keyof NonNullable<Params['contentful']>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams((p) => ({ ...p, contentful: { ...(p.contentful ?? {}), [field]: e.target.value } }));

  const setAct =
    (field: keyof NonNullable<Params['appAction']>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams((p) => ({ ...p, appAction: { ...(p.appAction ?? {}), [field]: e.target.value } }));

  return (
    <Workbench>
      <Workbench.Content>
        <Flex flexDirection="column" gap="spacingXl" alignItems="stretch" style={{ maxWidth: 720 }}>
          <Note variant="warning" title="Security">
            Tokens/keys are saved as installation parameters for this environment.
          </Note>

          {/* Constructor */}
          <Box>
            <Heading>Constructor settings</Heading>
            <Form>
              <FormControl id="constructor-key-en">
                <FormControl.Label>EN index key</FormControl.Label>
                <TextInput
                  name="constructor-key-en"
                  value={ctor.key_en ?? ''}
                  onChange={setCtor('key_en')}
                  placeholder="Constructor API Key (EN)"
                  isRequired
                />
              </FormControl>

              <FormControl id="constructor-key-fr">
                <FormControl.Label>FR index key</FormControl.Label>
                <TextInput
                  name="constructor-key-fr"
                  value={ctor.key_fr ?? ''}
                  onChange={setCtor('key_fr')}
                  placeholder="Constructor API Key (FR)"
                  isRequired
                />
              </FormControl>

              <FormControl id="constructor-api-token">
                <FormControl.Label>API token</FormControl.Label>
                <TextInput
                  name="constructor-token"
                  value={ctor.token ?? ''}
                  onChange={setCtor('token')}
                  placeholder="Constructor API Token"
                  type="password"
                  isRequired
                />
              </FormControl>
            </Form>
          </Box>

          {/* Contentful GraphQL */}
          <Box>
            <Heading>Contentful GraphQL settings</Heading>
            <Subheading as="h3">Access Tokens</Subheading>
            <Form>
              <FormControl id="ctf-delivery">
                <FormControl.Label>CDA access token</FormControl.Label>
                <TextInput
                  name="ctf-delivery"
                  value={ctf.deliveryToken ?? ''}
                  onChange={setCtf('deliveryToken')}
                  placeholder="Content Delivery API (CDA) token"
                  type="password"
                  isRequired
                />
              </FormControl>
            </Form>
          </Box>

          {/* App Action */}
          <Box>
            <Heading>App Action settings</Heading>
            <Form>
              <FormControl id="app-action-id">
                <FormControl.Label>Function (App Action) ID</FormControl.Label>
                <TextInput
                  name="app-action-id"
                  value={act.appActionId ?? ''}
                  onChange={setAct('appActionId')}
                  placeholder="e.g. 2PCDcdGGPESa4MWitR2ZUo"
                  type="password"
                  isRequired
                />
              </FormControl>
            </Form>
          </Box>
        </Flex>
      </Workbench.Content>
    </Workbench>
  );
}
