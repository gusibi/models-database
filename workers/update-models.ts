export default {
  async scheduled(
    _event: ScheduledEvent,
    env: { MODELS_BUCKET: R2Bucket },
    _ctx: ExecutionContext
  ) {
    const response = await fetch('https://models.dev/api.json', {
      headers: { 'User-Agent': 'models-page-cron' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const text = await response.text();

    // Validate JSON before uploading to R2.
    JSON.parse(text);

    await env.MODELS_BUCKET.put('models/models.json', text, {
      httpMetadata: { contentType: 'application/json' }
    });
  }
};
