export interface ModelCost {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
  input_audio?: number;
  output_audio?: number;
  reasoning?: number;
  free?: boolean;
}

export interface ModelLimit {
  context: number;
  output: number;
}

export interface ModelModalities {
  input: string[];
  output: string[];
}

export interface RawModel {
  id: string;
  name: string;
  family: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  structured_output?: boolean;
  temperature: boolean;
  knowledge?: string;
  release_date: string;
  last_updated: string;
  modalities: ModelModalities;
  open_weights: boolean;
  cost: ModelCost;
  limit: ModelLimit;
  interleaved?: {
    field: string;
  };
}

export interface RawProvider {
  id: string;
  env: string[];
  npm: string;
  api: string;
  name: string;
  doc: string;
  models: {
    [modelId: string]: RawModel;
  };
}

export interface ModelData {
  [providerId: string]: RawProvider;
}

export interface ModelFeatures {
  vision: boolean;
  audio: boolean;
  video: boolean;
  code: boolean;
  reasoning: boolean;
  toolCall: boolean;
  openWeights: boolean;
  structuredOutput: boolean;
  temperature: boolean;
}

export interface ModelProperties {
  cost: ModelCost;
  limit: ModelLimit;
  modalities: ModelModalities;
  features: ModelFeatures;
  knowledge?: string;
  releaseDate: string;
  lastUpdated: string;
  family: string;
  interleaved?: {
    field: string;
  };
}

export interface Model {
  provider: string;
  providerId: string;
  id: string;
  modelId: string;
  name: string;
  description: string;
  properties: ModelProperties;
}

export interface FilterOptions {
  providers?: string[];
  maxInputCost?: number;
  maxOutputCost?: number;
  maxCacheRead?: number;
  maxCacheWrite?: number;
  maxReasoningCost?: number;
  maxInputAudioCost?: number;
  maxOutputAudioCost?: number;
  minContext?: number;
  minOutput?: number;
  features?: {
    vision?: boolean;
    audio?: boolean;
    video?: boolean;
    code?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    openWeights?: boolean;
    structuredOutput?: boolean;
    temperature?: boolean;
  };
  openWeightsOnly?: boolean;
  freeOnly?: boolean;
  minDate?: string;
  knowledgeOnly?: boolean;
  interleavedOnly?: boolean;
  searchText?: string;
}
