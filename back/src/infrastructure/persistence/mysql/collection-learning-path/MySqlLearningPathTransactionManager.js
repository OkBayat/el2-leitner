import { LearningPathTransactionManager } from "../../../../application/collection-learning-path/ports/LearningPathTransactionManager.js";

export class MySqlLearningPathTransactionManager extends LearningPathTransactionManager {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async execute(work) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
