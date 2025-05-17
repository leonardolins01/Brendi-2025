// lib/llm/describeCSV.ts
import fs from 'fs/promises';
import path from 'path';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Define o tipo do schema que a IA deve retornar
export type TableSchema = Record<string, Record<string, string>>;

const tableSchemaZod = z.record(z.record(z.string())); // <-- Schema Zod correto

export async function describeCSVSchema(): Promise<TableSchema> {
  const datasetDir = path.join(process.cwd(), 'datasets');
  const files = await fs.readdir(datasetDir);
  const csvFiles = files.filter(file => file.endsWith('.csv'));

  const tableDescriptions: Record<string, string[]> = {};

  for (const file of csvFiles) {
    const filePath = path.join(datasetDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const [headerLine] = content.split(/\r?\n/);
    const headers = headerLine.split(',').map(h => h.trim());
    const tableName = path.basename(file, '.csv');
    tableDescriptions[tableName] = headers;
  }

  const prompt = Object.entries(tableDescriptions)
    .map(([table, columns]) => `${table}.csv: ${columns.join(', ')}`)
    .join('\n');

  const systemPrompt = `
Você é um assistente que interpreta arquivos CSV e gera um JSON que descreve tabelas e colunas.
Dado um conjunto de arquivos CSV, cada um com nome e colunas, sua tarefa é gerar um JSON que descreva as tabelas,
utilizando o nome do arquivo (sem extensão) como chave, e mapeando cada coluna para uma breve descrição da mesma.

Regras:
- Use o nome do arquivo (sem ".csv") como chave da tabela.
- Para cada coluna, forneça uma descrição curta e direta do que ela representa.
- A saída deve ser um único JSON válido e bem formatado, sem explicações extras.
`.trim();

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: prompt.trim(),
    output: "no-schema", // ✅ Aqui está o ponto importante
  });

  return object as TableSchema;

}
