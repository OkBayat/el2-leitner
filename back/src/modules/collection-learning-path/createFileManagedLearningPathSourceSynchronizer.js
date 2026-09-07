import { SyncFileManagedLearningPathSources } from "../../application/collection-learning-path/commands/SyncFileManagedLearningPathSources.js";
import { MySqlLearningPathDefinitionCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionCommandRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathSourceReferenceQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathSourceReferenceQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";

export function createFileManagedLearningPathSourceSynchronizer(pool, { now } = {}) {
  return new SyncFileManagedLearningPathSources({
    definitionReader: new MySqlLearningPathDefinitionQueryRepository(pool),
    definitionWriter: new MySqlLearningPathDefinitionCommandRepository(pool),
    sourceReferenceReader: new MySqlLearningPathSourceReferenceQueryRepository(pool),
    transactionManager: new MySqlLearningPathTransactionManager(pool),
    ...(now ? { now } : {}),
  });
}
