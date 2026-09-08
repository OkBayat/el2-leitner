import { SyncBbcSixMinuteEnglishCourseSource } from "../../application/collection-learning-path/commands/SyncBbcSixMinuteEnglishCourseSource.js";
import { MySqlLearningPathCourseCatalogCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathCourseCatalogCommandRepository.js";
import { MySqlLearningPathDefinitionCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionCommandRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";

export function createBbcCourseSourceSynchronizer(pool, { now } = {}) {
  return new SyncBbcSixMinuteEnglishCourseSource({
    courseCatalogWriter: new MySqlLearningPathCourseCatalogCommandRepository(pool),
    definitionReader: new MySqlLearningPathDefinitionQueryRepository(pool),
    definitionWriter: new MySqlLearningPathDefinitionCommandRepository(pool),
    transactionManager: new MySqlLearningPathTransactionManager(pool),
    ...(now ? { now } : {}),
  });
}
