import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

function sanitizeResult(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

export async function generateNaturalAnswer({
  schema,
  question,
  queryResult
}: {
  schema: Record<string, string>;
  question: string;
  queryResult: any[];
}): Promise<string> {
  const systemPrompt = `
Você é um assistente que ajuda o usuário a entender resultados de dados.

Sua função é receber:
1. O schema da tabela (nomes e descrições dos campos)
2. A pergunta do usuário
3. O resultado de uma consulta SQL (em formato JSON)

E retornar uma resposta textual curta, agradável e compreensível, como se estivesse explicando para alguém leigo.

Regras:
- Seja direto, claro e conciso.
- Use português natural.
- Não inclua explicações técnicas.
- Não mencione "SQL", "tabela", "query", etc.
`.trim();

  const userPrompt = `
Esquema da tabela:
${JSON.stringify(schema, null, 2)}

Pergunta original:
${question}

Resultado da consulta:
${JSON.stringify(sanitizeResult(queryResult), null, 2)}
`.trim();

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 300
  });

  return text.trim();
}
