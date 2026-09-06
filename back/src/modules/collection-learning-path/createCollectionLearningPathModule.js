import { ActivateVocabularyIntake } from "../../application/collection-learning-path/commands/ActivateVocabularyIntake.js";
import { CompleteExercise } from "../../application/collection-learning-path/commands/CompleteExercise.js";
import { StartExercise } from "../../application/collection-learning-path/commands/StartExercise.js";
import { StartLearningPath } from "../../application/collection-learning-path/commands/StartLearningPath.js";
import { createDefaultExerciseRuntimeRegistry } from "../../application/collection-learning-path/ExerciseRuntimeRegistry.js";
import { GetCollectionLearningPath } from "../../application/collection-learning-path/queries/GetCollectionLearningPath.js";
import { GetExerciseContext } from "../../application/collection-learning-path/queries/GetExerciseContext.js";
import { GetLearningPathLesson } from "../../application/collection-learning-path/queries/GetLearningPathLesson.js";
import { GetLearningPathResumePoint } from "../../application/collection-learning-path/queries/GetLearningPathResumePoint.js";
import { GetVocabularyIntakeContext } from "../../application/collection-learning-path/queries/GetVocabularyIntakeContext.js";
import { VerifyVocabularyIntakeCompletion } from "../../application/collection-learning-path/queries/VerifyVocabularyIntakeCompletion.js";
import { VOCABULARY_INTAKE_COMPLETION_POLICY, VOCABULARY_INTAKE_TYPE } from "../../domain/collection-learning-path/VocabularyIntake.js";
import { MySqlVocabularyActivationRepository } from "../../infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";
import { MySqlLearningPathAccessQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathAccessQueryRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";
import { MySqlLearningPathProgressCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";
import { MySqlLearningPathProgressQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressQueryRepository.js";
import { MySqlLearningPathTransactionManager } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathTransactionManager.js";
import { MySqlLearningPathVocabularyIntakeCommandRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeCommandRepository.js";
import { MySqlLearningPathVocabularyIntakeQueryRepository } from "../../infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathVocabularyIntakeQueryRepository.js";
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
  const vocabularyIntakeReader = adapters.learningPathVocabularyIntakeReader
    ?? new MySqlLearningPathVocabularyIntakeQueryRepository(pool);
  const vocabularyActivationRepository = adapters.learningPathVocabularyActivationRepository
    ?? adapters.vocabularyActivationRepository
    ?? new MySqlVocabularyActivationRepository(pool);
  const vocabularyIntakeWriter = adapters.learningPathVocabularyIntakeWriter
    ?? new MySqlLearningPathVocabularyIntakeCommandRepository(vocabularyActivationRepository);
  const clock = adapters.learningPathClock ?? (() => new Date());

  const getVocabularyIntakeContext = new GetVocabularyIntakeContext({ vocabularyIntakeReader });
  const verifyVocabularyIntakeCompletion = new VerifyVocabularyIntakeCompletion({ vocabularyIntakeReader });
  const exerciseRuntime = adapters.learningPathExerciseRuntime
    ?? createDefaultExerciseRuntimeRegistry({
      contextHydrators: {
        [VOCABULARY_INTAKE_TYPE]: (context) => getVocabularyIntakeContext.execute(context),
      },
      completionPolicies: {
        [VOCABULARY_INTAKE_COMPLETION_POLICY]: (context) => verifyVocabularyIntakeCompletion.execute(context),
      },
    });

  const dependencies = {
    definitionReader,
    progressReader,
    progressWriter,
    accessReader,
    transactionManager,
    exerciseRuntime,
    vocabularyIntakeReader,
    vocabularyIntakeWriter,
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
    activateVocabularyIntake: new ActivateVocabularyIntake(dependencies),
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
