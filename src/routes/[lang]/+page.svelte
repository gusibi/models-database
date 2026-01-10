<script lang="ts">
   import { onMount } from 'svelte';
   import { goto } from '$app/navigation';
   import { defaultLang, getLanguageMeta, getTranslations, languages } from '$lib/i18n';
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
     type Model 
   } from '$lib/models';

   const props = $props();

   const lang = $derived(props.data?.lang ?? defaultLang);
   const t = $derived(getTranslations(lang));
   const locale = $derived(getLanguageMeta(lang).locale);

   let theme = $state('light');
   
   let models = $state<Model[]>([]);
   let loading = $state(true);
   let error = $state<string | null>(null);
   
    let allProviders = $state<{ id: string; name: string }[]>([]);
    let selectedProviders = $state<string[]>([]);
    let providerSearch = $state('');
    let providerDropdownOpen = $state(false);
    let providerDropdownButton = $state<HTMLButtonElement | null>(null);
    let providerDropdownStyle = $state<string>('');
   
  let maxInputCost = $state<number>(10);
  let maxOutputCost = $state<number>(10);
  let maxCacheReadCost = $state<number>(0);
  let maxCacheWriteCost = $state<number>(0);
  let maxReasoningCost = $state<number>(0);
  let maxInputAudioCost = $state<number>(0);
  let maxOutputAudioCost = $state<number>(0);
  let minContext = $state<number>(0);
  let minOutput = $state<number>(0);
  let minReleaseDate = $state('');

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
     temperature: null
   });

   let openWeightsOnly = $state(false);
   let freeOnly = $state(false);
   let knowledgeOnly = $state(false);
   let interleavedOnly = $state(false);
   let searchText = $state('');
   let sortBy = $state('name');
   let sortOrder = $state('asc');

   // 可显示的字段列表
   let availableFields = $state([
     { id: 'name', labelKey: 'tableName', name: 'Model', visible: true },
     { id: 'provider', labelKey: 'tableProvider', name: 'Provider', visible: true },
     { id: 'family', labelKey: 'tableFamily', name: 'Family', visible: true },
     { id: 'costInput', labelKey: 'sortInputCost', name: 'Input Cost', visible: true },
     { id: 'costOutput', labelKey: 'sortOutputCost', name: 'Output Cost', visible: true },
     { id: 'context', labelKey: 'tableContext', name: 'Context', visible: true },
     { id: 'output', labelKey: 'tableOutput', name: 'Output', visible: true },
     { id: 'cacheRead', labelKey: 'tableCacheRead', name: 'Cache Read', visible: true },
     { id: 'cacheWrite', labelKey: 'tableCacheWrite', name: 'Cache Write', visible: true },
     { id: 'reasoning', labelKey: 'tableReasoning', name: 'Reasoning Cost', visible: true },
     { id: 'features', labelKey: 'tableFeatures', name: 'Features', visible: true },
     { id: 'releaseDate', labelKey: 'tableReleased', name: 'Released', visible: true },
     { id: 'structuredOutput', labelKey: 'tableStruct', name: 'Structured', visible: true },
     { id: 'temperature', labelKey: 'tableTemp', name: 'Temp', visible: true },
     { id: 'interleaved', labelKey: 'tableInter', name: 'Interleaved', visible: true },
     { id: 'knowledge', labelKey: 'tableKnowledge', name: 'Knowledge', visible: true },
     { id: 'id', labelKey: 'tableId', name: 'ID', visible: false }
   ]);

   const getFieldLabel = (field: { labelKey: string; name: string }) =>
     (t as Record<string, string>)[field.labelKey] ?? field.name;

   let showFieldSelector = $state(false);
   let tableContainer = $state<HTMLDivElement | null>(null);
   let isSyncingScroll = $state(false);

   let filteredModels = $state<Model[]>([]);
   let displayModels = $state<Model[]>([]);

   $effect(() => {
     displayModels = sortModels(filteredModels);
   });

   function handleHorizontalScroll(e: Event) {
     const target = e.target as HTMLDivElement;
     if (isSyncingScroll) return;
     isSyncingScroll = true;
     setTimeout(() => isSyncingScroll = false, 10);
   }

   function applyTheme(nextTheme: 'light' | 'dark') {
     theme = nextTheme;
     document.documentElement.dataset.theme = nextTheme;
     localStorage.setItem('theme', nextTheme);
   }

   function toggleTheme() {
     applyTheme(theme === 'dark' ? 'light' : 'dark');
   }

   function handleLanguageChange(event: Event) {
     const target = event.target as HTMLSelectElement;
     if (!target.value || target.value === lang) return;
     goto(`/${target.value}`);
   }

   function formatTemplate(template: string | undefined, values: Record<string, string | number>) {
     if (!template) return '';
     return Object.entries(values).reduce(
       (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
       template
     );
   }

   function getProvidersCountLabel(selected: number, total: number) {
     return formatTemplate(t.providersCount, { selected, total });
   }

   function getResultsFoundLabel(count: number) {
     const template = count === 1 ? t.resultsFoundOne : t.resultsFoundMany;
     return formatTemplate(template, { count });
   }

   function getColumnsLabel(count: number) {
     return formatTemplate(t.columnsLabel, { count });
   }

   onMount(() => {
     const stored = localStorage.getItem('theme');
     if (stored === 'light' || stored === 'dark') {
       theme = stored;
     } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
       theme = 'dark';
     }
     document.documentElement.dataset.theme = theme;
   });
   
    function getMaxOptionalCost(key: keyof Model['properties']['cost']): number {
      if (models.length === 0) return 0;
      const values = models.map(model => {
        const val = model.properties.cost[key];
        return typeof val === 'number' ? val : 0;
      });
      return Math.max(...values, 0);
    }

    onMount(async () => {
      try {
        const data = await loadModels();
        models = getAllModels(data);
        allProviders = getUniqueProviders(data);
        console.log('Loaded providers:', allProviders.length, allProviders);
        selectedProviders = allProviders.map(p => p.id);

        const maxCost = getMaxCost(models);
        const maxCtx = getMaxContext(models);
        const maxOut = getMaxOutput(models);

        maxInputCost = maxCost.input;
        maxOutputCost = maxCost.output;
        minContext = 0;
        minOutput = 0;

        maxCacheReadCap = getMaxOptionalCost('cache_read');
        maxCacheWriteCap = getMaxOptionalCost('cache_write');
        maxReasoningCap = getMaxOptionalCost('reasoning');
        maxInputAudioCap = getMaxOptionalCost('input_audio');
        maxOutputAudioCap = getMaxOptionalCost('output_audio');

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
       providers: selectedProviders.length > 0 && selectedProviders.length < allProviders.length ? selectedProviders : undefined,
       maxInputCost: maxInputCost < getMaxCost(models).input ? maxInputCost : undefined,
       maxOutputCost: maxOutputCost < getMaxCost(models).output ? maxOutputCost : undefined,
       maxCacheRead: maxCacheReadCost < maxCacheReadCap ? maxCacheReadCost : undefined,
       maxCacheWrite: maxCacheWriteCost < maxCacheWriteCap ? maxCacheWriteCost : undefined,
       maxReasoningCost: maxReasoningCost < maxReasoningCap ? maxReasoningCost : undefined,
       maxInputAudioCost: maxInputAudioCost < maxInputAudioCap ? maxInputAudioCost : undefined,
       maxOutputAudioCost: maxOutputAudioCost < maxOutputAudioCap ? maxOutputAudioCost : undefined,
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
       searchText: searchText || undefined
     };

     const nextFiltered = filterModels(models, options);
     filteredModels = nextFiltered;
   }

   function resetFilters() {
     if (models.length === 0) return;
     const maxCost = getMaxCost(models);

     maxInputCost = maxCost.input;
     maxOutputCost = maxCost.output;
     maxCacheReadCost = maxCacheReadCap;
     maxCacheWriteCost = maxCacheWriteCap;
     maxReasoningCost = maxReasoningCap;
     maxInputAudioCost = maxInputAudioCap;
     maxOutputAudioCost = maxOutputAudioCap;
     minContext = 0;
     minOutput = 0;
     minReleaseDate = '';
     features = {
       vision: null,
       audio: null,
       video: null,
       code: null,
       reasoning: null,
       toolCall: null,
       openWeights: null,
       structuredOutput: null,
       temperature: null
     };
     openWeightsOnly = false;
     freeOnly = false;
     knowledgeOnly = false;
     interleavedOnly = false;
     searchText = '';
     providerSearch = '';
     selectedProviders = allProviders.map(p => p.id);
     providerDropdownOpen = false;
     showFieldSelector = false;

     applyFilters();
   }
   
   function toggleProvider(providerId: string) {
     if (selectedProviders.includes(providerId)) {
       selectedProviders = selectedProviders.filter(p => p !== providerId);
     } else {
       selectedProviders = [...selectedProviders, providerId];
     }
     applyFilters();
   }
   
   function toggleAllProviders() {
     if (selectedProviders.length === allProviders.length) {
       selectedProviders = [];
     } else {
       selectedProviders = allProviders.map(p => p.id);
     }
     applyFilters();
   }
   
   function sortModels(list: Model[]) {
     return [...list].sort((a, b) => {
       let aVal: number | string;
       let bVal: number | string;
       
       switch (sortBy) {
         case 'cost-input':
           aVal = a.properties.cost.input;
           bVal = b.properties.cost.input;
           break;
         case 'cost-output':
           aVal = a.properties.cost.output;
           bVal = b.properties.cost.output;
           break;
         case 'context':
           aVal = a.properties.limit.context;
           bVal = b.properties.limit.context;
           break;
         case 'output':
           aVal = a.properties.limit.output;
           bVal = b.properties.limit.output;
           break;
         case 'date':
           aVal = a.properties.releaseDate;
           bVal = b.properties.releaseDate;
           break;
         case 'name':
           aVal = a.name.toLowerCase();
           bVal = b.name.toLowerCase();
           break;
         case 'provider':
           aVal = a.provider.toLowerCase();
           bVal = b.provider.toLowerCase();
           break;
         case 'family':
           aVal = a.properties.family.toLowerCase();
           bVal = b.properties.family.toLowerCase();
           break;
         default:
           aVal = 0;
           bVal = 0;
       }
       
       const multiplier = sortOrder === 'asc' ? 1 : -1;
       
       if (typeof aVal === 'string' && typeof bVal === 'string') {
         return aVal.localeCompare(bVal) * multiplier;
       }
       
       return ((aVal as number) - (bVal as number)) * multiplier;
     });
   }
   
   function toggleSort(field: string) {
     if (sortBy === field) {
       sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
     } else {
       sortBy = field;
       sortOrder = 'asc';
     }
   }
   
    function toggleProviderDropdown() {
      providerDropdownOpen = !providerDropdownOpen;
      if (providerDropdownOpen && providerDropdownButton) {
        const rect = providerDropdownButton.getBoundingClientRect();
        providerDropdownStyle = `top: ${rect.bottom + 8}px; left: ${rect.left}px; width: ${Math.max(280, rect.width)}px;`;
      }
    }
   
   function selectAllProviders() {
     selectedProviders = allProviders.map(p => p.id);
     providerDropdownOpen = false;
     applyFilters();
   }
   
   function clearAllProviders() {
     selectedProviders = [];
     providerDropdownOpen = false;
     applyFilters();
   }

   function toggleFieldVisibility(fieldId: string) {
     availableFields = availableFields.map(f =>
       f.id === fieldId ? { ...f, visible: !f.visible } : f
     );
   }

   function showAllFields() {
     availableFields = availableFields.map(f => ({ ...f, visible: true }));
   }

   function hideAllFields() {
     availableFields = availableFields.map(f => ({ ...f, visible: false }));
   }

     const filteredProviders = $derived.by(() => {
       const result = allProviders.filter(p =>
         p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
         p.id.toLowerCase().includes(providerSearch.toLowerCase())
       );
       console.log('Filtered providers:', result.length, result);
       return result;
     });

  </script>

<div class="container">
  <header>
    <div class="header-actions">
      <label class="header-select">
        <span class="sr-only">{t.languageLabel}</span>
        <select value={lang} onchange={handleLanguageChange}>
          {#each languages as language}
            <option value={language.id}>{language.label}</option>
          {/each}
        </select>
      </label>
      <button class="theme-toggle" type="button" onclick={toggleTheme} aria-label={t.themeToggle}>
        {theme === 'dark' ? t.themeDark : t.themeLight}
      </button>
    </div>
    <h1>{t.headerTitle}</h1>
    <p>{t.headerSubtitle}</p>
    <p class="sr-only">{t.srDescription}</p>
  </header>
  
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{t.loading}</p>
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="filters">
      <div class="filter-group">
        <div class="filter-group-title">{t.groupSearch}</div>
        <div class="filter-group-body">
          <div class="filter-item filter-search">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              bind:value={searchText}
              class="search-input compact"
              oninput={applyFilters}
            />
          </div>
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">{t.groupProviders}</div>
        <div class="filter-group-body">
           <div class="filter-item filter-providers">
             <div class="provider-dropdown">
               <button bind:this={providerDropdownButton} class="dropdown-toggle compact" onclick={toggleProviderDropdown}>
                 <span>{getProvidersCountLabel(selectedProviders.length, allProviders.length)}</span>
                 <span class="dropdown-arrow">▼</span>
               </button>
               {#if providerDropdownOpen}
                 <div class="dropdown-content" style={providerDropdownStyle}>
                   <div class="dropdown-actions">
                     <button class="action-btn" onclick={selectAllProviders}>{t.labelAll}</button>
                     <button class="action-btn" onclick={clearAllProviders}>{t.labelNone}</button>
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
                         <label class="dropdown-item">
                           <input
                             type="checkbox"
                             checked={selectedProviders.includes(provider.id)}
                             onchange={() => toggleProvider(provider.id)}
                           />
                           <span class="provider-name">{provider.name}</span>
                         </label>
                       {/each}
                     {/if}
                   </div>
                 </div>
               {/if}
             </div>
           </div>
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">{t.groupPricing}</div>
        <div class="filter-group-body">
          <div class="filter-item filter-cost">
            <div class="compact-range stacked">
              <span class="range-label">{t.labelInputOutput}:</span>
              <div class="range-row">
                <span class="range-sub-label">{t.sortInputCost}</span>
                <input
                  type="range"
                  min="0"
                  max={getMaxCost(models).input}
                  step="0.01"
                  bind:value={maxInputCost}
                  title={t.sortInputCost}
                  oninput={applyFilters}
                />
                <span class="range-value">${maxInputCost.toFixed(2)}</span>
              </div>
              <div class="range-row">
                <span class="range-sub-label">{t.sortOutputCost}</span>
                <input
                  type="range"
                  min="0"
                  max={getMaxCost(models).output}
                  step="0.01"
                  bind:value={maxOutputCost}
                  title={t.sortOutputCost}
                  oninput={applyFilters}
                />
                <span class="range-value">${maxOutputCost.toFixed(2)}</span>
              </div>
              <label class="free-checkbox">
                <input type="checkbox" bind:checked={freeOnly} onchange={applyFilters} />
                <span>{t.freeLabel}</span>
              </label>
            </div>
          </div>

          <div class="filter-item filter-cost-advanced">
            <div class="compact-range">
              <span class="range-label">{t.labelCacheRead}:</span>
              <input
                type="range"
                min="0"
                max={maxCacheReadCap}
                step="0.0001"
                bind:value={maxCacheReadCost}
                disabled={maxCacheReadCap === 0}
                oninput={applyFilters}
              />
              <span class="range-value">{formatCost(maxCacheReadCost, t.freeLabel)}</span>
            </div>
            <div class="compact-range">
              <span class="range-label">{t.labelCacheWrite}:</span>
              <input
                type="range"
                min="0"
                max={maxCacheWriteCap}
                step="0.0001"
                bind:value={maxCacheWriteCost}
                disabled={maxCacheWriteCap === 0}
                oninput={applyFilters}
              />
              <span class="range-value">{formatCost(maxCacheWriteCost, t.freeLabel)}</span>
            </div>
            <div class="compact-range">
              <span class="range-label">{t.labelReasoning}:</span>
              <input
                type="range"
                min="0"
                max={maxReasoningCap}
                step="0.0001"
                bind:value={maxReasoningCost}
                disabled={maxReasoningCap === 0}
                oninput={applyFilters}
              />
              <span class="range-value">{formatCost(maxReasoningCost, t.freeLabel)}</span>
            </div>
            <div class="compact-range">
              <span class="range-label">{t.labelAudioIn}:</span>
              <input
                type="range"
                min="0"
                max={maxInputAudioCap}
                step="0.0001"
                bind:value={maxInputAudioCost}
                disabled={maxInputAudioCap === 0}
                oninput={applyFilters}
              />
              <span class="range-value">{formatCost(maxInputAudioCost, t.freeLabel)}</span>
            </div>
            <div class="compact-range">
              <span class="range-label">{t.labelAudioOut}:</span>
              <input
                type="range"
                min="0"
                max={maxOutputAudioCap}
                step="0.0001"
                bind:value={maxOutputAudioCost}
                disabled={maxOutputAudioCap === 0}
                oninput={applyFilters}
              />
              <span class="range-value">{formatCost(maxOutputAudioCost, t.freeLabel)}</span>
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
                  max={getMaxContext(models)}
                  step="1000"
                  bind:value={minContext}
                  oninput={applyFilters}
                />
                <span class="range-value">{formatNumber(minContext)}</span>
              </div>
              <div class="range-row">
                <span class="range-sub-label">{t.tableOutput}</span>
                <input
                  type="range"
                  min="0"
                  max={getMaxOutput(models)}
                  step="1000"
                  bind:value={minOutput}
                  oninput={applyFilters}
                />
                <span class="range-value">{formatNumber(minOutput)}</span>
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
                onclick={() => { features.vision = features.vision === true ? false : features.vision === false ? null : true; applyFilters(); }}
              >
              {t.featureVision}
            </button>
              <button
                class="feature-tag"
                class:active={features.audio === true}
                class:inactive={features.audio === false}
                onclick={() => { features.audio = features.audio === true ? false : features.audio === false ? null : true; applyFilters(); }}
              >
              {t.featureAudio}
            </button>
              <button
                class="feature-tag"
                class:active={features.video === true}
                class:inactive={features.video === false}
                onclick={() => { features.video = features.video === true ? false : features.video === false ? null : true; applyFilters(); }}
              >
              {t.featureVideo}
            </button>
              <button
                class="feature-tag"
                class:active={features.code === true}
                class:inactive={features.code === false}
                onclick={() => { features.code = features.code === true ? false : features.code === false ? null : true; applyFilters(); }}
              >
              {t.featureCode}
            </button>
              <button
                class="feature-tag"
                class:active={features.reasoning === true}
                class:inactive={features.reasoning === false}
                onclick={() => { features.reasoning = features.reasoning === true ? false : features.reasoning === false ? null : true; applyFilters(); }}
              >
              {t.featureReasoning}
            </button>
              <button
                class="feature-tag"
                class:active={features.toolCall === true}
                class:inactive={features.toolCall === false}
                onclick={() => { features.toolCall = features.toolCall === true ? false : features.toolCall === false ? null : true; applyFilters(); }}
              >
              {t.featureTool}
            </button>
              <button
                class="feature-tag"
                class:active={features.structuredOutput === true}
                class:inactive={features.structuredOutput === false}
                onclick={() => { features.structuredOutput = features.structuredOutput === true ? false : features.structuredOutput === false ? null : true; applyFilters(); }}
              >
              {t.featureStruct}
            </button>
              <button
                class="feature-tag"
                class:active={features.temperature === true}
                class:inactive={features.temperature === false}
                onclick={() => { features.temperature = features.temperature === true ? false : features.temperature === false ? null : true; applyFilters(); }}
              >
              {t.featureTemp}
            </button>
            <label class="feature-checkbox">
              <input type="checkbox" bind:checked={openWeightsOnly} onchange={applyFilters} />
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
            <label class="range-label" for="release-date">{t.labelReleasedAfter}:</label>
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
              <input type="checkbox" bind:checked={knowledgeOnly} onchange={applyFilters} />
              <span>{t.labelHasKnowledge}</span>
            </label>
            <label class="feature-checkbox">
              <input type="checkbox" bind:checked={interleavedOnly} onchange={applyFilters} />
              <span>{t.labelInterleaved}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="results">
      <div class="results-header">
        <div class="results-title">
          <h2>{getResultsFoundLabel(displayModels.length)}</h2>
        </div>
        <div class="results-actions">
          <div class="field-selector">
            <button class="field-selector-toggle" onclick={() => showFieldSelector = !showFieldSelector}>
              <span class="field-icon">⚙</span>
              <span>{getColumnsLabel(availableFields.filter(f => f.visible).length)}</span>
              <span class="dropdown-arrow">{showFieldSelector ? '▲' : '▼'}</span>
            </button>
            {#if showFieldSelector}
              <div class="field-selector-dropdown">
                <div class="field-selector-actions">
                  <button class="action-btn small" onclick={showAllFields}>{t.showAll}</button>
                  <button class="action-btn small" onclick={hideAllFields}>{t.hideAll}</button>
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
          <button class="reset-btn" type="button" onclick={resetFilters}>
            {t.resetFilters}
          </button>
          <div class="sort-controls">
            <select class="sort-select" bind:value={sortBy}>
              <option value="name">{t.sortName}</option>
              <option value="provider">{t.sortProvider}</option>
              <option value="family">{t.sortFamily}</option>
              <option value="cost-input">{t.sortInputCost}</option>
              <option value="cost-output">{t.sortOutputCost}</option>
              <option value="context">{t.sortContext}</option>
              <option value="date">{t.sortReleaseDate}</option>
            </select>
            <button class="sort-order-btn" onclick={() => {
              sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            }}>
              {sortOrder === 'asc' ? `↓ ${t.sortAsc}` : `↑ ${t.sortDesc}`}
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
                  {#if availableFields.find(f => f.id === 'name')?.visible}
                    <th class="sortable" onclick={() => toggleSort('name')}>
                      {t.tableName} {#if sortBy === 'name'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'provider')?.visible}
                    <th class="sortable" onclick={() => toggleSort('provider')}>
                      {t.tableProvider} {#if sortBy === 'provider'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'family')?.visible}
                    <th class="sortable" onclick={() => toggleSort('family')}>
                      {t.tableFamily} {#if sortBy === 'family'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'costInput')?.visible}
                    <th class="sortable" onclick={() => toggleSort('cost-input')}>
                      {t.tableInput} {#if sortBy === 'cost-input'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'costOutput')?.visible}
                    <th class="sortable" onclick={() => toggleSort('cost-output')}>
                      {t.tableOutput} {#if sortBy === 'cost-output'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'context')?.visible}
                    <th class="sortable" onclick={() => toggleSort('context')}>
                      {t.tableContext} {#if sortBy === 'context'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'output')?.visible}
                    <th>{t.tableOutput}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'cacheRead')?.visible}
                    <th>{t.tableCacheRead}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'cacheWrite')?.visible}
                    <th>{t.tableCacheWrite}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'reasoning')?.visible}
                    <th>{t.tableReasoning}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'features')?.visible}
                    <th>{t.tableFeatures}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'releaseDate')?.visible}
                    <th class="sortable" onclick={() => toggleSort('date')}>
                      {t.tableReleased} {#if sortBy === 'date'}{sortOrder === 'asc' ? '↓' : '↑'}{/if}
                    </th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'structuredOutput')?.visible}
                    <th>{t.tableStruct}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'temperature')?.visible}
                    <th>{t.tableTemp}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'interleaved')?.visible}
                    <th>{t.tableInter}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'knowledge')?.visible}
                    <th>{t.tableKnowledge}</th>
                  {/if}
                  {#if availableFields.find(f => f.id === 'id')?.visible}
                    <th>{t.tableId}</th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each displayModels as model (model.id)}
                  <tr class="model-row">
                    {#if availableFields.find(f => f.id === 'name')?.visible}
                      <td class="model-name-cell">
                        <div class="model-name-content">
                          <h4>{model.name}</h4>
                          {#if model.properties.features.openWeights}
                            <span class="open-weights-badge-mini">{t.featureOpen}</span>
                          {/if}
                        </div>
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'provider')?.visible}
                      <td class="provider-cell">
                        <span class="provider-tag">{model.provider}</span>
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'family')?.visible}
                      <td class="family-cell">{model.properties.family}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'costInput')?.visible}
                      <td class="cost-cell input-cost">{formatCost(model.properties.cost.input, t.freeLabel)}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'costOutput')?.visible}
                      <td class="cost-cell output-cost">{formatCost(model.properties.cost.output, t.freeLabel)}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'context')?.visible}
                      <td class="context-cell">{formatNumber(model.properties.limit.context)}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'output')?.visible}
                      <td class="output-cell">{formatNumber(model.properties.limit.output)}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'cacheRead')?.visible}
                      <td class="cost-cell">{model.properties.cost.cache_read ? formatCost(model.properties.cost.cache_read, t.freeLabel) : '-'}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'cacheWrite')?.visible}
                      <td class="cost-cell">{model.properties.cost.cache_write ? formatCost(model.properties.cost.cache_write, t.freeLabel) : '-'}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'reasoning')?.visible}
                      <td class="cost-cell">{model.properties.cost.reasoning ? formatCost(model.properties.cost.reasoning, t.freeLabel) : '-'}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'features')?.visible}
                      <td class="features-cell">
                        <div class="features-list">
                          {#if model.properties.features.vision}
                            <span class="feature-icon vision" title={t.featureVision}>👁️</span>
                          {/if}
                          {#if model.properties.features.audio}
                            <span class="feature-icon audio" title={t.featureAudio}>🔊</span>
                          {/if}
                          {#if model.properties.features.video}
                            <span class="feature-icon video" title={t.featureVideo}>🎬</span>
                          {/if}
                          {#if model.properties.features.code}
                            <span class="feature-icon code" title={t.featureCode}>💻</span>
                          {/if}
                          {#if model.properties.features.reasoning}
                            <span class="feature-icon reasoning" title={t.featureReasoning}>🧠</span>
                          {/if}
                          {#if model.properties.features.toolCall}
                            <span class="feature-icon tool-call" title={t.featureTool}>🔧</span>
                          {/if}
                        </div>
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'releaseDate')?.visible}
                      <td class="date-cell">{formatDate(model.properties.releaseDate, locale)}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'structuredOutput')?.visible}
                      <td class="bool-cell">
                        {#if model.properties.features.structuredOutput}
                          <span class="bool-yes">✓</span>
                        {:else}
                          <span class="bool-no">-</span>
                        {/if}
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'temperature')?.visible}
                      <td class="bool-cell">
                        {#if model.properties.features.temperature}
                          <span class="bool-yes">✓</span>
                        {:else}
                          <span class="bool-no">-</span>
                        {/if}
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'interleaved')?.visible}
                      <td class="interleaved-cell">
                        {#if model.properties.interleaved}
                          <span class="interleaved-badge">{model.properties.interleaved.field}</span>
                        {:else}
                          -
                        {/if}
                      </td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'knowledge')?.visible}
                      <td class="knowledge-cell">{model.properties.knowledge || '-'}</td>
                    {/if}
                    {#if availableFields.find(f => f.id === 'id')?.visible}
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

  <footer class="site-footer">
    <div class="footer-meta">
      <span>{t.footerBuiltOn}</span>
      <a href="https://github.com/anomalyco/models.dev" target="_blank" rel="noreferrer">
        github.com/anomalyco/models.dev
      </a>
      {#if t.footerBuiltOnSuffix}
        <span>{t.footerBuiltOnSuffix}</span>
      {/if}
    </div>
    <div class="footer-meta">
      <span>{t.footerFriends}:</span>
      <a href="https://onlinestool.com" target="_blank" rel="noreferrer">onlinestool.com</a>
    </div>
  </footer>
</div>

<style>
  :global(:root) {
    color-scheme: light;
    --bg: #ffffff;
    --text: #1a1a1a;
    --muted: #666666;
    --muted-strong: #495057;
    --surface: #ffffff;
    --surface-alt: #f8f9fa;
    --border: #e9ecef;
    --border-strong: #dee2e6;
    --primary: #007bff;
    --primary-strong: #0056b3;
    --success: #28a745;
    --success-bg: #e8f5e9;
    --success-bg-strong: #c8e6c9;
    --danger: #dc3545;
    --danger-bg: #f8d7da;
    --warning-bg: #fff3cd;
    --warning-text: #856404;
    --info-bg: #e3f2fd;
    --info-text: #1976d2;
    --table-hover: #f8f9fa;
    --shadow: rgba(0, 0, 0, 0.15);
    --shadow-strong: rgba(0, 0, 0, 0.2);
    --icon-muted: #9ca3af;
    --focus-shadow: rgba(0, 123, 255, 0.1);
  }

  :global([data-theme='dark']) {
    color-scheme: dark;
    --bg: #0f1115;
    --text: #e6e9ef;
    --muted: #a7b0be;
    --muted-strong: #c1c7d2;
    --surface: #151a22;
    --surface-alt: #11161d;
    --border: #2a323d;
    --border-strong: #343e4a;
    --primary: #59a5ff;
    --primary-strong: #2e7fe6;
    --success: #6dd38c;
    --success-bg: #1f3328;
    --success-bg-strong: #29513a;
    --danger: #ff7a7a;
    --danger-bg: #3b1f24;
    --warning-bg: #3b2f1c;
    --warning-text: #f5d08a;
    --info-bg: #1c2b3c;
    --info-text: #84b9ff;
    --table-hover: #1a2230;
    --shadow: rgba(0, 0, 0, 0.4);
    --shadow-strong: rgba(0, 0, 0, 0.6);
    --icon-muted: #7d8796;
    --focus-shadow: rgba(89, 165, 255, 0.2);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    background: var(--bg);
    color: var(--text);
  }

  .container {
    width: 100vw;
    min-height: 100vh;
    margin: 0;
    padding: 1rem 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }
  
  header {
    margin-bottom: 2rem;
    text-align: center;
    padding: 0 1rem;
    position: relative;
  }

  .header-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .header-select select {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
  }

  .theme-toggle {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .theme-toggle:hover {
    border-color: var(--primary);
    background: var(--surface-alt);
  }
  
  header h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
    color: var(--text);
  }
  
  header p {
    color: var(--muted);
    margin: 0;
    font-size: 1.1rem;
  }
  
  .loading, .error, .no-results {
    text-align: center;
    padding: 4rem 2rem;
    font-size: 1.2rem;
    color: var(--muted);
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-strong);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error {
    color: var(--danger);
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    padding: 1rem;
    background: var(--surface-alt);
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .filter-group-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    font-weight: 600;
  }

  .filter-group-body {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .filter-search {
    width: 100%;
  }

  .filter-providers {
    position: relative;
  }

  .filter-cost,
  .filter-context,
  .filter-features,
  .filter-release,
  .filter-flags {
    width: 100%;
  }

  .filter-cost-advanced {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .search-input.compact {
    width: 100%;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--surface);
    color: var(--text);
  }

  .search-input.compact:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-shadow);
  }

  .dropdown-toggle.compact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    color: var(--text);
  }

  .dropdown-toggle.compact:hover {
    background: var(--surface-alt);
  }

  .compact-range {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
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
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .compact-range input[type="range"] {
    width: 110px;
    height: 4px;
    cursor: pointer;
  }

  .compact-range input[type="range"]:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .compact-range .range-label {
    color: var(--muted);
    font-weight: 500;
  }

  .compact-range .range-value {
    font-weight: 600;
    min-width: 50px;
    text-align: right;
    font-family: 'Courier New', monospace;
    color: var(--text);
  }

  .compact-range .range-divider {
    color: var(--icon-muted);
    margin: 0 0.2rem;
  }

  .free-checkbox {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: 0.5rem;
    background: var(--success-bg);
    border-radius: 4px;
    color: var(--success);
  }

  .free-checkbox:hover {
    background: var(--success-bg-strong);
  }

  .free-checkbox input {
    cursor: pointer;
  }

  .feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }

  .feature-tag {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text);
  }

  .feature-tag:hover {
    border-color: var(--primary);
  }

  .feature-tag.active {
    background: var(--success);
    border-color: var(--success);
    color: #ffffff;
  }

  .feature-tag.inactive {
    background: var(--danger-bg);
    border-color: var(--danger);
    color: var(--danger);
  }

  .feature-checkbox {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: 0.5rem;
  }

  .feature-checkbox input {
    cursor: pointer;
  }

  .provider-dropdown {
    position: relative;
  }
  
  .dropdown-toggle {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
  }
  
  .dropdown-toggle:hover {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-shadow);
  }
  
  .dropdown-arrow {
    font-size: 0.7rem;
    transition: transform 0.2s;
  }
  
  .dropdown-content {
    position: fixed;
    top: auto;
    left: auto;
    min-width: 280px;
    max-width: 400px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: 0 4px 20px var(--shadow);
    z-index: 1000;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .dropdown-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-strong);
    background: var(--surface-alt);
  }
  
  .action-btn {
    background: var(--primary);
    color: #ffffff;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .action-btn:hover {
    background: var(--primary-strong);
  }
  
  .provider-search {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    font-size: 0.85rem;
    margin: 0 0.5rem;
    width: calc(100% - 1rem);
    background: var(--surface);
    color: var(--text);
  }

  .provider-search.compact {
    margin: 0.5rem;
    width: calc(100% - 1rem);
  }

  .date-input.compact {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--surface);
    color: var(--text);
  }

  .dropdown-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .dropdown-empty {
    padding: 1rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .dropdown-item:hover {
    background: var(--surface-alt);
  }
  
  .dropdown-item input {
    cursor: pointer;
  }
  
  
  .provider-name {
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .range-value {
    text-align: right;
    font-weight: 600;
    color: var(--text);
    font-size: 0.9rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.95rem;
    background: var(--surface);
    color: var(--text);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-shadow);
  }

  .results {
    background: var(--surface);
    border-radius: 0;
    padding: 0 1rem;
    border: none;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
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
    color: var(--text);
    font-size: 1.5rem;
  }

  .results-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reset-btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    background: var(--surface-alt);
    border-color: var(--primary);
  }

  .field-selector {
    position: relative;
  }

  .field-selector-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .field-selector-toggle:hover {
    background: var(--surface-alt);
    border-color: var(--primary);
  }

  .field-icon {
    font-size: 1rem;
  }

  .field-selector-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: 0 4px 20px var(--shadow);
    z-index: 100;
    min-width: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .field-selector-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-strong);
    background: var(--surface-alt);
  }

  .field-list {
    padding: 0.5rem 0;
  }

  .field-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .field-item:hover {
    background: var(--surface-alt);
  }

  .field-item.visible span {
    font-weight: 500;
    color: var(--text);
  }

  .field-item input {
    cursor: pointer;
  }

  .action-btn.small {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  .sort-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 0.9rem;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    flex-shrink: 0;
  }
  
  .sort-order-btn {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .sort-order-btn:hover {
    background: var(--surface-alt);
    border-color: var(--primary);
  }

  .no-results {
    background: var(--surface-alt);
    border-radius: 8px;
    padding: 3rem;
    text-align: center;
  }

  .no-results h3 {
    margin: 0 0 0.5rem 0;
    color: var(--muted-strong);
  }

  .no-results p {
    margin: 0;
    color: var(--muted);
  }

  .table-scroll-wrapper {
    position: relative;
    margin: 0;
    padding: 0 1rem;
    box-sizing: border-box;
    width: 100%;
    max-width: 100vw;
    overflow: hidden;
  }

  .table-container {
    width: 100%;
    max-width: 100%;
    overflow: auto;
    max-height: calc(100vh - 250px);
    border: 1px solid var(--border-strong);
    border-radius: 8px 8px 0 0;
  }

  .models-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .models-table thead {
    background: var(--surface-alt);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .models-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--muted-strong);
    border-bottom: 2px solid var(--border-strong);
    white-space: nowrap;
  }

  .models-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .models-table th.sortable:hover {
    background: var(--surface-alt);
  }

  .models-table tbody tr {
    border-bottom: 1px solid var(--border-strong);
    transition: background 0.15s;
  }

  .models-table tbody tr:hover {
    background: var(--table-hover);
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
    color: var(--text);
  }
  
  .open-weights-badge-mini {
    background: var(--success-bg);
    color: var(--success);
    padding: 0.15rem 0.4rem;
    border-radius: 10px;
    font-size: 0.65rem;
    font-weight: 600;
  }
  
  .provider-cell {
    min-width: 150px;
  }
  
  .provider-tag {
    background: var(--info-bg);
    color: var(--info-text);
    padding: 0.25rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    display: inline-block;
  }
  
  .family-cell {
    min-width: 120px;
    color: var(--muted);
    font-size: 0.85rem;
  }
  
  .cost-cell {
    text-align: right;
    font-family: 'Courier New', monospace;
    font-weight: 600;
    min-width: 100px;
  }
  
  .cost-cell.input-cost {
    color: var(--primary);
  }
  
  .cost-cell.output-cost {
    color: var(--success);
  }
  
  .context-cell {
    text-align: right;
    font-weight: 500;
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
    transition: opacity 0.2s;
  }
  
  .feature-icon:hover {
    opacity: 1;
  }
  
  .date-cell {
    min-width: 110px;
    font-size: 0.8rem;
    color: var(--muted-strong);
  }
  
  .knowledge-cell {
    min-width: 100px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  
  .id-cell {
    min-width: 200px;
  }
  
  .model-id {
    font-size: 0.7rem;
    color: var(--icon-muted);
    background: var(--surface-alt);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
  }
  
  .output-cell {
    text-align: right;
    font-weight: 500;
    min-width: 80px;
  }

  .bool-cell {
    text-align: center;
    min-width: 50px;
  }

  .bool-yes {
    color: var(--success);
    font-weight: bold;
  }

  .bool-no {
    color: var(--icon-muted);
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
    background: var(--warning-bg);
    color: var(--warning-text);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .site-footer {
    margin-top: 2rem;
    padding: 1.5rem 1rem 2rem;
    text-align: center;
    background: var(--surface-alt);
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.85rem;
  }

  .site-footer .footer-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    line-height: 1.6;
  }

  .site-footer a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
  }

  .site-footer a:hover {
    text-decoration: underline;
  }

  @media (max-width: 1200px) {
    .table-scroll-wrapper {
      padding: 0 0.5rem;
    }
  }

  @media (max-width: 768px) {
    .header-actions {
      justify-content: center;
    }

    .filters {
      grid-template-columns: 1fr;
      padding: 0.75rem;
      gap: 0.75rem;
    }

    .filter-item {
      width: 100%;
    }

    .feature-tags {
      justify-content: flex-start;
    }

    .results {
      padding: 0 0.5rem;
    }

    .results-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .results-actions {
      width: 100%;
      flex-direction: column;
      align-items: flex-start;
    }

    .sort-controls {
      width: 100%;
      flex-wrap: nowrap;
    }

    .sort-select, .sort-order-btn {
      width: 100%;
    }

    .models-table th,
    .models-table td {
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
    }

    .model-name-content h4 {
      font-size: 0.85rem;
    }

    .table-container {
      max-height: calc(100vh - 200px);
    }
  }
</style>
