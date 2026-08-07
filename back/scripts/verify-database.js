import { config as loadEnvironment } from "dotenv";
import mysql from "mysql2/promise";

loadEnvironment({ path: new URL("../.env", import.meta.url), quiet: true });
loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function verify() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    connectionLimit: 2
  });
  try {
    const [seedRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM collection_entries ce
       JOIN collections c ON c.id = ce.collection_id
       WHERE c.public_id = 'ielts-listening-core-1500' AND ce.removed_at IS NULL`
    );
    if (Number(seedRows[0].total) !== 1500) {
      throw new Error(`Expected 1500 active IELTS entries, found ${seedRows[0].total}.`);
    }

    const [legacyRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM learning_states ls
       LEFT JOIN user_state_revisions usr ON usr.user_id = ls.user_id
       WHERE usr.user_id IS NULL`
    );
    if (Number(legacyRows[0].total) !== 0) {
      throw new Error(`${legacyRows[0].total} legacy learning state(s) have not been normalized.`);
    }

    const [duplicateRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM (
         SELECT collection_id, vocabulary_entry_id
         FROM collection_entries
         WHERE removed_at IS NULL
         GROUP BY collection_id, vocabulary_entry_id
         HAVING COUNT(*) > 1
       ) duplicates`
    );
    if (Number(duplicateRows[0].total) !== 0) {
      throw new Error("Duplicate active collection memberships were found.");
    }

    console.info("Database verification passed: seed, migration coverage, and active membership invariants are valid.");
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
});
