import { getLangFromPath, getLanguageMeta } from '$lib/i18n';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const lang = getLangFromPath(event.url.pathname);
  const meta = getLanguageMeta(lang);

  event.locals.lang = lang;

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%lang%', lang).replace('%dir%', meta.dir)
  });
};
