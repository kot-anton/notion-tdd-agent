/**
 * OpenAI DALL-E 3 image generation provider.
 * Uses Node 18+ native fetch — no extra dependency required.
 */

export interface OpenAiImageResult {
  url: string;
}

export async function generateOpenAiImage(
  prompt: string,
  apiKey: string,
): Promise<OpenAiImageResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { data: Array<{ url: string }> };
  const url = data.data[0]?.url;
  if (!url) throw new Error('OpenAI returned no image URL');

  return { url };
}
