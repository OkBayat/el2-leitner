import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface PodcastLessonEntry {
  id: string;
  position: number;
  title: string;
}

interface PodcastCourseEntry {
  collectionId: string;
  lessons: PodcastLessonEntry[];
}

interface LearningPathPodcastCatalog {
  schemaVersion: 1;
  courses: PodcastCourseEntry[];
}

export interface PodcastLessonIdentity {
  position: number;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class LearningPathPodcastCatalogService {
  private readonly http = inject(HttpClient);
  private catalog: Promise<LearningPathPodcastCatalog> | null = null;

  async resolveLessonId(collectionId: string, lesson: PodcastLessonIdentity): Promise<string> {
    this.catalog ??= firstValueFrom(
      this.http.get<LearningPathPodcastCatalog>('/data/learning-path-podcast-catalog.json'),
    );
    const catalog = await this.catalog;
    const course = catalog.courses.find((candidate) => candidate.collectionId === collectionId);
    const entry = course?.lessons.find(
      (candidate) => candidate.position === lesson.position && candidate.title === lesson.title,
    );
    if (!entry?.id) {
      throw new Error('The lesson audio mapping is not available.');
    }
    return entry.id;
  }
}
