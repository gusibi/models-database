<script lang="ts">
  import { defaultLang, getLanguageMeta, getTranslations, languages } from '$lib/i18n';

  const baseUrl = 'https://models.eztools.com';

  const props = $props();
  const { children } = props;
  const data = props.data;

  const lang = data?.lang ?? defaultLang;
  const meta = getLanguageMeta(lang);
  const t = getTranslations(lang);
  const canonical = `${baseUrl}/${lang}`;
</script>

<svelte:head>
  <title>{t.metaTitle}</title>
  <meta name="description" content={t.metaDescription} />
  <meta name="keywords" content={t.metaKeywords} />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content={t.metaTitle} />
  <meta property="og:description" content={t.metaDescription} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={t.headerTitle} />
  <meta property="og:url" content={canonical} />
  <meta property="og:locale" content={meta.ogLocale} />
  <link rel="canonical" href={canonical} />
  {#each languages as language}
    <link rel="alternate" hreflang={language.id} href={`${baseUrl}/${language.id}`} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={`${baseUrl}/${defaultLang}`} />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={t.metaTitle} />
  <meta name="twitter:description" content={t.metaDescription} />
</svelte:head>

{@render children()}
