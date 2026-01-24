<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    defaultLang,
    getLanguageMeta,
    getTranslations,
    languages,
  } from "$lib/i18n";
  import {
    loadModels,
    getAllModels,
    getUniqueProviders,
    filterModels,
    formatNumber,
    formatDate,
    formatCost,
    getMaxCost,
    getMaxContext,
    getMaxOutput,
    type FilterOptions,
    type Model,
  } from "$lib/models";

  const props = $props();

  const lang = $derived(props.data?.lang ?? defaultLang);
  const t = $derived(getTranslations(lang));
  const locale = $derived(getLanguageMeta(lang).locale);

  let theme = $state("light");

  let models = $state<Model[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let allProviders = $state<{ id: string; name: string }[]>([]);
  let selectedProviders = $state<string[]>([]);
  let providerSearch = $state("");
  let providerDropdownOpen = $state(false);
  let providerDropdownButton = $state<HTMLButtonElement | null>(null);

  let maxInputCost = $state<number>(10);
  let maxOutputCost = $state<number>(10);
  let maxCacheReadCost = $state<number>(0);
  let maxCacheWriteCost = $state<number>(0);
  let maxReasoningCost = $state<number>(0);
  let maxInputAudioCost = $state<number>(0);
  let maxOutputAudioCost = $state<number>(0);
  let minContext = $state<number>(0);
  let minOutput = $state<number>(0);
  let minReleaseDate = $state("");

  let maxCacheReadCap = $state<number>(0);
  let maxCacheWriteCap = $state<number>(0);
  let maxReasoningCap = $state<number>(0);
  let maxInputAudioCap = $state<number>(0);
  let maxOutputAudioCap = $state<number>(0);

  let features: {
    vision: boolean | null;
    audio: boolean | null;
    video: boolean | null;
    code: boolean | null;
    reasoning: boolean | null;
    toolCall: boolean | null;
    openWeights: boolean | null;
    structuredOutput: boolean | null;
    temperature: boolean | null;
  } = $state({
    vision: null,
    audio: null,
    video: null,
    code: null,
    reasoning: null,
    toolCall: null,
    openWeights: null,
    structuredOutput: null,
    temperature: null,
  });

  let openWeightsOnly = $state(false);
  let freeOnly = $state(false);
  let knowledgeOnly = $state(false);
  let interleavedOnly = $state(false);
  let searchText = $state("");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let showAdvancedFilters = $state(false);
  let quickContextPreset = $state("any");
  let quickReleasePreset = $state("any");

  // 可显示的字段列表
  let availableFields = $state([
    { id: "name", labelKey: "tableName", name: "Model", visible: true },
    {
      id: "provider",
      labelKey: "tableProvider",
      name: "Provider",
      visible: true,
    },
    { id: "family", labelKey: "tableFamily", name: "Family", visible: true },
    {
      id: "costInput",
      labelKey: "sortInputCost",
      name: "Input Cost",
      visible: true,
    },
    {
      id: "costOutput",
      labelKey: "sortOutputCost",
      name: "Output Cost",
      visible: true,
    },
    { id: "context", labelKey: "tableContext", name: "Context", visible: true },
    { id: "output", labelKey: "tableOutput", name: "Output", visible: true },
    {
      id: "cacheRead",
      labelKey: "tableCacheRead",
      name: "Cache Read",
      visible: true,
    },
    {
      id: "cacheWrite",
      labelKey: "tableCacheWrite",
      name: "Cache Write",
      visible: true,
    },
    {
      id: "reasoning",
      labelKey: "tableReasoning",
      name: "Reasoning Cost",
      visible: true,
    },
    {
      id: "features",
      labelKey: "tableFeatures",
      name: "Features",
      visible: true,
    },
    {
      id: "releaseDate",
      labelKey: "tableReleased",
      name: "Released",
      visible: true,
    },
    {
      id: "structuredOutput",
      labelKey: "tableStruct",
      name: "Structured",
      visible: true,
    },
    { id: "temperature", labelKey: "tableTemp", name: "Temp", visible: true },
    {
      id: "interleaved",
      labelKey: "tableInter",
      name: "Interleaved",
      visible: true,
    },
    {
      id: "knowledge",
      labelKey: "tableKnowledge",
      name: "Knowledge",
      visible: true,
    },
    { id: "id", labelKey: "tableId", name: "ID", visible: false },
  ]);

  const getFieldLabel = (field: { labelKey: string; name: string }) =>
    (t as Record<string, string>)[field.labelKey] ?? field.name;

  let showFieldSelector = $state(false);
  let tableContainer = $state<HTMLDivElement | null>(null);
  let isSyncingScroll = $state(false);

  let filteredModels = $state<Model[]>([]);
  let displayModels = $state<Model[]>([]);

  type FeatureKey = keyof typeof features;

  const maxCostModel = $derived(getMaxCost(models));
  const maxContextModel = $derived(getMaxContext(models));
  const maxOutputModel = $derived(getMaxOutput(models));

  $effect(() => {
    displayModels = sortModels(filteredModels);
  });

  function handleHorizontalScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    setTimeout(() => (isSyncingScroll = false), 10);
  }

  function applyTheme(nextTheme: "light" | "dark") {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (!target.value || target.value === lang) return;
    goto(`/${target.value}`);
  }

  function formatTemplate(
    template: string | undefined,
    values: Record<string, string | number>,
  ) {
    if (!template) return "";
    return Object.entries(values).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
      template,
    );
  }

  function getProvidersCountLabel(selected: number, total: number) {
    return formatTemplate(t.providersCount, { selected, total });
  }

  function getResultsFoundLabel(count: number) {
    const template = count === 1 ? t.resultsFoundOne : t.resultsFoundMany;
    return formatTemplate(template, { count });
  }

  $effect(() => {
    if (minContext === 0) {
      quickContextPreset = "any";
    } else if (minContext === 8000) {
      quickContextPreset = "8k";
    } else if (minContext === 32000) {
      quickContextPreset = "32k";
    } else if (minContext === 128000) {
      quickContextPreset = "128k";
    } else if (minContext === 1000000) {
      quickContextPreset = "1m";
    } else {
      quickContextPreset = "custom";
    }
  });

  $effect(() => {
    const presetDates = ["2024-01-01", "2023-01-01", "2022-01-01"];
    if (!minReleaseDate) {
      quickReleasePreset = "any";
    } else if (presetDates.includes(minReleaseDate)) {
      quickReleasePreset = minReleaseDate;
    } else {
      quickReleasePreset = "custom";
    }
  });

  function handleQuickContextChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    const presets: Record<string, number> = {
      any: 0,
      "8k": 8000,
      "32k": 32000,
      "128k": 128000,
      "1m": 1000000,
    };

    if (value === "custom") {
      showAdvancedFilters = true;
      return;
    }

    minContext = presets[value] ?? 0;
    applyFilters();
  }

  function handleQuickReleaseChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;

    if (value === "custom") {
      showAdvancedFilters = true;
      return;
    }

    minReleaseDate = value === "any" ? "" : value;
    applyFilters();
  }

  function toggleQuickFeature(key: FeatureKey) {
    features[key] = features[key] === true ? null : true;
    applyFilters();
  }

  function getColumnsLabel(count: number) {
    return formatTemplate(t.columnsLabel, { count });
  }

  onMount(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      theme = stored;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
    applyTheme(theme as "light" | "dark");
  });

  function getMaxOptionalCost(key: keyof Model["properties"]["cost"]): number {
    if (models.length === 0) return 0;
    const values = models.map((model) => {
      const val = model.properties.cost[key];
      return typeof val === "number" ? val : 0;
    });
    return Math.max(...values, 0);
  }

  onMount(async () => {
    try {
      const data = await loadModels();
      models = getAllModels(data);
      allProviders = getUniqueProviders(data);
      console.log("Loaded providers:", allProviders.length, allProviders);
      selectedProviders = allProviders.map((p) => p.id);

      const maxCost = getMaxCost(models);
      const maxCtx = getMaxContext(models);
      const maxOut = getMaxOutput(models);

      maxInputCost = maxCost.input;
      maxOutputCost = maxCost.output;
      minContext = 0;
      minOutput = 0;

      maxCacheReadCap = getMaxOptionalCost("cache_read");
      maxCacheWriteCap = getMaxOptionalCost("cache_write");
      maxReasoningCap = getMaxOptionalCost("reasoning");
      maxInputAudioCap = getMaxOptionalCost("input_audio");
      maxOutputAudioCap = getMaxOptionalCost("output_audio");

      maxCacheReadCost = maxCacheReadCap;
      maxCacheWriteCost = maxCacheWriteCap;
      maxReasoningCost = maxReasoningCap;
      maxInputAudioCost = maxInputAudioCap;
      maxOutputAudioCost = maxOutputAudioCap;

      applyFilters();
    } catch (e) {
      error = t.errorLoad;
      console.error(e);
    } finally {
      loading = false;
    }
  });

  function applyFilters() {
    if (models.length === 0) {
      filteredModels = [];
      displayModels = [];
      return;
    }

    const options: FilterOptions = {
      providers:
        selectedProviders.length > 0 &&
        selectedProviders.length < allProviders.length
          ? selectedProviders
          : undefined,
      maxInputCost:
        maxInputCost < maxCostModel.input ? maxInputCost : undefined,
      maxOutputCost:
        maxOutputCost < maxCostModel.output ? maxOutputCost : undefined,
      maxCacheRead:
        maxCacheReadCost < maxCacheReadCap ? maxCacheReadCost : undefined,
      maxCacheWrite:
        maxCacheWriteCost < maxCacheWriteCap ? maxCacheWriteCost : undefined,
      maxReasoningCost:
        maxReasoningCost < maxReasoningCap ? maxReasoningCost : undefined,
      maxInputAudioCost:
        maxInputAudioCost < maxInputAudioCap ? maxInputAudioCost : undefined,
      maxOutputAudioCost:
        maxOutputAudioCost < maxOutputAudioCap ? maxOutputAudioCost : undefined,
      minContext: minContext > 0 ? minContext : undefined,
      minOutput: minOutput > 0 ? minOutput : undefined,
      features: Object.keys(features).reduce((acc, key) => {
        const k = key as keyof typeof features;
        if (features[k] !== null) acc[k] = features[k] as boolean;
        return acc;
      }, {} as any),
      openWeightsOnly: openWeightsOnly || undefined,
      freeOnly: freeOnly || undefined,
      minDate: minReleaseDate || undefined,
      knowledgeOnly: knowledgeOnly || undefined,
      interleavedOnly: interleavedOnly || undefined,
      searchText: searchText || undefined,
    };

    const nextFiltered = filterModels(models, options);
    filteredModels = nextFiltered;
  }

  function resetFilters() {
    if (models.length === 0) return;
    const maxCost = maxCostModel;

    maxInputCost = maxCost.input;
    maxOutputCost = maxCost.output;
    maxCacheReadCost = maxCacheReadCap;
    maxCacheWriteCost = maxCacheWriteCap;
    maxReasoningCost = maxReasoningCap;
    maxInputAudioCost = maxInputAudioCap;
    maxOutputAudioCost = maxOutputAudioCap;
    minContext = 0;
    minOutput = 0;
    minReleaseDate = "";
    features = {
      vision: null,
      audio: null,
      video: null,
      code: null,
      reasoning: null,
      toolCall: null,
      openWeights: null,
      structuredOutput: null,
      temperature: null,
    };
    openWeightsOnly = false;
    freeOnly = false;
    knowledgeOnly = false;
    interleavedOnly = false;
    searchText = "";
    providerSearch = "";
    selectedProviders = allProviders.map((p) => p.id);
    providerDropdownOpen = false;
    showFieldSelector = false;

    applyFilters();
  }

  function toggleProvider(providerId: string) {
    if (selectedProviders.includes(providerId)) {
      selectedProviders = selectedProviders.filter((p) => p !== providerId);
    } else {
      selectedProviders = [...selectedProviders, providerId];
    }
    applyFilters();
  }

  function toggleAllProviders() {
    if (selectedProviders.length === allProviders.length) {
      selectedProviders = [];
    } else {
      selectedProviders = allProviders.map((p) => p.id);
    }
    applyFilters();
  }

  function sortModels(list: Model[]) {
    return [...list].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortBy) {
        case "cost-input":
          aVal = a.properties.cost.input;
          bVal = b.properties.cost.input;
          break;
        case "cost-output":
          aVal = a.properties.cost.output;
          bVal = b.properties.cost.output;
          break;
        case "context":
          aVal = a.properties.limit.context;
          bVal = b.properties.limit.context;
          break;
        case "output":
          aVal = a.properties.limit.output;
          bVal = b.properties.limit.output;
          break;
        case "date":
          aVal = a.properties.releaseDate;
          bVal = b.properties.releaseDate;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "provider":
          aVal = a.provider.toLowerCase();
          bVal = b.provider.toLowerCase();
          break;
        case "family":
          aVal = a.properties.family.toLowerCase();
          bVal = b.properties.family.toLowerCase();
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      const multiplier = sortOrder === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * multiplier;
      }

      return ((aVal as number) - (bVal as number)) * multiplier;
    });
  }

  function toggleSort(field: string) {
    if (sortBy === field) {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
    } else {
      sortBy = field;
      sortOrder = "asc";
    }
  }

  function toggleProviderDropdown() {
    providerDropdownOpen = !providerDropdownOpen;
  }

  // Close dropdown when clicking outside
  $effect(() => {
    if (!providerDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const dropdown = document.querySelector(".dropdown-content");
      const button = providerDropdownButton;
      const target = e.target as Node;

      if (
        dropdown &&
        button &&
        !dropdown.contains(target) &&
        !button.contains(target)
      ) {
        providerDropdownOpen = false;
      }
    };

    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  });

  function selectAllProviders() {
    selectedProviders = allProviders.map((p) => p.id);
    providerDropdownOpen = false;
    applyFilters();
  }

  function clearAllProviders() {
    selectedProviders = [];
    providerDropdownOpen = false;
    applyFilters();
  }

  function toggleFieldVisibility(fieldId: string) {
    availableFields = availableFields.map((f) =>
      f.id === fieldId ? { ...f, visible: !f.visible } : f,
    );
  }

  function showAllFields() {
    availableFields = availableFields.map((f) => ({ ...f, visible: true }));
  }

  function hideAllFields() {
    availableFields = availableFields.map((f) => ({ ...f, visible: false }));
  }

  function clearFilterChip(id: string) {
    const maxCost = maxCostModel;
    switch (id) {
      case "search":
        searchText = "";
        break;
      case "providers":
        selectedProviders = allProviders.map((p) => p.id);
        break;
      case "free":
        freeOnly = false;
        break;
      case "context":
        minContext = 0;
        break;
      case "output":
        minOutput = 0;
        break;
      case "release":
        minReleaseDate = "";
        break;
      case "vision":
        features.vision = null;
        break;
      case "audio":
        features.audio = null;
        break;
      case "reasoning":
        features.reasoning = null;
        break;
      case "video":
        features.video = null;
        break;
      case "code":
        features.code = null;
        break;
      case "toolCall":
        features.toolCall = null;
        break;
      case "structuredOutput":
        features.structuredOutput = null;
        break;
      case "temperature":
        features.temperature = null;
        break;
      case "openWeights":
        openWeightsOnly = false;
        break;
      case "knowledge":
        knowledgeOnly = false;
        break;
      case "interleaved":
        interleavedOnly = false;
        break;
      case "maxInputCost":
        maxInputCost = maxCost.input;
        break;
      case "maxOutputCost":
        maxOutputCost = maxCost.output;
        break;
      case "maxCacheReadCost":
        maxCacheReadCost = maxCacheReadCap;
        break;
      case "maxCacheWriteCost":
        maxCacheWriteCost = maxCacheWriteCap;
        break;
      case "maxReasoningCost":
        maxReasoningCost = maxReasoningCap;
        break;
      case "maxInputAudioCost":
        maxInputAudioCost = maxInputAudioCap;
        break;
      case "maxOutputAudioCost":
        maxOutputAudioCost = maxOutputAudioCap;
        break;
      default:
        break;
    }

    applyFilters();
  }

  const activeFilterChips = $derived.by(() => {
    const chips: { id: string; label: string }[] = [];
    const maxCost = maxCostModel;

    if (searchText.trim()) {
      chips.push({
        id: "search",
        label: `${t.groupSearch}: ${searchText.trim()}`,
      });
    }

    if (
      selectedProviders.length > 0 &&
      selectedProviders.length < allProviders.length
    ) {
      chips.push({
        id: "providers",
        label: getProvidersCountLabel(
          selectedProviders.length,
          allProviders.length,
        ),
      });
    }

    if (freeOnly) {
      chips.push({ id: "free", label: t.freeLabel });
    }

    if (minContext > 0) {
      chips.push({
        id: "context",
        label: `${t.tableContext} ≥ ${formatNumber(minContext)}`,
      });
    }

    if (minOutput > 0) {
      chips.push({
        id: "output",
        label: `${t.tableOutput} ≥ ${formatNumber(minOutput)}`,
      });
    }

    if (minReleaseDate) {
      chips.push({
        id: "release",
        label: `${t.labelReleasedAfter}: ${minReleaseDate}`,
      });
    }

    if (features.vision === true) {
      chips.push({ id: "vision", label: t.featureVision });
    }

    if (features.audio === true) {
      chips.push({ id: "audio", label: t.featureAudio });
    }

    if (features.reasoning === true) {
      chips.push({ id: "reasoning", label: t.featureReasoning });
    }

    if (features.video === true) {
      chips.push({ id: "video", label: t.featureVideo });
    }

    if (features.code === true) {
      chips.push({ id: "code", label: t.featureCode });
    }

    if (features.toolCall === true) {
      chips.push({ id: "toolCall", label: t.featureTool });
    }

    if (features.structuredOutput === true) {
      chips.push({ id: "structuredOutput", label: t.featureStruct });
    }

    if (features.temperature === true) {
      chips.push({ id: "temperature", label: t.featureTemp });
    }

    if (openWeightsOnly) {
      chips.push({ id: "openWeights", label: t.featureOpen });
    }

    if (knowledgeOnly) {
      chips.push({ id: "knowledge", label: t.labelHasKnowledge });
    }

    if (interleavedOnly) {
      chips.push({ id: "interleaved", label: t.labelInterleaved });
    }

    if (maxInputCost < maxCost.input) {
      chips.push({
        id: "maxInputCost",
        label: `${t.sortInputCost} ≤ ${formatCost(maxInputCost, t.freeLabel)}`,
      });
    }

    if (maxOutputCost < maxCost.output) {
      chips.push({
        id: "maxOutputCost",
        label: `${t.sortOutputCost} ≤ ${formatCost(maxOutputCost, t.freeLabel)}`,
      });
    }

    if (maxCacheReadCost < maxCacheReadCap) {
      chips.push({
        id: "maxCacheReadCost",
        label: `${t.labelCacheRead} ≤ ${formatCost(
          maxCacheReadCost,
          t.freeLabel,
        )}`,
      });
    }

    if (maxCacheWriteCost < maxCacheWriteCap) {
      chips.push({
        id: "maxCacheWriteCost",
        label: `${t.labelCacheWrite} ≤ ${formatCost(
          maxCacheWriteCost,
          t.freeLabel,
        )}`,
      });
    }

    if (maxReasoningCost < maxReasoningCap) {
      chips.push({
        id: "maxReasoningCost",
        label: `${t.labelReasoning} ≤ ${formatCost(
          maxReasoningCost,
          t.freeLabel,
        )}`,
      });
    }

    if (maxInputAudioCost < maxInputAudioCap) {
      chips.push({
        id: "maxInputAudioCost",
        label: `${t.labelAudioIn} ≤ ${formatCost(
          maxInputAudioCost,
          t.freeLabel,
        )}`,
      });
    }

    if (maxOutputAudioCost < maxOutputAudioCap) {
      chips.push({
        id: "maxOutputAudioCost",
        label: `${t.labelAudioOut} ≤ ${formatCost(
          maxOutputAudioCost,
          t.freeLabel,
        )}`,
      });
    }

    return chips;
  });

  const filteredProviders = $derived.by(() => {
    const result = allProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(providerSearch.toLowerCase()),
    );
    return result;
  });
</script>

<div class="container flex min-h-screen flex-col">
  <main class="flex-1">
    <header class="hero">
      <div
        class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            AI
          </div>
          <div>
            <h1
              class="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {t.headerTitle}
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {t.headerSubtitle}
            </p>
          </div>
        </div>
        <div class="w-full lg:max-w-2xl">
          <label class="sr-only" for="main-search">{t.searchLabel}</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true">⌕</span
            >
            <input
              id="main-search"
              type="text"
              placeholder={t.searchPlaceholder}
              bind:value={searchText}
              class="w-full rounded-full border border-slate-200 bg-white/80 px-11 py-3 text-base text-slate-900 shadow-sm outline-none ring-slate-400/20 focus:ring-2 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-200/20 dark:placeholder:text-slate-500"
              oninput={applyFilters}
            />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <span
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300"
              aria-hidden="true">🌐</span
            >
            <select
              value={lang}
              onchange={handleLanguageChange}
              aria-label={t.languageLabel}
              class="min-h-[44px] rounded-full border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 shadow-sm outline-none ring-slate-400/20 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-200/20"
            >
              {#each languages as language}
                <option value={language.id}>{language.label}</option>
              {/each}
            </select>
            <span
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden="true">▾</span
            >
          </div>
          <button
            class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            type="button"
            onclick={toggleTheme}
            aria-label={t.themeToggle}
          >
            <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
          </button>
          <a
            class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            href="https://github.com/anomalyco/models.dev"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <span aria-hidden="true">GH</span>
          </a>
        </div>
      </div>
      <p class="sr-only">{t.srDescription}</p>
    </header>

    {#if loading}
      <div class="loading min-h-[50vh]">
        <div class="spinner"></div>
        <p>{t.loading}</p>
      </div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      <section
        class="relative z-30 mt-6 rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/70"
      >
        <div class="flex items-center justify-between">
          <div
            class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500"
          >
            {t.quickFilters}
          </div>
          <button
            class="text-xs font-semibold text-slate-500 underline dark:text-slate-300"
            type="button"
            onclick={resetFilters}
          >
            {t.resetFilters}
          </button>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <div class="provider-dropdown relative">
            <button
              bind:this={providerDropdownButton}
              class="flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onclick={toggleProviderDropdown}
            >
              <span
                >{getProvidersCountLabel(
                  selectedProviders.length,
                  allProviders.length,
                )}</span
              >
              <span class="text-slate-400 dark:text-slate-500">▾</span>
            </button>
            {#if providerDropdownOpen}
              <div class="dropdown-content absolute left-0 top-full z-50 mt-2">
                <div class="dropdown-actions">
                  <button
                    class="action-btn min-h-[44px] px-3 py-2"
                    onclick={selectAllProviders}>{t.labelAll}</button
                  >
                  <button
                    class="action-btn min-h-[44px] px-3 py-2"
                    onclick={clearAllProviders}>{t.labelNone}</button
                  >
                </div>
                <input
                  type="text"
                  placeholder={t.providerSearchPlaceholder}
                  bind:value={providerSearch}
                  class="provider-search compact"
                />
                <div class="dropdown-list">
                  {#if allProviders.length === 0}
                    <div class="dropdown-empty">Loading providers...</div>
                  {:else if filteredProviders.length === 0}
                    <div class="dropdown-empty">No providers found</div>
                  {:else}
                    {#each filteredProviders as provider}
                      <div class="dropdown-item">
                        <label class="provider-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedProviders.includes(provider.id)}
                            onchange={() => toggleProvider(provider.id)}
                          />
                          <span class="provider-name">{provider.name}</span>
                        </label>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <button
            class={`min-h-[44px] rounded-full border px-4 text-sm font-medium shadow-sm ${
              freeOnly
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
            type="button"
            onclick={() => {
              freeOnly = !freeOnly;
              applyFilters();
            }}
          >
            {t.freeLabel}
          </button>

          <div
            class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <span
              class="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500"
              >{t.tableContext}</span
            >
            <select
              value={quickContextPreset}
              onchange={handleQuickContextChange}
              class="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
              aria-label={t.tableContext}
            >
              <option value="any">{t.labelAll}</option>
              <option value="8k">8K</option>
              <option value="32k">32K</option>
              <option value="128k">128K</option>
              <option value="1m">1M</option>
              <option value="custom">{t.custom}</option>
            </select>
          </div>

          <div
            class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <span
              class="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500"
              >{t.labelReleasedAfter}</span
            >
            <select
              value={quickReleasePreset}
              onchange={handleQuickReleaseChange}
              class="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
              aria-label={t.labelReleasedAfter}
            >
              <option value="any">{t.labelAll}</option>
              <option value="2024-01-01">2024+</option>
              <option value="2023-01-01">2023+</option>
              <option value="2022-01-01">2022+</option>
              <option value="custom">{t.custom}</option>
            </select>
          </div>

          <button
            class={`min-h-[44px] rounded-full border px-4 text-sm font-medium shadow-sm ${
              features.vision === true
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : features.vision === false
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/50 dark:bg-rose-400/10 dark:text-rose-200"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
            type="button"
            onclick={() => toggleQuickFeature("vision")}
          >
            👁 {t.featureVision}
          </button>

          <button
            class={`min-h-[44px] rounded-full border px-4 text-sm font-medium shadow-sm ${
              features.audio === true
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : features.audio === false
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/50 dark:bg-rose-400/10 dark:text-rose-200"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
            type="button"
            onclick={() => toggleQuickFeature("audio")}
          >
            🎧 {t.featureAudio}
          </button>

          <button
            class={`min-h-[44px] rounded-full border px-4 text-sm font-medium shadow-sm ${
              features.reasoning === true
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : features.reasoning === false
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/50 dark:bg-rose-400/10 dark:text-rose-200"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
            type="button"
            onclick={() => toggleQuickFeature("reasoning")}
          >
            🧠 {t.featureReasoning}
          </button>

          <button
            class="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            type="button"
            onclick={() => (showAdvancedFilters = true)}
          >
            + {t.moreFilters}
          </button>
        </div>

        {#if activeFilterChips.length > 0}
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500"
              >{t.activeFilters}</span
            >
            {#each activeFilterChips as chip}
              <button
                class="flex min-h-[36px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                type="button"
                onclick={() => clearFilterChip(chip.id)}
              >
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            {/each}
            <button
              class="text-xs font-semibold text-slate-500 underline dark:text-slate-300"
              type="button"
              onclick={resetFilters}
            >
              {t.resetFilters}
            </button>
          </div>
        {/if}
      </section>

      {#if showAdvancedFilters}
        <div class="fixed inset-0 z-40">
          <button
            class="absolute inset-0 bg-slate-900/40"
            type="button"
            aria-label={t.close}
            onclick={() => (showAdvancedFilters = false)}
          ></button>
          <div
            class="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-950"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-center justify-between">
              <h2
                class="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {t.moreFilters}
              </h2>
              <div class="flex items-center gap-3">
                <button
                  class="text-sm font-semibold text-slate-500 underline dark:text-slate-300"
                  type="button"
                  onclick={resetFilters}
                >
                  {t.resetFilters}
                </button>
                <button
                  class="min-h-[40px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  type="button"
                  onclick={() => (showAdvancedFilters = false)}
                >
                  {t.close}
                </button>
              </div>
            </div>

            <div class="mt-6 space-y-8">
              <div class="filter-group">
                <div class="filter-group-header">
                  <div class="filter-group-title">{t.groupPricing}</div>
                  <label class="free-checkbox free-inline">
                    <input
                      type="checkbox"
                      bind:checked={freeOnly}
                      onchange={applyFilters}
                    />
                    <span>{t.freeLabel}</span>
                  </label>
                </div>
                <div class="filter-group-body">
                  <div class="filter-item filter-cost">
                    <div class="compact-range stacked">
                      <span class="range-label">{t.labelInputOutput}:</span>
                      <div class="range-row">
                        <span class="range-sub-label">{t.sortInputCost}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxCostModel.input}
                          step="0.01"
                          bind:value={maxInputCost}
                          title={t.sortInputCost}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >${maxInputCost.toFixed(2)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.sortOutputCost}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxCostModel.output}
                          step="0.01"
                          bind:value={maxOutputCost}
                          title={t.sortOutputCost}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >${maxOutputCost.toFixed(2)}</span
                        >
                      </div>

                      <div class="range-row">
                        <span class="range-sub-label">{t.labelCacheRead}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxCacheReadCap}
                          step="0.0001"
                          bind:value={maxCacheReadCost}
                          disabled={maxCacheReadCap === 0}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatCost(maxCacheReadCost, t.freeLabel)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.labelCacheWrite}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxCacheWriteCap}
                          step="0.0001"
                          bind:value={maxCacheWriteCost}
                          disabled={maxCacheWriteCap === 0}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatCost(maxCacheWriteCost, t.freeLabel)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.labelReasoning}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxReasoningCap}
                          step="0.0001"
                          bind:value={maxReasoningCost}
                          disabled={maxReasoningCap === 0}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatCost(maxReasoningCost, t.freeLabel)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.labelAudioIn}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxInputAudioCap}
                          step="0.0001"
                          bind:value={maxInputAudioCost}
                          disabled={maxInputAudioCap === 0}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatCost(maxInputAudioCost, t.freeLabel)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.labelAudioOut}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxOutputAudioCap}
                          step="0.0001"
                          bind:value={maxOutputAudioCost}
                          disabled={maxOutputAudioCap === 0}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatCost(maxOutputAudioCost, t.freeLabel)}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-group-title">{t.groupLimits}</div>
                <div class="filter-group-body">
                  <div class="filter-item filter-context">
                    <div class="compact-range stacked">
                      <span class="range-label">{t.labelContextOutput}:</span>
                      <div class="range-row">
                        <span class="range-sub-label">{t.tableContext}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxContextModel}
                          step="1000"
                          bind:value={minContext}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatNumber(minContext)}</span
                        >
                      </div>
                      <div class="range-row">
                        <span class="range-sub-label">{t.tableOutput}</span>
                        <input
                          type="range"
                          min="0"
                          max={maxOutputModel}
                          step="1000"
                          bind:value={minOutput}
                          oninput={applyFilters}
                        />
                        <span class="range-value"
                          >{formatNumber(minOutput)}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-group-title">{t.groupCapabilities}</div>
                <div class="filter-group-body">
                  <div class="filter-item filter-features">
                    <div class="feature-tags">
                      <button
                        class="feature-tag"
                        class:active={features.vision === true}
                        class:inactive={features.vision === false}
                        onclick={() => {
                          features.vision =
                            features.vision === true
                              ? false
                              : features.vision === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureVision}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.audio === true}
                        class:inactive={features.audio === false}
                        onclick={() => {
                          features.audio =
                            features.audio === true
                              ? false
                              : features.audio === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureAudio}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.video === true}
                        class:inactive={features.video === false}
                        onclick={() => {
                          features.video =
                            features.video === true
                              ? false
                              : features.video === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureVideo}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.code === true}
                        class:inactive={features.code === false}
                        onclick={() => {
                          features.code =
                            features.code === true
                              ? false
                              : features.code === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureCode}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.reasoning === true}
                        class:inactive={features.reasoning === false}
                        onclick={() => {
                          features.reasoning =
                            features.reasoning === true
                              ? false
                              : features.reasoning === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureReasoning}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.toolCall === true}
                        class:inactive={features.toolCall === false}
                        onclick={() => {
                          features.toolCall =
                            features.toolCall === true
                              ? false
                              : features.toolCall === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureTool}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.structuredOutput === true}
                        class:inactive={features.structuredOutput === false}
                        onclick={() => {
                          features.structuredOutput =
                            features.structuredOutput === true
                              ? false
                              : features.structuredOutput === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureStruct}
                      </button>
                      <button
                        class="feature-tag"
                        class:active={features.temperature === true}
                        class:inactive={features.temperature === false}
                        onclick={() => {
                          features.temperature =
                            features.temperature === true
                              ? false
                              : features.temperature === false
                                ? null
                                : true;
                          applyFilters();
                        }}
                      >
                        {t.featureTemp}
                      </button>
                      <label class="feature-checkbox">
                        <input
                          type="checkbox"
                          bind:checked={openWeightsOnly}
                          onchange={applyFilters}
                        />
                        <span>{t.featureOpen}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-group-title">{t.groupMetadata}</div>
                <div class="filter-group-body">
                  <div class="filter-item filter-release">
                    <label class="range-label" for="release-date"
                      >{t.labelReleasedAfter}:</label
                    >
                    <input
                      id="release-date"
                      type="date"
                      bind:value={minReleaseDate}
                      class="date-input compact"
                      onchange={applyFilters}
                    />
                  </div>
                  <div class="filter-item filter-flags">
                    <label class="feature-checkbox">
                      <input
                        type="checkbox"
                        bind:checked={knowledgeOnly}
                        onchange={applyFilters}
                      />
                      <span>{t.labelHasKnowledge}</span>
                    </label>
                    <label class="feature-checkbox">
                      <input
                        type="checkbox"
                        bind:checked={interleavedOnly}
                        onchange={applyFilters}
                      />
                      <span>{t.labelInterleaved}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <div class="results min-h-[50vh]">
        <div class="results-header">
          <div class="results-title">
            <h2>{getResultsFoundLabel(displayModels.length)}</h2>
          </div>
          <div class="results-actions">
            <div class="field-selector">
              <button
                class="field-selector-toggle min-h-[44px] px-3 py-2"
                onclick={() => (showFieldSelector = !showFieldSelector)}
              >
                <span class="field-icon">⚙</span>
                <span
                  >{getColumnsLabel(
                    availableFields.filter((f) => f.visible).length,
                  )}</span
                >
                <span class="dropdown-arrow"
                  >{showFieldSelector ? "▲" : "▼"}</span
                >
              </button>
              {#if showFieldSelector}
                <div class="field-selector-dropdown">
                  <div class="field-selector-actions">
                    <button
                      class="action-btn small min-h-[44px] px-3 py-2"
                      onclick={showAllFields}>{t.showAll}</button
                    >
                    <button
                      class="action-btn small min-h-[44px] px-3 py-2"
                      onclick={hideAllFields}>{t.hideAll}</button
                    >
                  </div>
                  <div class="field-list">
                    {#each availableFields as field}
                      <label class="field-item" class:visible={field.visible}>
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onchange={() => toggleFieldVisibility(field.id)}
                        />
                        <span>{getFieldLabel(field)}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            <button
              class="reset-btn min-h-[44px] px-3 py-2"
              type="button"
              onclick={resetFilters}
            >
              {t.resetFilters}
            </button>
            <div class="sort-controls">
              <label class="sr-only" for="sort-select">{t.sortLabel}</label>
              <select
                id="sort-select"
                class="sort-select min-h-[44px] px-3 py-2"
                bind:value={sortBy}
                aria-label={t.sortLabel}
              >
                <option value="name">{t.sortName}</option>
                <option value="provider">{t.sortProvider}</option>
                <option value="family">{t.sortFamily}</option>
                <option value="cost-input">{t.sortInputCost}</option>
                <option value="cost-output">{t.sortOutputCost}</option>
                <option value="context">{t.sortContext}</option>
                <option value="date">{t.sortReleaseDate}</option>
              </select>
              <button
                class="sort-order-btn min-h-[44px] px-3 py-2"
                onclick={() => {
                  sortOrder = sortOrder === "asc" ? "desc" : "asc";
                }}
              >
                {sortOrder === "asc" ? `↓ ${t.sortAsc}` : `↑ ${t.sortDesc}`}
              </button>
            </div>
          </div>
        </div>

        {#if displayModels.length === 0}
          <div class="no-results">
            <h3>{t.noResultsTitle}</h3>
            <p>{t.noResultsBody}</p>
          </div>
        {:else}
          <div class="table-scroll-wrapper">
            <!-- 表格容器：独立的滚动区域 -->
            <div
              class="table-container"
              bind:this={tableContainer}
              onscroll={handleHorizontalScroll}
            >
              <table class="models-table">
                <thead>
                  <tr>
                    {#if availableFields.find((f) => f.id === "name")?.visible}
                      <th class="sortable" onclick={() => toggleSort("name")}>
                        {t.tableName}
                        {#if sortBy === "name"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "provider")?.visible}
                      <th
                        class="sortable"
                        onclick={() => toggleSort("provider")}
                      >
                        {t.tableProvider}
                        {#if sortBy === "provider"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "family")?.visible}
                      <th class="sortable" onclick={() => toggleSort("family")}>
                        {t.tableFamily}
                        {#if sortBy === "family"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "costInput")?.visible}
                      <th
                        class="sortable"
                        onclick={() => toggleSort("cost-input")}
                      >
                        {t.tableInput}
                        {#if sortBy === "cost-input"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "costOutput")?.visible}
                      <th
                        class="sortable"
                        onclick={() => toggleSort("cost-output")}
                      >
                        {t.tableOutput}
                        {#if sortBy === "cost-output"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "context")?.visible}
                      <th
                        class="sortable"
                        onclick={() => toggleSort("context")}
                      >
                        {t.tableContext}
                        {#if sortBy === "context"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "output")?.visible}
                      <th>{t.tableOutput}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "cacheRead")?.visible}
                      <th>{t.tableCacheRead}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "cacheWrite")?.visible}
                      <th>{t.tableCacheWrite}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "reasoning")?.visible}
                      <th>{t.tableReasoning}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "features")?.visible}
                      <th>{t.tableFeatures}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "releaseDate")?.visible}
                      <th class="sortable" onclick={() => toggleSort("date")}>
                        {t.tableReleased}
                        {#if sortBy === "date"}{sortOrder === "asc"
                            ? "↓"
                            : "↑"}{/if}
                      </th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "structuredOutput")?.visible}
                      <th>{t.tableStruct}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "temperature")?.visible}
                      <th>{t.tableTemp}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "interleaved")?.visible}
                      <th>{t.tableInter}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "knowledge")?.visible}
                      <th>{t.tableKnowledge}</th>
                    {/if}
                    {#if availableFields.find((f) => f.id === "id")?.visible}
                      <th>{t.tableId}</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each displayModels as model (model.id)}
                    <tr class="model-row">
                      {#if availableFields.find((f) => f.id === "name")?.visible}
                        <td class="model-name-cell">
                          <div class="model-name-content">
                            <h3>{model.name}</h3>
                            {#if model.properties.features.openWeights}
                              <span class="open-weights-badge-mini"
                                >{t.featureOpen}</span
                              >
                            {/if}
                          </div>
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "provider")?.visible}
                        <td class="provider-cell">
                          <span class="provider-tag">{model.provider}</span>
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "family")?.visible}
                        <td class="family-cell">{model.properties.family}</td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "costInput")?.visible}
                        <td class="cost-cell input-cost"
                          >{formatCost(
                            model.properties.cost.input,
                            t.freeLabel,
                          )}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "costOutput")?.visible}
                        <td class="cost-cell output-cost"
                          >{formatCost(
                            model.properties.cost.output,
                            t.freeLabel,
                          )}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "context")?.visible}
                        <td class="context-cell"
                          >{formatNumber(model.properties.limit.context)}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "output")?.visible}
                        <td class="output-cell"
                          >{formatNumber(model.properties.limit.output)}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "cacheRead")?.visible}
                        <td class="cost-cell"
                          >{model.properties.cost.cache_read
                            ? formatCost(
                                model.properties.cost.cache_read,
                                t.freeLabel,
                              )
                            : "-"}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "cacheWrite")?.visible}
                        <td class="cost-cell"
                          >{model.properties.cost.cache_write
                            ? formatCost(
                                model.properties.cost.cache_write,
                                t.freeLabel,
                              )
                            : "-"}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "reasoning")?.visible}
                        <td class="cost-cell"
                          >{model.properties.cost.reasoning
                            ? formatCost(
                                model.properties.cost.reasoning,
                                t.freeLabel,
                              )
                            : "-"}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "features")?.visible}
                        <td class="features-cell">
                          <div class="features-list">
                            {#if model.properties.features.vision}
                              <span
                                class="feature-icon vision"
                                title={t.featureVision}>👁️</span
                              >
                            {/if}
                            {#if model.properties.features.audio}
                              <span
                                class="feature-icon audio"
                                title={t.featureAudio}>🔊</span
                              >
                            {/if}
                            {#if model.properties.features.video}
                              <span
                                class="feature-icon video"
                                title={t.featureVideo}>🎬</span
                              >
                            {/if}
                            {#if model.properties.features.code}
                              <span
                                class="feature-icon code"
                                title={t.featureCode}>💻</span
                              >
                            {/if}
                            {#if model.properties.features.reasoning}
                              <span
                                class="feature-icon reasoning"
                                title={t.featureReasoning}>🧠</span
                              >
                            {/if}
                            {#if model.properties.features.toolCall}
                              <span
                                class="feature-icon tool-call"
                                title={t.featureTool}>🔧</span
                              >
                            {/if}
                          </div>
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "releaseDate")?.visible}
                        <td class="date-cell"
                          >{formatDate(
                            model.properties.releaseDate,
                            locale,
                          )}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "structuredOutput")?.visible}
                        <td class="bool-cell">
                          {#if model.properties.features.structuredOutput}
                            <span class="bool-yes">✓</span>
                          {:else}
                            <span class="bool-no">-</span>
                          {/if}
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "temperature")?.visible}
                        <td class="bool-cell">
                          {#if model.properties.features.temperature}
                            <span class="bool-yes">✓</span>
                          {:else}
                            <span class="bool-no">-</span>
                          {/if}
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "interleaved")?.visible}
                        <td class="interleaved-cell">
                          {#if model.properties.interleaved}
                            <span class="interleaved-badge"
                              >{model.properties.interleaved.field}</span
                            >
                          {:else}
                            -
                          {/if}
                        </td>
                      {/if}
                      {#if availableFields.find((f) => f.id === "knowledge")?.visible}
                        <td class="knowledge-cell"
                          >{model.properties.knowledge || "-"}</td
                        >
                      {/if}
                      {#if availableFields.find((f) => f.id === "id")?.visible}
                        <td class="id-cell">
                          <code class="model-id">{model.modelId}</code>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <footer class="site-footer min-h-[72px]">
    <div class="footer-meta">
      <span>{t.footerBuiltOn}</span>
      <a
        class="inline-flex min-h-[44px] items-center"
        href="https://github.com/anomalyco/models.dev"
        target="_blank"
        rel="noreferrer"
      >
        github.com/anomalyco/models.dev
      </a>
      {#if t.footerBuiltOnSuffix}
        <span>{t.footerBuiltOnSuffix}</span>
      {/if}
    </div>
    <div class="footer-meta">
      <span>{t.footerFriends}:</span>
      <a
        class="inline-flex min-h-[44px] items-center"
        href="https://onlinestool.com"
        target="_blank"
        rel="noreferrer">onlinestool.com</a
      >
    </div>
  </footer>
</div>

<style>
  :global(:root) {
    color-scheme: light;
    --fluent-accent: #0067b8;
    --fluent-accent-strong: #004e8c;
    --fluent-accent-soft: #d7ebff;
    --fluent-bg: #f5f7fb;
    --fluent-bg-strong: #eef2f8;
    --fluent-card: rgba(255, 255, 255, 0.86);
    --fluent-card-strong: rgba(255, 255, 255, 0.96);
    --fluent-border: rgba(15, 23, 42, 0.12);
    --fluent-text: #0f172a;
    --fluent-muted: #4b5563;
    --fluent-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
    --fluent-shadow-soft: 0 4px 16px rgba(15, 23, 42, 0.08);
    --fluent-ring: rgba(0, 103, 184, 0.3);
    --fluent-radius: 18px;
    --fluent-radius-sm: 12px;
    --fluent-radius-full: 999px;
    --fluent-font: "Segoe UI Variable", "Segoe UI", "Helvetica Neue",
      "Noto Sans", sans-serif;
    --fluent-mono: "Cascadia Code", "SFMono-Regular", Menlo, monospace;
    --fluent-hero: linear-gradient(
      120deg,
      rgba(255, 255, 255, 0.95),
      rgba(240, 248, 255, 0.9)
    );
    --fluent-table-head: rgba(255, 255, 255, 0.9);
  }

  :global([data-theme="dark"]) {
    color-scheme: dark;
    --fluent-accent: #4aa8ff;
    --fluent-accent-strong: #8cc8ff;
    --fluent-accent-soft: rgba(74, 168, 255, 0.18);
    --fluent-bg: #0b1220;
    --fluent-bg-strong: #0f172a;
    --fluent-card: rgba(15, 23, 42, 0.82);
    --fluent-card-strong: rgba(15, 23, 42, 0.95);
    --fluent-border: rgba(148, 163, 184, 0.18);
    --fluent-text: #e2e8f0;
    --fluent-muted: #94a3b8;
    --fluent-shadow: 0 20px 50px rgba(2, 6, 23, 0.5);
    --fluent-shadow-soft: 0 6px 18px rgba(2, 6, 23, 0.35);
    --fluent-ring: rgba(74, 168, 255, 0.35);
    --fluent-hero: linear-gradient(
      120deg,
      rgba(15, 23, 42, 0.95),
      rgba(10, 18, 32, 0.85)
    );
    --fluent-table-head: rgba(15, 23, 42, 0.92);
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
    overflow-x: hidden;
    background: var(--fluent-bg);
    color: var(--fluent-text);
    font-family: var(--fluent-font);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(body)::before,
  :global(body)::after {
    content: "";
    position: fixed;
    inset: -20%;
    pointer-events: none;
    z-index: -2;
  }

  :global(body)::before {
    background: radial-gradient(
        45% 45% at 15% 20%,
        rgba(0, 103, 184, 0.12),
        transparent 65%
      ),
      radial-gradient(
        40% 40% at 80% 10%,
        rgba(0, 120, 212, 0.14),
        transparent 60%
      ),
      radial-gradient(
        50% 60% at 80% 80%,
        rgba(0, 120, 212, 0.08),
        transparent 70%
      );
    filter: blur(10px);
  }

  :global(body)::after {
    background: linear-gradient(
        120deg,
        rgba(255, 255, 255, 0.4),
        transparent 40%
      ),
      linear-gradient(0deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
    background-size:
      auto,
      48px 48px,
      48px 48px;
    opacity: 0.6;
  }

  :global([data-theme="dark"] body)::after {
    background: linear-gradient(120deg, rgba(15, 23, 42, 0.5), transparent 40%),
      linear-gradient(0deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  }

  .container {
    width: 100%;
    min-height: 100vh;
    margin: 0 auto;
    padding: 2.5rem 20px 3.5rem;
    max-width: none;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    position: relative;
  }

  .hero {
    position: relative;
    padding: 2rem 2.25rem 1.75rem;
    border-radius: var(--fluent-radius);
    background: var(--fluent-hero);
    border: 1px solid var(--fluent-border);
    box-shadow: var(--fluent-shadow);
    overflow: hidden;
    animation: fluent-rise 500ms ease both;
  }

  .hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        120% 120% at 100% 0%,
        rgba(0, 103, 184, 0.14),
        transparent 60%
      ),
      linear-gradient(130deg, rgba(0, 103, 184, 0.08), transparent 55%);
    opacity: 0.9;
    pointer-events: none;
  }

  .header-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }

  .header-select select,
  .theme-toggle {
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-full);
    background: var(--fluent-card);
    color: var(--fluent-text);
    font-size: 0.85rem;
    font-weight: 500;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
  }

  .header-select select:focus-visible,
  .theme-toggle:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--fluent-ring);
  }

  .theme-toggle {
    cursor: pointer;
  }

  .theme-toggle:hover {
    border-color: var(--fluent-accent);
    background: var(--fluent-card-strong);
  }

  .hero h1 {
    margin: 0 0 0.75rem;
    font-size: clamp(2.2rem, 3vw, 3.2rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
    position: relative;
    z-index: 1;
  }

  .hero p {
    margin: 0;
    font-size: 1.02rem;
    color: var(--fluent-muted);
    line-height: 1.6;
    position: relative;
    z-index: 1;
  }

  .loading,
  .error,
  .no-results {
    text-align: center;
    padding: 4rem 2rem;
    font-size: 1rem;
    color: var(--fluent-muted);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 3px solid rgba(0, 103, 184, 0.2);
    border-top-color: var(--fluent-accent);
    animation: fluent-spin 1s linear infinite;
  }

  @keyframes fluent-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    color: #b42318;
  }

  .filters {
    display: block;
    column-count: 3;
    column-gap: 1.5rem;
    padding: 1.5rem;
    border-radius: var(--fluent-radius);
    background: var(--fluent-card);
    border: 1px solid var(--fluent-border);
    box-shadow: var(--fluent-shadow);
    font-size: 0.875rem;
    animation: fluent-rise 520ms ease both;
    position: relative;
    z-index: 1;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group {
    break-inside: avoid;
    padding: 0 0 1.25rem;
    margin: 0 0 1.25rem;
    border-bottom: 1px solid var(--fluent-border);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: transparent;
    box-shadow: none;
    animation: fluent-rise 420ms ease both;
    position: relative;
    z-index: 0;
  }

  .filter-group:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .filter-group:nth-child(1) {
    animation-delay: 40ms;
  }
  .filter-group:nth-child(2) {
    animation-delay: 80ms;
  }
  .filter-group:nth-child(3) {
    animation-delay: 120ms;
  }
  .filter-group:nth-child(4) {
    animation-delay: 160ms;
  }
  .filter-group:nth-child(5) {
    animation-delay: 200ms;
  }
  .filter-group:nth-child(6) {
    animation-delay: 240ms;
  }

  .filter-group-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--fluent-muted);
    font-weight: 600;
    line-height: 1.3;
  }

  .filter-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .filter-group-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-search,
  .filter-providers,
  .filter-cost,
  .filter-context,
  .filter-features,
  .filter-release,
  .filter-flags {
    width: 100%;
  }

  .filter-providers {
    position: relative;
  }

  .filter-cost {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .filter-cost-extended {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-input.compact,
  .provider-search,
  .date-input.compact,
  .sort-select {
    width: 100%;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-sm);
    font-size: 0.875rem;
    background: var(--fluent-card-strong);
    color: var(--fluent-text);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .search-input.compact::placeholder,
  .provider-search::placeholder {
    color: var(--fluent-muted);
  }

  .search-input.compact:focus,
  .provider-search:focus,
  .date-input.compact:focus,
  .sort-select:focus {
    outline: none;
    border-color: var(--fluent-accent);
    box-shadow: 0 0 0 3px var(--fluent-ring);
  }

  .dropdown-toggle.compact,
  .dropdown-toggle,
  .reset-btn,
  .field-selector-toggle,
  .sort-order-btn {
    padding: 0.55rem 1rem;
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-full);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    background: var(--fluent-card-strong);
    color: var(--fluent-text);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .dropdown-toggle.compact,
  .dropdown-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .dropdown-toggle.compact:hover,
  .dropdown-toggle:hover,
  .reset-btn:hover,
  .field-selector-toggle:hover,
  .sort-order-btn:hover {
    border-color: var(--fluent-accent);
    box-shadow: 0 6px 16px rgba(0, 103, 184, 0.12);
    transform: translateY(-1px);
  }

  .dropdown-toggle.compact:focus-visible,
  .dropdown-toggle:focus-visible,
  .reset-btn:focus-visible,
  .field-selector-toggle:focus-visible,
  .sort-order-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--fluent-ring);
  }

  .dropdown-arrow {
    font-size: 0.7rem;
  }

  .compact-range {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .compact-range.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .range-row {
    display: grid;
    grid-template-columns: minmax(110px, auto) 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .range-sub-label {
    color: var(--fluent-muted);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .compact-range input[type="range"] {
    width: 110px;
    height: 4px;
    cursor: pointer;
    accent-color: var(--fluent-accent);
  }

  .compact-range input[type="range"]:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .compact-range .range-label {
    color: var(--fluent-muted);
    font-weight: 600;
  }

  .compact-range .range-value {
    font-weight: 600;
    min-width: 50px;
    text-align: right;
    font-family: var(--fluent-mono);
    color: var(--fluent-text);
  }

  .free-checkbox,
  .feature-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.3rem 0.7rem;
    border-radius: var(--fluent-radius-full);
    background: var(--fluent-accent-soft);
    color: var(--fluent-accent-strong);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .free-checkbox.free-inline {
    white-space: nowrap;
  }

  .free-checkbox input,
  .feature-checkbox input {
    cursor: pointer;
    accent-color: var(--fluent-accent);
  }

  .feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .feature-tag {
    position: relative;
    padding: 0 0.875rem;
    height: 2.25rem;
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-full);
    background: transparent;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--fluent-muted);
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }

  .feature-tag.active {
    background: var(--fluent-accent-soft);
    border-color: var(--fluent-accent);
    color: var(--fluent-accent-strong);
  }

  .feature-tag.inactive {
    background: rgba(148, 163, 184, 0.1);
    border-color: transparent;
    color: var(--fluent-muted);
  }

  .provider-dropdown {
    position: relative;
    z-index: 50;
  }

  .dropdown-content {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: auto;
    min-width: 280px;
    max-width: 360px;
    background: var(--fluent-bg-strong);
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-sm);
    box-shadow: var(--fluent-shadow);
    z-index: 100;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(16px);
    animation: fluent-rise 180ms ease both;
  }

  .dropdown-actions,
  .field-selector-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--fluent-border);
    background: var(--fluent-bg-strong);
  }

  .action-btn {
    background: var(--fluent-accent);
    color: #ffffff;
    border: none;
    border-radius: var(--fluent-radius-full);
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 103, 184, 0.2);
  }

  .action-btn.small {
    padding: 0.35rem 0.75rem;
    font-size: 0.78rem;
  }

  .provider-search.compact {
    margin: 0.6rem;
    width: calc(100% - 1.2rem);
  }

  .dropdown-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .dropdown-empty {
    padding: 1rem;
    text-align: center;
    color: var(--fluent-muted);
    font-size: 0.9rem;
  }

  .dropdown-item,
  .field-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    transition: background 0.2s ease;
  }

  .dropdown-item:hover,
  .field-item:hover {
    background: rgba(0, 103, 184, 0.08);
  }

  .provider-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    width: 100%;
    user-select: none;
  }

  .provider-checkbox-label input[type="checkbox"] {
    cursor: pointer;
    accent-color: var(--fluent-accent);
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .field-item.visible span {
    font-weight: 600;
    color: var(--fluent-text);
  }

  .provider-name {
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .results {
    background: var(--fluent-card);
    border-radius: var(--fluent-radius);
    padding: 1.25rem;
    border: 1px solid var(--fluent-border);
    box-shadow: var(--fluent-shadow);
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    animation: fluent-rise 540ms ease both;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .results-title h2 {
    margin: 0;
    color: var(--fluent-text);
    font-size: 1.4rem;
    font-weight: 600;
  }

  .results-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .field-selector {
    position: relative;
  }

  .field-selector-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--fluent-card-strong);
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius-sm);
    box-shadow: var(--fluent-shadow);
    z-index: 100;
    min-width: 220px;
    max-height: 420px;
    overflow-y: auto;
    animation: fluent-rise 180ms ease both;
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  .no-results {
    background: var(--fluent-bg-strong);
    border-radius: var(--fluent-radius-sm);
    padding: 3rem;
    text-align: center;
  }

  .no-results h3 {
    margin: 0 0 0.5rem;
    color: var(--fluent-muted);
  }

  .no-results p {
    margin: 0;
    color: var(--fluent-muted);
  }

  .table-scroll-wrapper {
    position: relative;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    max-width: 100vw;
    overflow: hidden;
  }

  .table-container {
    width: 100%;
    max-width: 100%;
    overflow: auto;
    max-height: calc(100vh - 260px);
    border-radius: var(--fluent-radius-sm);
    background: transparent;
  }

  .models-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .models-table thead {
    background: var(--fluent-table-head);
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
  }

  .models-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--fluent-muted);
    border-bottom: 1px solid var(--fluent-border);
    white-space: nowrap;
  }

  .models-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: color 0.2s ease;
  }

  .models-table th.sortable:hover {
    color: var(--fluent-accent-strong);
  }

  .models-table tbody tr {
    border-bottom: 1px solid var(--fluent-border);
    transition: background 0.2s ease;
  }

  .models-table tbody tr:hover {
    background: rgba(0, 103, 184, 0.06);
  }

  .models-table td {
    padding: 0.75rem 1rem;
    vertical-align: middle;
  }

  .model-name-cell {
    min-width: 200px;
  }

  .model-name-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .model-name-content h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fluent-text);
  }

  .open-weights-badge-mini {
    background: var(--fluent-accent-soft);
    color: var(--fluent-accent-strong);
    padding: 0.125rem 0.5rem;
    border-radius: var(--fluent-radius-full);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .provider-cell {
    min-width: 150px;
  }

  .provider-tag {
    background: var(--fluent-bg-strong);
    color: var(--fluent-accent-strong);
    padding: 0.25rem 0.75rem;
    border-radius: var(--fluent-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-block;
  }

  .family-cell {
    min-width: 120px;
    color: var(--fluent-muted);
    font-size: 0.85rem;
  }

  .cost-cell {
    text-align: right;
    font-family: var(--fluent-mono);
    font-weight: 600;
    min-width: 100px;
    color: var(--fluent-accent-strong);
  }

  .context-cell,
  .output-cell {
    text-align: right;
    font-weight: 600;
    min-width: 100px;
  }

  .features-cell {
    min-width: 180px;
  }

  .features-list {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .feature-icon {
    font-size: 1.1rem;
    cursor: help;
    opacity: 0.8;
    transition: opacity 0.2s ease;
  }

  .feature-icon:hover {
    opacity: 1;
  }

  .date-cell,
  .knowledge-cell {
    min-width: 110px;
    font-size: 0.75rem;
    color: var(--fluent-muted);
  }

  .id-cell {
    min-width: 200px;
  }

  .model-id {
    font-size: 0.74rem;
    font-family: var(--fluent-mono);
    font-weight: 600;
    color: var(--fluent-muted);
    background: var(--fluent-bg-strong);
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
  }

  .bool-cell {
    text-align: center;
    min-width: 50px;
  }

  .bool-yes {
    color: var(--fluent-accent-strong);
    font-weight: 700;
  }

  .bool-no {
    color: var(--fluent-muted);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
    white-space: nowrap;
  }

  .interleaved-cell {
    min-width: 80px;
  }

  .interleaved-badge {
    background: var(--fluent-bg-strong);
    color: var(--fluent-text);
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .site-footer {
    margin-top: 2rem;
    padding: 1.5rem 1rem 2rem;
    text-align: center;
    background: var(--fluent-card);
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius);
    color: var(--fluent-muted);
    font-size: 0.875rem;
    box-shadow: var(--fluent-shadow-soft);
  }

  .site-footer .footer-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    line-height: 1.6;
  }

  .site-footer a {
    color: var(--fluent-accent-strong);
    text-decoration: none;
    font-weight: 600;
  }

  .site-footer a:hover {
    text-decoration: underline;
  }

  @keyframes fluent-rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 1200px) {
    .table-container {
      max-height: calc(100vh - 220px);
    }
    .filters {
      column-count: 2;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 1.5rem 1rem 2.5rem;
    }

    .hero {
      padding: 1.5rem;
    }

    .header-actions {
      justify-content: center;
    }

    .filters {
      column-count: 1;
      padding: 1rem;
    }

    .results {
      padding: 1rem;
    }

    .results-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .results-actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .sort-controls {
      width: 100%;
      flex-wrap: wrap;
    }

    .sort-select,
    .sort-order-btn,
    .field-selector-toggle,
    .reset-btn {
      width: 100%;
    }

    .models-table th,
    .models-table td {
      padding: 0.55rem 0.75rem;
      font-size: 0.75rem;
    }

    .table-container {
      max-height: calc(100vh - 200px);
    }
  }

  @media (min-width: 1600px) {
    .filters {
      column-count: 4;
    }
  }
</style>
