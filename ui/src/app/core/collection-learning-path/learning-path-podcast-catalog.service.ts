import { Injectable } from '@angular/core';
import { LEARNING_PATH_PODCAST_CATALOG } from '../../generated/learning-path-podcast-catalog';

export interface PodcastLessonIdentity {
  position: number;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class LearningPathPodcastCatalogService {
  async resolveLessonId(collectionId: string, lesson: PodcastLessonIdentity): Promise<string> {
    const course = LEARNING_PATH_PODCAST_CATALOG.courses.find(
      (candidate) => candidate.collectionId === collectionId,
    );
    const entry = course?.lessons.find(
      (candidate) => candidate.position === lesson.position && candidate.title === lesson.title,
    );
    if (!entry?.id) {
      throw new Error('The lesson audio mapping is not available.');
    }
    return entry.id;
  }
}
