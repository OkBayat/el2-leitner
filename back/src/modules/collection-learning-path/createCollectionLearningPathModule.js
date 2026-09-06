import { CompleteExercise } from "../../application/collection-learning-path/commands/CompleteExercise.js";
import { StartExercise } from "../../application/collection-learning-path/commands/StartExercise.js";
import { StartLearningPath } from "../../application/collection-learning-path/commands/StartLearningPath.js";
import { createDefaultExerciseRuntimeRegistry } from "../../application/collection-learning-path/ExerciseRuntimeRegistry.js";
import { GetCollectionLearningPath } from "../../application/collection-learning-path/queries/GetCollectionLearningPath.js";
import { GetExerciseContext } from "../../application/collection-learning-path/queries/GetExerciseContext.js";
import { GetLearningPathLesson } from "../../application/collection-learning-path/queries/GetLearningPathLesson.js";
import { GetLearningPathResumePoint } from "../../application/collection-learning-path/queries/GetLearningPathResumePoint.js";
import { MySqlLearningPathAccessQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathAccessQueryRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathProgressCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";
import { MySqlLearningPathProgressQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";
import { createCollectionLearningPathRouter } from "../../interfaces/http/collection-learning-path/collectionLearningPathRouter.js";

export function createCollectionLearningPathModule({ pool, adapters = {} }) {
  const definitionReader = adapters.learningPathDefinitionReader
    ?? new MySqlLearningPathDefinitionQueryRepository(pool);
  const progressReader = adapters.learningPathProgressReader
    ?? new MySqlLearningPathProgressQueryRepository(pool);
  const progressWriter = adapters.learningPathProgressWriter
    ?? new MySqlLearningPathProgressCommandRepository(pool);
  const accessReader = adapters.learningPathAccessReader
    ?? new MySqlLearningPathAccessQueryRepository(pool);
  const transactionManager = adapters.learningPathTransactionManager
    ?? new MySqlLearningPathTransactionManager(pool);
  const exerciseRuntime = adapters.learningPathExerciseRuntime
    ?? createDefaultExerciseRuntimeRegistry();
  const clock = adapters.learningPathClock ?? (() => new Date());

  const dependencies = {
    definitionReader,
    progressReader,
    progressWriter,
    accessReader,
    transactionManager,
    exerciseRuntime,
    clock,
  };

  const queries = {
    getCollectionLearningPath: new GetCollectionLearningPath(dependencies),
    getLearningPathLesson: new GetLearningPathLesson(dependencies),
    getExerciseContext: new GetExerciseContext(dependencies),
    getLearningPathResumePoint: new GetLearningPathResumePoint(dependencies),
  };
  const commands = {
    startLearningPath: new StartLearningPath(dependencies),
    startExercise: new StartExercise(dependencies),
    completeExercise: new CompleteExercise(dependencies),
  };

  return {
    queries,
    commands,
    createHttpRouter({ authenticate }) {
      return createCollectionLearningPathRouter({ queries, commands, authenticate });
    },
  };
}
