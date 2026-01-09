import type { LayoutLoad } from './$types';
import { defaultLang } from '$lib/i18n';

export const load: LayoutLoad = ({ params }) => {
  const lang = params.lang || defaultLang;
  return { lang };
};
