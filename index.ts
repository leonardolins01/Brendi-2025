import { config } from "dotenv";
import readline from "readline";
import path from "path";
import fs from "fs/promises";
import { describeCSVSchema } from "./llm/describeCSV";
import { generateQuery } from "./llm/generateQuery";
import { generateNaturalAnswer } from "./llm/generateNaturalAnswer";
import { getDuckDB } from "./dataUtils/duckdbClient";

// Carrega todos os CSVs como tabelas no DuckDB
async function loadAllCSVsToDuckDB(): Promise<void> {
  const datasetDir = path.join(__dirname, "datasets");
  const files = await fs.readdir(datasetDir);
  const csvFiles = files.filter((file) => file.endsWith(".csv"));

  const db = getDuckDB();
  const conn = db.connect();

  for (const file of csvFiles) {
    const tableName = path.basename(file, ".csv");
    const fullPath = path.join(datasetDir, file);

    await new Promise<void>((resolve, reject) => {
      conn.run(
        `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${fullPath}', HEADER=true);`,
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  conn.close();
}

// Função principal
async function run() {
  config();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is required");

  const csvSchema = await describeCSVSchema();
  // console.log("Schema CSV:", JSON.stringify(csvSchema, null, 2));

  await loadAllCSVsToDuckDB();

  console.log("🔍 Seu assistente de dados está no ar 🚀");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async function readUserInput() {
    rl.question("Pergunte algo sobre os dados (ou digite 'sair'): ", async (message) => {
      if (message.toLowerCase() === "sair") {
        rl.close();
        return;
      }

      try {
        const sql = await generateQuery({ schema: csvSchema, question: message });

        if (sql === "erro") {
          console.log("Infelizmente, não posso te ajudar com isso. Tente reformular sua pergunta com base nos dados.");
          return readUserInput();
        }


        const db = getDuckDB();
        const conn = db.connect();

        const rows: any[] = await new Promise((resolve, reject) => {
          conn.all(sql, (err, result) => (err ? reject(err) : resolve(result)));
        });

        conn.close();

        const match = sql.match(/from\s+(\w+)/i);
        if (!match) throw new Error("Não foi possível extrair o nome da tabela.");
        const tableName = match[1];

        const naturalAnswer = await generateNaturalAnswer({           schema: csvSchema[tableName],
          question: message,
          queryResult: rows
        });

        console.log(naturalAnswer);
      } catch (err) {
        if (err instanceof Error) {
          console.error("Erro:", err.message);
        } else {
          console.error("Erro desconhecido:", err);
        }
      }

      readUserInput();
    });
  }

  readUserInput();
}

run();
