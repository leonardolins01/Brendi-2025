import { config } from "dotenv";
import readline from "readline";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

import { describeCSVSchema } from "./llm/describeCSV";
import { generateQuery } from "./llm/generateQuery";
import { generateNaturalAnswer } from "./llm/generateNaturalAnswer";
import { getDuckDB } from "./dataUtils/duckdbClient";

// Schema de análise gramatical (pode ser mantido para debug/testes)
const grammarSchema = z.object({
  subject: z.string().describe("The subject of the sentence"),
  verb: z.string().describe("The verb of the sentence"),
  object: z.string().describe("The object of the sentence")
});

// Função para carregar todos os CSVs como tabelas no DuckDB
async function loadAllCSVsToDuckDB(): Promise<void> {
  const datasetDir = path.join(__dirname, "datasets");
  const files = await fs.readdir(datasetDir);
  const csvFiles = files.filter((file) => file.endsWith(".csv"));

  const db = getDuckDB();
  const conn = db.connect();

  for (const file of csvFiles) {
    const tableName = path.basename(file, ".csv");
    const fullPath = path.join(datasetDir, file);

    console.log(`📥 Carregando ${file} como tabela '${tableName}'`);

    await new Promise<void>((resolve, reject) => {
      conn.run(
        `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${fullPath}', HEADER=true);`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  conn.close();
}

// Função principal
async function run() {
  config();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  // 1. Carrega o schema das tabelas CSV
  console.log("🔍 Gerando descrição dos CSVs...");
  const csvSchema = await describeCSVSchema();
  console.log("📄 Schema das tabelas carregado.\n");

  // 2. Carrega os CSVs no DuckDB
  await loadAllCSVsToDuckDB();
  console.log("✅ Todos os CSVs foram carregados no banco DuckDB.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async function readUserInput() {
    rl.question("❓ Pergunte algo sobre os dados (ou digite 'sair'): ", async (message) => {
      if (message.toLowerCase() === "sair") {
        rl.close();
        return;
      }

      try {
        // 3. Gera a query SQL a partir da pergunta
        const sql = await generateQuery({ schema: csvSchema, question: message });
        console.log("\n🧠 Query SQL gerada:");
        console.log(sql);

        // 4. Executa a query
        const db = getDuckDB();
        const conn = db.connect();

        const rows: any[] = await new Promise((resolve, reject) => {
          conn.all(sql, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        conn.close();

        console.log("\n📊 Resultado da query:");
        console.table(rows);

        // 5. Extrai o nome da tabela usada (assumindo 1 tabela por enquanto)
        const match = sql.match(/from\s+(\w+)/i);
        if (!match) throw new Error("Não foi possível extrair o nome da tabela.");
        const tableName = match[1];

        // 6. Gera resposta natural
        const naturalAnswer = await generateNaturalAnswer({
          schema: csvSchema[tableName],
          question: message,
          queryResult: rows
        });

        console.log("\n🗣️ Resposta natural:");
        console.log(naturalAnswer);

      } catch (err) {
        if (err instanceof Error) {
          console.error("❌ Erro:", err.message);
        } else {
          console.error("❌ Erro desconhecido:", err);
        }
      }

      readUserInput();
    });
  }

  readUserInput();
}

run();
