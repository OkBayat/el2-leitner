import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";
import { MySqlLearningStateRepository } from "../src/infrastructure/persistence/mysql/MySqlLearningStateRepository.js";
import { repairHistoricalBoxFiveProgress } from "../src/infrastructure/persistence/mysql/repairHistoricalBoxFiveProgress.js";
import { repairLegacyAliasProgress } from "../src/infrastructure/persistence/mysql/repairLegacyAliasProgress.js";
import { seedBuiltInLibrary } from "../src/infrastructure/persistence/mysql/seedBuiltInLibrary.js";

const DEFAULT_RETRIES = 30;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DATABASE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;
const APPLICATION_USER_HOST = "%";
const MIGRATIONS_DIRECTORY = new URL("../database/migrations/", import.meta.url);
const IELTS_SOURCE = new URL("../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url);

for (const environmentFile of [
  new URL("../.env", import.meta.url),
  new URL("../../.env", import.meta.url)
]) {
  loadEnvironment({ path: fileURLToPath(environmentFile), quiet: true });
}

const requiredEnvironmentVariable = (name, { trim = true } = {}) => {
  const rawValue = process.env[name];
  const value = trim ? rawValue?.trim() : rawValue;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const positiveInteger = (value, fallback, name) => {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

const configuration = () => {
  const database = requiredEnvironmentVariable("DB_NAME");
  const appUser = requiredEnvironmentVariable("DB_USER");
  const adminUser = requiredEnvironmentVariable("DB_ADMIN_USER");
  if (database.length > 64 || !DATABASE_IDENTIFIER_PATTERN.test(database)) {
    throw new Error("DB_NAME must contain only letters, numbers, or underscores and be at most 64 characters");
  }
  if (appUser.length > 32) throw new Error("DB_USER must be at most 32 characters");
  if (appUser === adminUser) throw new Error("DB_USER must be different from DB_ADMIN_USER");
  const port = positiveInteger(process.env.DB_PORT, 3306, "DB_PORT");
  if (port > 65_535) throw new Error("DB_PORT must be between 1 and 65535");
  return {
    host: process.env.DB_HOST?.trim() || "127.0.0.1",
    port,
    database,
    appUser,
    appPassword: requiredEnvironmentVariable("DB_PASSWORD", { trim: false }),
    adminUser,
    adminPassword: requiredEnvironmentVariable("DB_ADMIN_PASSWORD", { trim: false }),
    retries: positiveInteger(process.env.DB_CONNECT_RETRIES, DEFAULT_RETRIES, "DB_CONNECT_RETRIES"),
    retryDelayMs: positiveInteger(process.env.DB_CONNECT_RETRY_MS, DEFAULT_RETRY_DELAY_MS, "DB_CONNECT_RETRY_MS"),
    connectionLimit: positiveInteger(process.env.DB_CONNECTION_LIMIT, 10, "DB_CONNECTION_LIMIT")
  };
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const connectWithRetry = async (connectionOptions, retries, retryDelayMs) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await mysql.createConnection({ ...connectionOptions, connectTimeout: 10_000 });
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      console.info(`Database is not ready (attempt ${attempt}/${retries}); retrying in ${retryDelayMs}ms`);
      await delay(retryDelayMs);
    }
  }
  throw new Error(`Could not connect to MySQL after ${retries} attempts`, { cause: lastError });
};

async function runMigrations(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(128) NOT NULL,
      checksum CHAR(64) NOT NULL,
      executed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (version)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  const files = (await readdir(fileURLToPath(MIGRATIONS_DIRECTORY)))
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort((left, right) => left.localeCompare(right, "en"));
  const [appliedRows] = await connection.query("SELECT version, checksum FROM schema_migrations");
  const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));

  for (const file of files) {
    const sql = await readFile(new URL(file, MIGRATIONS_DIRECTORY), "utf8");
    const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        throw new Error(`Migration ${file} has changed after it was applied.`);
      }
      continue;
    }
    console.info(`Applying migration ${file}`);
    await connection.query(sql);
    await connection.execute(
      "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
      [file, checksum]
    );
  }
}

async function setupDatabase() {
  const config = configuration();
  const commonConnectionOptions = { host: config.host, port: config.port };
  const adminConnection = await connectWithRetry(
    {
      ...commonConnectionOptions,
      user: config.adminUser,
      password: config.adminPassword,
      multipleStatements: true
    },
    config.retries,
    config.retryDelayMs
  );

  try {
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await adminConnection.query(`USE \`${config.database}\``);
    await runMigrations(adminConnection);

    const account = [config.appUser, APPLICATION_USER_HOST];
    await adminConnection.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [...account, config.appPassword]);
    await adminConnection.query("ALTER USER ?@? IDENTIFIED BY ?", [...account, config.appPassword]);
    await adminConnection.query("REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@?", account);
    await adminConnection.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${config.database}\`.* TO ?@?`,
      account
    );
  } finally {
    await adminConnection.end();
  }

  const applicationPool = mysql.createPool({
    ...commonConnectionOptions,
    user: config.appUser,
    password: config.appPassword,
    database: config.database,
    connectionLimit: config.connectionLimit
  });

  try {
    const sourceText = await readFile(IELTS_SOURCE, "utf8");
    const seedResult = await seedBuiltInLibrary({
      pool: applicationPool,
      sourceText,
      parser: new VocabularyFileParser()
    });
    if (seedResult.changed) console.info(`Seeded ${seedResult.total} IELTS library entries.`);

    const learningRepository = new MySqlLearningStateRepository(applicationPool);
    const migrated = await learningRepository.migrateAllLegacyStates();
    if (migrated) console.info(`Migrated ${migrated} legacy learning state(s) to normalized tables.`);

    const repaired = await repairLegacyAliasProgress(applicationPool);
    if (repaired.repairedUsers) {
      console.info(
        `Reconciled ${repaired.repairedGroups} duplicate alias group(s) across ${repaired.repairedUsers} legacy learner(s).`
      );
    }

    const boxFiveRepair = await repairHistoricalBoxFiveProgress(applicationPool);
    if (boxFiveRepair.repairedUsers) {
      console.info(
        `Repaired box-five mastery for ${boxFiveRepair.mastered} mastered card(s) and ${boxFiveRepair.pendingCorrected} pending card(s) across ${boxFiveRepair.repairedUsers} learner(s).`
      );
    }

    await applicationPool.query("SELECT 1 FROM users LIMIT 0");
    await applicationPool.query("SELECT 1 FROM collections LIMIT 0");
    await applicationPool.query("SELECT 1 FROM user_vocabulary_progress LIMIT 0");
    await applicationPool.query("SELECT 1 FROM sentences LIMIT 0");
  } finally {
    await applicationPool.end();
  }

  console.info(`Database '${config.database}' is ready`);
}

setupDatabase().catch((error) => {
  console.error("Database setup failed:", error.message);
  process.exitCode = 1;
});
