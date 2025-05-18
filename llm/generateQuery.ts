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

Regras:
- Analise com atenção o schema JSON fornecido antes de construir a query. Se houver dúvidas sobre os campos mencionados na pergunta, tente reinterpretar com base nas descrições do schema.
- Sempre que possível, utilize JOINs para substituir identificadores (como id_restaurante) por nomes legíveis (como nome do restaurante).
- Prefira apresentar nomes (como do cliente, restaurante ou categoria) em vez de IDs.
- As datas no banco estão no formato "YYYY-MM-DD". Por isso, se a pergunta mencionar um mês (ex: "fevereiro"), use o número do mês (ex: 02) para filtrar os dados.
- Se a pergunta não for relacionada aos dados fornecidos, responda com: "Essa pergunta não é sobre os dados fornecidos."

**Exemplo**:
SELECT COUNT(*) FROM pedidos_comida WHERE nome_usuario = 'João' AND restaurante = 'Marmitaria Boa Vida';

Não inclua explicações ou formatações extras. Apenas a query SQL.

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

  const cleaned = text.trim().replace(/```sql|```/g, ''); // limpa blocos de código se vierem
  const lower = cleaned.toLowerCase();
  if (
    lower.includes("essa pergunta não é sobre os dados fornecidos") ||
    !lower.includes("select") ||
    !lower.includes("from")
  ) {
    return "erro";
  }

  return cleaned
}
