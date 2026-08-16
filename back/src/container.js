import { GetCurrentUser } from "./application/auth/GetCurrentUser.js";
import { LoginUser } from "./application/auth/LoginUser.js";
import { RegisterUser } from "./application/auth/RegisterUser.js";
import { GetVocabularySources } from "./application/library/GetVocabularySources.js";
import { LibraryCommands } from "./application/library/LibraryCommands.js";
import { LibraryQueries } from "./application/library/LibraryQueries.js";
import { ActivateVocabulary } from "./application/learning/ActivateVocabulary.js";
import { ActivateVocabularyBatch } from "./application/learning/ActivateVocabularyBatch.js";
import { GetLearningState } from "./application/learning/GetLearningState.js";
import { LearningSessionCommands } from "./application/learning/LearningSessionCommands.js";
import { RecordReviewResult } from "./application/learning/RecordReviewResult.js";
import { SaveLearningState } from "./application/learning/SaveLearningState.js";
import { LibraryAdminPolicy } from "./domain/library/LibraryAdminPolicy.js";
import { VocabularyFileParser } from "./domain/library/VocabularyFileParser.js";
import { MySqlEfficientLearningStateRepository } from "./infrastructure/persistence/mysql/MySqlEfficientLearningStateRepository.js";
import { MySqlLearningBootstrapRepository } from "./infrastructure/persistence/mysql/MySqlLearningBootstrapRepository.js";
import { MySqlLibraryRepository } from "./infrastructure/persistence/mysql/MySqlLibraryRepository.js";
import { MySqlPracticeSessionRepository } from "./infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js";
import { MySqlReviewProgressRepository } from "./infrastructure/persistence/mysql/MySqlReviewProgressRepository.js";
import { MySqlUserRepository } from "./infrastructure/persistence/mysql/MySqlUserRepository.js";
import { MySqlVocabularyActivationRepository } from "./infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";
import { MySqlVocabularySourceRepository } from "./infrastructure/persistence/mysql/MySqlVocabularySourceRepository.js";
import { BcryptPasswordHasher } from "./infrastructure/security/BcryptPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

export function createContainer({ pool, config, adapters = {} }) {
  const userRepository = adapters.userRepository ?? new MySqlUserRepository(pool);
  const learningStateRepository =
    adapters.learningStateRepository ?? new MySqlEfficientLearningStateRepository(pool);
  const learningBootstrapRepository =
    adapters.learningBootstrapRepository ?? new MySqlLearningBootstrapRepository(pool, learningStateRepository);
  const libraryRepository = adapters.libraryRepository ?? new MySqlLibraryRepository(pool);
  const practiceSessionRepository =
    adapters.practiceSessionRepository ?? new MySqlPracticeSessionRepository(pool);
  const reviewProgressRepository =
    adapters.reviewProgressRepository ?? new MySqlReviewProgressRepository(pool);
  const vocabularyActivationRepository =
    adapters.vocabularyActivationRepository ?? new MySqlVocabularyActivationRepository(pool);
  const vocabularySourceRepository =
    adapters.vocabularySourceRepository ?? new MySqlVocabularySourceRepository(pool);
  const passwordHasher = adapters.passwordHasher ?? new BcryptPasswordHasher();
  const tokenService = adapters.tokenService ?? new JwtTokenService({
    secret: config.auth.jwtSecret,
    expiresIn: config.auth.jwtExpiresIn
  });
  const libraryAdminPolicy =
    adapters.libraryAdminPolicy ?? new LibraryAdminPolicy(config.library?.adminEmails || []);
  const vocabularyFileParser = adapters.vocabularyFileParser ?? new VocabularyFileParser();

  return {
    tokenService,
    authCookie: config.auth.cookie,
    authRateLimit: config.auth.rateLimit,
    useCases: {
      registerUser: new RegisterUser({ userRepository, passwordHasher }),
      loginUser: new LoginUser({ userRepository, passwordHasher }),
      getCurrentUser: new GetCurrentUser({ userRepository }),
      getLearningState: new GetLearningState({ learningStateRepository, learningBootstrapRepository }),
      saveLearningState: new SaveLearningState({ learningStateRepository }),
      activateVocabulary: new ActivateVocabulary({ vocabularyActivationRepository }),
      activateVocabularyBatch: new ActivateVocabularyBatch({ vocabularyActivationRepository }),
      getVocabularySources: new GetVocabularySources({ vocabularySourceRepository }),
      recordReviewResult: new RecordReviewResult({ reviewProgressRepository }),
      learningSessionCommands: new LearningSessionCommands({ practiceSessionRepository }),
      libraryQueries: new LibraryQueries({ libraryRepository, adminPolicy: libraryAdminPolicy }),
      libraryCommands: new LibraryCommands({
        libraryRepository,
        adminPolicy: libraryAdminPolicy,
        vocabularyFileParser
      })
    }
  };
}
