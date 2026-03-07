import { base } from '$app/paths';
import type { Model, ModelData, RawProvider, RawModel, FilterOptions } from './types';

export type { Model, ModelData, FilterOptions };

let modelsData: ModelData | null = null;

export async function loadModels(): Promise<ModelData> {
  if (modelsData) return modelsData;

  const url = import.meta.env.PUBLIC_MODELS_URL ?? `${base}/models.json`;

  // 添加日期字符串参数（YYYY-MM-DD格式），保证每天至少更新一次缓存，解决 R2 等默认缓存问题
  const dateStr = new Date().toISOString().split('T')[0];
  const fetchUrl = url.includes('?') ? `${url}&t=${dateStr}` : `${url}?t=${dateStr}`;

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Failed to load models: ${response.status}`);
  const data: ModelData = await response.json();
  modelsData = data;
  return modelsData;
}

export function getAllModels(data: ModelData): Model[] {
  const models: Model[] = [];

  for (const [providerId, provider] of Object.entries(data)) {
    for (const model of Object.values(provider.models)) {
      const family = model.family || 'unknown';
      const modalities = model.modalities || { input: [], output: [] };
      const uniqueId = `${providerId}-${model.id}`;

      models.push({
        provider: provider.name,
        providerId: provider.id,
        id: uniqueId,
        modelId: model.id,
        name: model.name,
        description: `${family} model${model.reasoning ? ' with reasoning' : ''}${model.attachment ? ' with vision capabilities' : ''}`,
        properties: {
          cost: model.cost || { input: 0, output: 0 },
          limit: model.limit || { context: 0, output: 0 },
          modalities: modalities,
          features: {
            vision: !!model.attachment,
            audio: modalities.input.includes('audio') || modalities.output.includes('audio'),
            video: modalities.input.includes('video'),
            code: family.includes('coder') || family.includes('code'),
            reasoning: !!model.reasoning,
            toolCall: !!model.tool_call,
            openWeights: !!model.open_weights,
            structuredOutput: !!model.structured_output,
            temperature: !!model.temperature
          },
          knowledge: model.knowledge,
          releaseDate: model.release_date || '',
          lastUpdated: model.last_updated || '',
          family: family,
          interleaved: model.interleaved
        }
      });
    }
  }

  return models;
}

export function getModelsByProvider(data: ModelData, providerId: string): Model[] {
  const provider = data[providerId];
  if (!provider) return [];

  return getAllModels({ [providerId]: provider });
}

export function getUniqueProviders(data: ModelData): { id: string; name: string }[] {
  if (!data) return [];
  return Object.entries(data).map(([key, p]) => ({
    id: p?.id ?? key,
    name: p?.name ?? key
  }));
}

export function filterModels(models: Model[], options: FilterOptions): Model[] {
  return models.filter(model => {
    if (options.providers && options.providers.length > 0) {
      if (!options.providers.includes(model.providerId)) return false;
    }

    if (options.maxInputCost !== undefined) {
      if (model.properties.cost.input > options.maxInputCost) return false;
    }

    if (options.maxOutputCost !== undefined) {
      if (model.properties.cost.output > options.maxOutputCost) return false;
    }

    if (options.maxCacheRead !== undefined) {
      if ((model.properties.cost.cache_read ?? 0) > options.maxCacheRead) return false;
    }

    if (options.maxCacheWrite !== undefined) {
      if ((model.properties.cost.cache_write ?? 0) > options.maxCacheWrite) return false;
    }

    if (options.maxReasoningCost !== undefined) {
      if ((model.properties.cost.reasoning ?? 0) > options.maxReasoningCost) return false;
    }

    if (options.maxInputAudioCost !== undefined) {
      if ((model.properties.cost.input_audio ?? 0) > options.maxInputAudioCost) return false;
    }

    if (options.maxOutputAudioCost !== undefined) {
      if ((model.properties.cost.output_audio ?? 0) > options.maxOutputAudioCost) return false;
    }

    if (options.minContext !== undefined) {
      if (model.properties.limit.context < options.minContext) return false;
    }

    if (options.minOutput !== undefined) {
      if (model.properties.limit.output < options.minOutput) return false;
    }

    if (options.openWeightsOnly) {
      if (!model.properties.features.openWeights) return false;
    }

    if (options.freeOnly) {
      // 筛选免费模型：input 和 output 都为 0
      if (model.properties.cost.input !== 0 || model.properties.cost.output !== 0) return false;
    }

    if (options.features) {
      const feats = model.properties.features;
      // Only include features that are explicitly set (true or false)
      // If feature is true, model must have it
      // If feature is false, model must NOT have it
      for (const [key, value] of Object.entries(options.features)) {
        if (value !== undefined) {
          const featKey = key as keyof typeof feats;
          if (feats[featKey] !== value) return false;
        }
      }
    }

    if (options.minDate) {
      if (!model.properties.releaseDate || model.properties.releaseDate < options.minDate) return false;
    }

    if (options.knowledgeOnly) {
      if (!model.properties.knowledge) return false;
    }

    if (options.interleavedOnly) {
      if (!model.properties.interleaved) return false;
    }

    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      const searchableText = `${model.name} ${model.provider} ${model.properties.family}`.toLowerCase();
      if (!searchableText.includes(searchLower)) return false;
    }

    return true;
  });
}

export function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(dateStr: string, locale = 'en-US'): string {
  try {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatCost(cost: number, freeLabel = 'Free'): string {
  return cost === 0 ? freeLabel : `$${cost.toFixed(4)}`;
}

export function getMaxCost(models: Model[]): { input: number; output: number } {
  if (models.length === 0) return { input: 0, output: 0 };
  const maxInput = Math.max(...models.map(m => m.properties.cost.input));
  const maxOutput = Math.max(...models.map(m => m.properties.cost.output));
  return { input: maxInput, output: maxOutput };
}

export function getMaxContext(models: Model[]): number {
  if (models.length === 0) return 0;
  return Math.max(...models.map(m => m.properties.limit.context));
}

export function getMaxOutput(models: Model[]): number {
  if (models.length === 0) return 0;
  return Math.max(...models.map(m => m.properties.limit.output));
}
