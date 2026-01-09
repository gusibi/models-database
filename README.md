# AI Model Selector

An interactive AI model comparison and selection tool, deployed on Cloudflare Pages.

## Features

- **Comprehensive Model Database**: Browse AI models from various providers
- **Advanced Filtering**: Filter models by:
  - Provider
  - Cost (input/output per 1M tokens)
  - Context window size
  - Features (Vision, Audio, Video, Code, Reasoning, Tool Call)
  - Open weights availability
  - Release date
- **Sorting Options**: Sort by cost, context size, release date, or name
- **Search**: Search by model name or provider
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Development

```bash
npm install
npm run dev
```

Visit http://localhost:5173 to see the application.

## Building

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Deploying to Cloudflare Pages

### Option 1: Using Cloudflare Dashboard (Recommended)

1. Go to Cloudflare Dashboard > Workers & Pages
2. Click "Create application" > "Pages" > "Upload Assets"
3. Or use "Connect to Git" and connect your repository
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `.svelte-kit/cloudflare`
   - Node.js version: `20`

### Option 2: Using Wrangler CLI

First, install Wrangler:
```bash
npm install -g wrangler
```

Login to Cloudflare:
```bash
wrangler login
```

Deploy:
```bash
npm run build
wrangler pages deploy .svelte-kit/cloudflare
```

### Option 3: Automatic Deployment from Git

Connect your repository to Cloudflare Pages through the dashboard with these settings:
- **Build command**: `npm run build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Node.js version**: `20`

## Project Structure

- `src/routes/+page.svelte` - Main page with model list and filters
- `src/lib/models.ts` - Model data processing and filtering logic
- `src/lib/types.ts` - TypeScript type definitions
- `static/models.json` - Raw model data

## Supported Providers

- Moonshot AI (China & International)
- LucidQuery AI
- Z.AI Coding Plan
- Ollama Cloud
- Xiaomi
- Alibaba (Qwen)
- xAI (Grok)
- And more...

## Data Source

Model data is loaded from `static/models.json`, which contains comprehensive information about various AI models including:
- Pricing (input/output costs, cache costs)
- Capabilities (context window, max output)
- Features (vision, audio, video, code, reasoning, tool calling)
- Release information
- Provider details

## License

MIT
