import { GetCurrentUser } from "./application/auth/GetCurrentUser.js";
import { LoginUser } from "./application/auth/LoginUser.js";
import { RegisterUser } from "./application/auth/RegisterUser.js";
import { LibraryCommands } from "./application/library/LibraryCommands.js";
import { LibraryQueries } from "./application/library/LibraryQueries.js";
import { GetLearningState } from "./application/learning/GetLearningState.js";
import { LearningSessionCommands } from "./application/learning/LearningSessionCommands.js";
import { SaveLearningState } from "./application/learning/SaveLearningState.js";
import { LibraryAdminPolicy } from "./domain/library/LibraryAdminPolicy.js";
import { VocabularyFileParser } from "./domain/library/VocabularyFileParser.js";
import { MySqlLearningStateRepository } from "./infrastructure/persistence/mysql/MySqlLearningStateRepository.js";
import { MySqlLibraryRepository } from "./infrastructure/persistence/mysql/MySqlLibraryRepository.js";
import { MySqlPracticeSessionRepository } from "./infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js";
import { MySqlUserRepository } from "./infrastructure/persistence/mysql/MySqlUserRepository.js";
import { BcryptPasswordHasher } from "./infrastructure/security/BcryptPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

export function createContainer({ pool, config, adapters = {} }) {
  const userRepository = adapters.userRepository ?? new MySqlUserRepository(pool);
  const learningStateRepository = adapters.learningStateRepository ?? new MySqlLearningStateRepository(pool);
  const libraryRepository = adapters.libraryRepository ?? new MySqlLibraryRepository(pool);
  const practiceSessionRepository = adapters.practiceSessionRepository ?? new MySqlPracticeSessionRepository(pool);
  const passwordHasher = adapters.passwordHasher ?? new BcryptPasswordHasher();
  const tokenService = adapters.tokenService ?? new JwtTokenService({
    secret: config.auth.jwtSecret,
    expiresIn: config.auth.jwtExpiresIn
  });
  const libraryAdminPolicy = adapters.libraryAdminPolicy ?? new LibraryAdminPolicy(config.library?.adminEmails || []);
  const vocabularyFileParser = adapters.vocabularyFileParser ?? new VocabularyFileParser();

  return {
    tokenService,
    authCookie: config.auth.cookie,
    authRateLimit: config.auth.rateLimit,
    useCases: {
      registerUser: new RegisterUser({ userRepository, passwordHasher }),
      loginUser: new LoginUser({ userRepository, passwordHasher }),
      getCurrentUser: new GetCurrentUser({ userRepository }),
      getLearningState: new GetLearningState({ learningStateRepository }),
      saveLearningState: new SaveLearningState({ learningStateRepository }),
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
