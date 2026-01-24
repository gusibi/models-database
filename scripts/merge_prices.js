import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pricesDir = path.join(__dirname, '..', 'prices');

// Read all JSON files from prices directory
const files = fs.readdirSync(pricesDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const filePath = path.join(pricesDir, f);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return content;
  });

// Flatten all models with provider info
const allModels = files.flatMap(provider => {
  return provider.models.map(model => ({
    provider: provider.provider,
    url: provider.url,
    currency: provider.currency,
    retrieved_at: provider.retrieved_at || provider.retrieved_at,
    ...model
  }));
});

// Write merged JSON
fs.writeFileSync(
  path.join(__dirname, '..', 'prices.json'),
  JSON.stringify(allModels, null, 2),
  'utf8'
);

// Write CSV
const headers = ['provider', 'model', 'pricing_type', 'input_price', 'output_price', 'cache_price', 'price', 'price_unit', 'context_length', 'currency', 'retrieved_at'];
const csvRows = [headers.join(',')];
for (const model of allModels) {
  const row = headers.map(h => {
    const val = model[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
    return val;
  });
  csvRows.push(row.join(','));
}
fs.writeFileSync(
  path.join(__dirname, '..', 'prices.csv'),
  csvRows.join('\n'),
  'utf8'
);

console.log(`Merged ${files.length} providers with ${allModels.length} models`);
console.log(`Output: prices.json and prices.csv`);
