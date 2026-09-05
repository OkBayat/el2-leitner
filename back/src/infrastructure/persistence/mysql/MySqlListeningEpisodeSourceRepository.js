import { MySqlCollectionSourceRepository } from "./MySqlCollectionSourceRepository.js";
import { seedListeningLessons } from "./seedListeningLessons.js";

/** A catalog is validated before entering this transaction. Missing files never imply deletion. */
export class MySqlListeningEpisodeSourceRepository {
  constructor(pool, { collectionRepository = new MySqlCollectionSourceRepository(pool), seed = seedListeningLessons } = {}) {
    this.pool = pool;
    this.collections = collectionRepository;
    this.seed = seed;
  }

  async sync(sources) {
    const connection = await this.pool.getConnection();
    let locked = false;
    try {
      const [rows] = await connection.execute(
        "SELECT GET_LOCK(SHA2(CONCAT(DATABASE(), ':listening-episodes'), 256), 30) AS acquired"
      );
      locked = Number(rows[0]?.acquired) === 1;
      if (!locked) throw new Error("Another deployment is synchronizing listening episodes. Retry the deployment.");
      await connection.beginTransaction();
      let changedCollections = 0;
      for (const source of sources) {
        const result = await this.collections.sync(source.collection, { connection });
        if (result.changed) changedCollections += 1;
      }
      const result = await this.seed({ pool: this.pool, connection, definitions: sources.map((source) => source.definition) });
      await connection.commit();
      return { ...result, changedCollections };
    } catch (error) {
      if (locked) await connection.rollback();
      throw error;
    } finally {
      try {
        if (locked) await connection.execute("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(), ':listening-episodes'), 256))");
      } finally { connection.release(); }
    }
  }
}
