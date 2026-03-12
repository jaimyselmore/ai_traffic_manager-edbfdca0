// ===== HAIKU ROUTER =====
// Detecteert de intent van een bericht met een snelle, goedkope Haiku-call.
// Resultaat: CHAT | PLAN | QUERY — bepaalt welke prompt en tools Ellen krijgt.

import { Intent } from './_types.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ROUTER_MODEL = 'anthropic/claude-haiku-4-5';

export async function detectIntent(bericht: string, apiKey: string): Promise<Intent> {
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://selmore.nl',
        'X-Title': 'Ellen Router',
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        max_tokens: 15,
        messages: [
          {
            role: 'system',
            content: `Classificeer de intentie. Antwoord ALLEEN met één woord: CHAT, PLAN, of QUERY.
- PLAN: nieuw project plannen, planning maken voor een klant, fases inplannen
- QUERY: informatie opvragen, zoeken, beschikbaarheid checken, rapportage (zonder iets te wijzigen)
- CHAT: taak verplaatsen/wijzigen/verwijderen/toevoegen, of algemene vraag aan Ellen`,
          },
          { role: 'user', content: bericht },
        ],
      }),
    });

    if (!response.ok) return 'CHAT';
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim().toUpperCase() || '';
    if (raw.includes('PLAN')) return 'PLAN';
    if (raw.includes('QUERY')) return 'QUERY';
    return 'CHAT';
  } catch {
    return 'CHAT'; // Veilige default bij fout
  }
}
