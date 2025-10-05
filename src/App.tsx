import React, { useEffect, useState } from 'react';
import type { AppExtensionSDK } from '@contentful/app-sdk';
import { SDKProvider, useSDK } from '@contentful/react-apps-toolkit';
import {
  Box,
  Button,
  Flex,
  Heading,
  Note,
  Paragraph,
  Select,
  Stack,
  Text,
  Badge,
} from '@contentful/f36-components';

type SectionKey = 'showcase' | 'techtip';

// ⚠️ Paste YOUR Function-invocation Action sys.id
const APP_ACTION_ID = '2PCDcdGGPESa4MWitR2ZUo';

// Dropdown → actual content type ids
const SECTION_TO_CT: Record<SectionKey, string> = {
  showcase: 'projectShowcase',
  techtip: 'techTip',
};

const DEFAULT_PAGE_SIZE = 50;

// Robust helper that works across SDK variants
async function callTriggerIndex(sdk: AppExtensionSDK, section: SectionKey) {
  const { space, environment, app } = sdk.ids;
  const cma: any = sdk.cma;

  if (!APP_ACTION_ID) throw new Error('Missing APP_ACTION_ID.');
  const contentTypeId = SECTION_TO_CT[section];
  if (!contentTypeId) throw new Error(`Unknown section → contentTypeId mapping for "${section}".`);

  const paramsBase = {
    appDefinitionId: app,
    appActionId: APP_ACTION_ID,
  };

  const payload = {
    parameters: {
      // include these only if you want them available in event.body.parameters
      spaceId: space,
      environmentId: environment,
      section,
      contentTypeId,
      pageSize: DEFAULT_PAGE_SIZE,
    },
  };

  // Prefer singular + withResult (two-arg)
  if (typeof cma?.appActionCall?.createWithResult === 'function') {
    return cma.appActionCall.createWithResult(paramsBase, payload);
  }

  // Singular create (two-arg)
  if (typeof cma?.appActionCall?.create === 'function') {
    return cma.appActionCall.create(paramsBase, payload);
  }

  // Plural create (single arg with body)
  if (typeof cma?.appActionCalls?.create === 'function') {
    return cma.appActionCalls.create({
      spaceId: space,
      environmentId: environment,
      appDefinitionId: app,
      appActionId: APP_ACTION_ID,
      body: payload,
    });
  }

  // If we get here, the runtime doesn't expose App Action calls from this location
  console.log('CMA keys available:', Object.keys(cma || {}));
  throw new Error('App Action Call API not available in this runtime. Open the Page location and ensure the latest bundle is active.');
}

function IndexPanel({ sdk }: { sdk: AppExtensionSDK }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>('showcase');

  const isPage = sdk.location.is('page');

  const onClick = async () => {
    if (!isPage) {
      // bounce to page if user clicked from config
      sdk.navigator.openCurrentAppPage?.();
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await callTriggerIndex(sdk, section);
      sdk.notifier.success('Index triggered successfully');
      setMessage('Index started.');
    } catch (e: any) {
      sdk.notifier.error(e?.message || 'Failed to trigger index');
      setMessage(e?.message || 'Failed to trigger index');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Box
        padding="spacingL"
        marginBottom="spacingL"
        style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
      >
        <Flex alignItems="center" gap="spacingM" flexWrap="wrap" style={{ minWidth: 420 }}>
          <Text as="strong" fontSize="fontSizeM">Content Type</Text>
          <Select
            id="section-select"
            value={section}
            onChange={(e) => setSection(e.target.value as SectionKey)}
            aria-label="Select content type"
            // f36 Select has no width prop; use style
            style={{ width: 280 }}
          >
            <Select.Option value="showcase">Project Showcase</Select.Option>
            <Select.Option value="techtip">Tech Tip</Select.Option>
          </Select>
        </Flex>
      </Box>

      <Box
        padding="spacingL"
        marginBottom="spacingL"
        style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
      >
        <Flex alignItems="center">
          <Button variant="primary" isDisabled={busy} isLoading={busy} onClick={onClick}>
            Trigger Index
          </Button>
        </Flex>

        {!isPage && (
          // Note doesn't accept margin props → wrap with Box
          <Box style={{ marginTop: 'var(--cf-spacing-m)' }}>
            <Note>
              You’re on the configuration screen. Open the app Page to run actions:&nbsp;
              Apps → your app → <em>Open</em>.
            </Note>
          </Box>
        )}
      </Box>

      {message && <Note variant="positive">{message}</Note>}
    </>
  );
}

function Root() {
  const sdk = useSDK<AppExtensionSDK>();

  // Auto-redirect from Config → Page so actions can run
  useEffect(() => {
    if (sdk.location.is('app-config')) {
      sdk.navigator.openCurrentAppPage?.();
    }
  }, [sdk]);

  const currentLocation =
    (sdk.location.is('page') && 'page') ||
    (sdk.location.is('app-config') && 'app-config') ||
    'other';

  return (
    <Box as="section" padding="spacingXl" style={{ maxWidth: 840, margin: '0 auto' }}>
      <Flex alignItems="center" justifyContent="space-between" marginBottom="spacingL">
        <Stack spacing="spacing2Xs">
          <Heading marginBottom="none">Content Indexation</Heading>
          <Paragraph marginBottom="none" style={{ color: '#6c757d' }}>
            Select a content type and trigger a reindex for this environment.
          </Paragraph>
        </Stack>
        <Badge variant="secondary">location: {currentLocation}</Badge>
      </Flex>

      <IndexPanel sdk={sdk} />
    </Box>
  );
}

export default function App() {
  return (
    <SDKProvider>
      <Root />
    </SDKProvider>
  );
}
