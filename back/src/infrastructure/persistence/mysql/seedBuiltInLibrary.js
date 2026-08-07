import { createHash } from "node:crypto";
import { MySqlLibraryRepository } from "./MySqlLibraryRepository.js";

export const IELTS_COLLECTION_ID = "ielts-listening-core-1500";

export async function seedBuiltInLibrary({ pool, sourceText, parser }) {
  const sourceHash = createHash("sha256").update(sourceText, "utf8").digest("hex");
  const [rows] = await pool.execute(
    "SELECT id, source_hash FROM collections WHERE public_id = ? LIMIT 1",
    [IELTS_COLLECTION_ID]
  );

  if (!rows[0]) {
    await pool.execute(
      `INSERT INTO collections
         (public_id, slug, title, description, kind, visibility, status, content_version,
          source_hash, is_default, published_at, metadata_json)
       VALUES (?, ?, '1500 IELTS Listening Words',
         '۱۵۰۰ مورد منبع که پس از یکی‌سازی املاهای هم‌ارز، به واژه‌های یکتای IELTS Listening تبدیل می‌شوند.',
         'exam', 'public', 'published', 0, NULL, TRUE, CURRENT_TIMESTAMP(3),
         JSON_OBJECT('language', 'en', 'spelling', 'British'))`,
      [IELTS_COLLECTION_ID, IELTS_COLLECTION_ID]
    );
  } else if (rows[0].source_hash === sourceHash) {
    await pool.execute(
      `UPDATE collections
       SET is_default = TRUE, visibility = 'public', status = 'published', archived_at = NULL,
           published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3))
       WHERE public_id = ?`,
      [IELTS_COLLECTION_ID]
    );
    return { changed: false, sourceHash };
  }

  const parsed = parser.parse(sourceText);
  const repository = new MySqlLibraryRepository(pool);
  const result = await repository.importEntries(IELTS_COLLECTION_ID, parsed, "replace");
  await pool.execute(
    `UPDATE collections
     SET source_hash = ?, is_default = TRUE, visibility = 'public', status = 'published',
         published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3)),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.sourceItemCount', CAST(? AS UNSIGNED),
           '$.uniqueVocabularyCount', CAST(? AS UNSIGNED),
           '$.duplicateAliasCount', CAST(? AS UNSIGNED)
         )
     WHERE public_id = ?`,
    [
      sourceHash,
      parsed.sourceItemCount,
      parsed.entries.length,
      parsed.duplicateCount,
      IELTS_COLLECTION_ID
    ]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM collection_entries ce
     JOIN collections c ON c.id = ce.collection_id
     WHERE c.public_id = ? AND ce.removed_at IS NULL`,
    [IELTS_COLLECTION_ID]
  );
  const total = Number(countRows[0].total);
  if (total !== parsed.entries.length) {
    throw new Error(`Built-in library seed verification failed: expected ${parsed.entries.length}, found ${total}.`);
  }
  return {
    changed: true,
    sourceHash,
    sourceItemCount: parsed.sourceItemCount,
    duplicateCount: parsed.duplicateCount,
    total,
    ...result
  };
}
