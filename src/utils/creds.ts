// src/lib/utils/creds.ts
export type ConstructorCreds = { key: string; token: string; section?: string };
export type AppActionIdResult = { appActionId: string };
export type AppActionIdLoadParams = { appActionId?: string };
export type ConstructorCredsLocaleMap = {
  en: ConstructorCreds;
  fr: ConstructorCreds;
};

/**  helper: first non-empty trimmed string */
function firstNonEmpty(...vals: Array<unknown>): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}

export function loadContentfulGqlCreds(context: any): { token: string } {
  const cfg =
    (context as any)?.appInstallationParameters?.contentful ??
    (context as any)?.parameters?.installation?.contentful ??
    {};
  const token = cfg?.deliveryToken; // CDA only

  if (!token) throw new Error('Contentful GraphQL token missing (delivery).');
  return { token };
}

export function loadConstructorCredsFromContextOrEnv(
  context: any,
  params?: { section?: string; constructorToken?: string } // keep params minimal
): ConstructorCredsLocaleMap {
  const ctorFromContext =
    (context as any)?.appInstallationParameters?.constructor ??
    (context as any)?.parameters?.installation?.constructor ??
    {};

  // Prefer explicit EN/FR keys; fall back to legacy single key for EN
  const key_en =
    firstNonEmpty(
      process.env.CONSTRUCTOR_API_KEY_EN,
      (ctorFromContext as any)?.key_en,
      process.env.CONSTRUCTOR_API_KEY,      // legacy fallback
      (ctorFromContext as any)?.key         // legacy fallback
    ) || undefined;

  const key_fr =
    firstNonEmpty(
      process.env.CONSTRUCTOR_API_KEY_FR,
      (ctorFromContext as any)?.key_fr
    ) || undefined;

  const token = firstNonEmpty(
    process.env.CONSTRUCTOR_API_TOKEN,
    params?.constructorToken,
    (ctorFromContext as any)?.token
  );

  const section = firstNonEmpty(
    process.env.CONSTRUCTOR_SECTION,
    params?.section,
    (ctorFromContext as any)?.section
  );

  if (!key_en) throw new Error('Constructor EN key missing (context/env).');
  if (!key_fr) throw new Error('Constructor FR key missing (context/env).');
  if (!token)  throw new Error('Constructor token missing (context/env).');

  return {
    en: { key: key_en, token, section },
    fr: { key: key_fr, token, section },
  };
}

/**
 * Load the App Action ID used to invoke your function via App Actions.
 */
export function loadAppActionIdFromContextOrEnv(
  context: any,
  params?: AppActionIdLoadParams
): AppActionIdResult {
  const aip =
    (context as any)?.appInstallationParameters ??
    (context as any)?.parameters?.installation ??
    {};

  const fromContext = firstNonEmpty(
    (aip as any)?.appActionId,
    (aip as any)?.action?.id,
    (aip as any)?.actions?.triggerIndex?.id,
    (aip as any)?.actions?.default?.id
  );

  const appActionId = firstNonEmpty(
    params?.appActionId,
    process.env.APP_ACTION_ID,
    fromContext
  );


  if (!appActionId) {
    throw new Error(
      'App Action ID missing. Provide params.appActionId, APP_ACTION_ID env, or installation parameters (appActionId / action.id / actions.triggerIndex.id).'
    );
  }

  return { appActionId };
}
