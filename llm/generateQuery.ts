import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function generateQuery({
  schema,
  question
}: {
  schema: Record<string, Record<string, string>>;
  question: string;
}): Promise<string> {
  const systemPrompt = `
Você é um assistente de dados. Sua tarefa é gerar uma query SQL para uma ou mais tabelas com base em uma pergunta em linguagem natural.

Você receberá:
1. Um JSON que descreve o schema de todas as tabelas (nomes das colunas e o que significam).
2. Uma pergunta do usuário.

Responda com **apenas uma query SQL compatível com DuckDB**, em uma única linha. Use nomes de colunas exatamente como fornecidos no schema.

**Exemplo**:
SELECT COUNT(*) FROM pedidos_comida WHERE nome_usuario = 'João' AND restaurante = 'Marmitaria Boa Vida';

Não inclua explicações ou formatações extras. Apenas a query SQL.

Regras adicionais:
- Sempre que possível, utilize JOINs para obter nomes legíveis em vez de identificadores numéricos.
- Por exemplo, se o resultado envolve "id_restaurante", substitua por "nome" da tabela "restaurantes", se disponível.
- Prefira exibir nomes (como nome do restaurante, cliente, ou categoria) em vez de IDs.

`.trim();

  const userPrompt = `
Tabelas disponíveis (com schema):
${JSON.stringify(schema, null, 2)}

Pergunta: ${question}
`.trim();

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 300
  });

  return text.trim().replace(/```sql|```/g, ''); // limpa blocos de código se vierem
}
