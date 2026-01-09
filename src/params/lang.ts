import { languages } from '$lib/i18n';

export function match(param: string) {
  return languages.some((item) => item.id === param);
}
