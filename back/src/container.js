import { GetListeningEpisodeImage } from "./application/listening-practice/GetListeningEpisodeImage.js";
import { GetListeningEpisodeVocabulary } from "./application/listening-practice/GetListeningEpisodeVocabulary.js";
import { MySqlListeningVocabularyRepository } from "./infrastructure/persistence/mysql/MySqlListeningVocabularyRepository.js";
import { GetCurrentUser } from "./application/auth/GetCurrentUser.js";
import { LoginUser } from "./application/auth/LoginUser.js";
import { RegisterUser } from "./application/auth/RegisterUser.js";
import { GetListeningEpisodeAudio } from "./application/listening-practice/GetListeningEpisodeAudio.js";
import { ListListeningLessons } from "./application/listening-practice/ListListeningLessons.js";
import { StartListeningAttempt } from "./application/listening-practice/StartListeningAttempt.js";
import { SubmitListeningAttempt } from "./application/listening-practice/SubmitListeningAttempt.js";
import { GetVocabularySources } from "./application/library/GetVocabularySources.js";
import { LibraryCommands } from "./application/library/LibraryCommands.js";
import { LibraryQueries } from "./application/library/LibraryQueries.js";
import { ActivateVocabulary } from "./application/learning/ActivateVocabulary.js";
import { ActivateVocabularyBatch } from "./application/learning/ActivateVocabularyBatch.js";
import { GetLearningState } from "./application/learning/GetLearningState.js";
import { GetLeitnerHouse } from "./application/learning/GetLeitnerHouse.js";
import { LearningSessionCommands } from "./application/learning/LearningSessionCommands.js";
import { RecordReviewResult } from "./application/learning/RecordReviewResult.js";
import { SaveLearningState } from "./application/learning/SaveLearningState.js";
import { UpdateVocabulary } from "./application/learning/UpdateVocabulary.js";
import { GetSentencePracticeCards } from "./application/sentence-practice/GetSentencePracticeCards.js";
import { LibraryAdminPolicy } from "./domain/library/LibraryAdminPolicy.js";
import { VocabularyFileParser } from "./domain/library/VocabularyFileParser.js";
import { MySqlEditableLearningBootstrapRepository } from "./infrastructure/persistence/mysql/MySqlEditableLearningBootstrapRepository.js";
import { MySqlEditableLearningStateRepository } from "./infrastructure/persistence/mysql/MySqlEditableLearningStateRepository.js";
import { MySqlLibraryRepository } from "./infrastructure/persistence/mysql/MySqlLibraryRepository.js";
import { MySqlListeningPracticeRepository } from "./infrastructure/persistence/mysql/MySqlListeningPracticeRepository.js";
import { MySqlPracticeSessionRepository } from "./infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js";
import { MySqlReviewProgressRepository } from "./infrastructure/persistence/mysql/MySqlReviewProgressRepository.js";
import { MySqlSentencePracticeRepository } from "./infrastructure/persistence/mysql/MySqlSentencePracticeRepository.js";
import { MySqlUserRepository } from "./infrastructure/persistence/mysql/MySqlUserRepository.js";
import { MySqlVocabularyActivationRepository } from "./infrastructure/persistence/mysql/MySqlVocabularyActivationRepository.js";
import { MySqlVocabularySourceRepository } from "./infrastructure/persistence/mysql/MySqlVocabularySourceRepository.js";
import { BcryptPasswordHasher } from "./infrastructure/security/BcryptPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

export function createContainer({ pool, config, adapters = {} }) {
  const userRepository = adapters.userRepository ?? new MySqlUserRepository(pool);
  const learningStateRepository =
    adapters.learningStateRepository ?? new MySqlEditableLearningStateRepository(pool);
  const learningBootstrapRepository = adapters.learningBootstrapRepository
    ?? (adapters.learningStateRepository
      ? learningStateRepository
      : new MySqlEditableLearningBootstrapRepository(pool, learningStateRepository));
  const libraryRepository = adapters.libraryRepository ?? new MySqlLibraryRepository(pool);
  const listeningPracticeRepository =
    adapters.listeningPracticeRepository ?? new MySqlListeningPracticeRepository(pool);
  const practiceSessionRepository =
    adapters.practiceSessionRepository ?? new MySqlPracticeSessionRepository(pool);
  const reviewProgressRepository =
    adapters.reviewProgressRepository ?? new MySqlReviewProgressRepository(pool);
  const sentencePracticeRepository =
    adapters.sentencePracticeRepository ?? new MySqlSentencePracticeRepository(pool);
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
    listeningAudioDirectory: config.listening.audioDirectory,
    listeningEpisodesDirectory: config.listening.episodesDirectory,
    useCases: {
      registerUser: new RegisterUser({ userRepository, passwordHasher }),
      loginUser: new LoginUser({ userRepository, passwordHasher }),
      getCurrentUser: new GetCurrentUser({ userRepository }),
      getListeningEpisodeImage: new GetListeningEpisodeImage({ listeningPracticeRepository }),
      getListeningEpisodeVocabulary: new GetListeningEpisodeVocabulary({
        listeningVocabularyRepository: adapters.listeningVocabularyRepository ?? new MySqlListeningVocabularyRepository(pool)
      }),
      getListeningEpisodeAudio: new GetListeningEpisodeAudio({ listeningPracticeRepository }),
      listListeningLessons: new ListListeningLessons({ listeningPracticeRepository }),
      startListeningAttempt: new StartListeningAttempt({ listeningPracticeRepository }),
      submitListeningAttempt: new SubmitListeningAttempt({ listeningPracticeRepository }),
      getLearningState: new GetLearningState({ learningStateRepository, learningBootstrapRepository }),
      getLeitnerHouse: new GetLeitnerHouse({ learningStateRepository }),
      getSentencePracticeCards: new GetSentencePracticeCards({ sentencePracticeRepository }),
      saveLearningState: new SaveLearningState({ learningStateRepository }),
      updateVocabulary: new UpdateVocabulary({ learningStateRepository }),
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
