// functions/lib/constructorCreds.ts
export type ConstructorCreds = {
  key: string;
  token: string;
  section?: string;
};

// Read THIS environment's app-installation parameters
export async function loadConstructorCreds(context: any, appId?: string): Promise<ConstructorCreds> {
  const cma = context?.cma || (await getPlainCma(context));
  const id = appId || context.appId; // either pass it in, or let it come from context

  const path = `/spaces/${context.spaceId}/environments/${context.environmentId}/app_installations/${id}`;
  const res = await (cma as any).raw.get(path);

  const ctor = (res?.parameters || res?.params || {}).constructor || {};
  const key = ctor.key;
  const token = ctor.token;       // ← stored securely by Contentful; never log
  const section = ctor.section;

  if (!key)   throw new Error('Constructor key missing in installation params');
  if (!token) throw new Error('Constructor token missing in installation params');

  return { key, token, section };
}

async function getPlainCma(context: any) {
  const { createClient } = await import('contentful-management');
  const opts = (context as any).cmaClientOptions;
  return createClient(opts, {
    type: 'plain',
    defaults: { spaceId: context.spaceId, environmentId: context.environmentId },
  });
}
