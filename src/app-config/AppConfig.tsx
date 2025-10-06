import React, { useEffect, useRef, useState } from 'react';
import type { AppExtensionSDK } from '@contentful/app-sdk';
import { Form, TextInput, Heading, Note, Switch, Subheading, Stack } from '@contentful/f36-components';
import { Workbench } from '@contentful/f36-workbench';



type Params = {
  constructor?: { key?: string; token?: string; section?: string };
  contentful?: { deliveryToken?: string };
};

export default function AppConfig({ sdk }: { sdk: AppExtensionSDK }) {
  const [params, setParams] = useState<Params>({ constructor: {}, contentful: {} });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    (async () => {
      const current = (await sdk.app.getParameters()) as Params | null;
      if (current) setParams(current);
      await sdk.app.setReady();
    })();
  }, [sdk]);

  useEffect(() => {
    return sdk.app.onConfigure(async () => ({ parameters: paramsRef.current }));
  }, [sdk.app]);

  const ctor = params.constructor ?? {};
  const ctf  = params.contentful ?? {};

  const setCtor =
    (field: keyof NonNullable<Params['constructor']>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams(p => ({ ...p, constructor: { ...(p.constructor ?? {}), [field]: e.target.value } }));

  const setCtf =
    (field: keyof NonNullable<Params['contentful']>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams(p => ({ ...p, contentful: { ...(p.contentful ?? {}), [field]: e.target.value } }));

  return (
    <Workbench>
      <Workbench.Content>
        <Stack spacing="spacingXl">
          <section>
            <Heading>Constructor settings</Heading>
            <Note variant="warning" title="Security" className="mb-4">
              Tokens are saved as installation parameters for this environment.
            </Note>
            <Form>
              <TextInput name="constructor-key" value={ctor.key ?? ''} onChange={setCtor('key')}
                placeholder="Constructor API Key" isRequired />
              <TextInput name="constructor-token" value={ctor.token ?? ''} onChange={setCtor('token')}
                placeholder="Constructor API Token" type="password" isRequired />
              
            </Form>
          </section>

          <section>
            <Heading>Contentful GraphQL settings</Heading>
            <Subheading as="h3">Access Tokens</Subheading>
            <Form>
              <TextInput
                name="ctf-delivery"
                value={ctf.deliveryToken ?? ''}
                onChange={setCtf('deliveryToken')}
                placeholder="Content Delivery API (CDA) token"
                type="password"
                isRequired
              />
            </Form>
          </section>
        </Stack>
      </Workbench.Content>
    </Workbench>
  );
}
