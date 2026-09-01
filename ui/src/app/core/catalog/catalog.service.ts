import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WordSource, parseWordFile } from '../../domain/learning/learning-rules';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private cache: Promise<WordSource[]> | null = null;

  loadCoreVocabulary(): Promise<WordSource[]> {
    this.cache ??= firstValueFrom(this.http.get('/data/IELTS_Listening_Core_1500.md', { responseType: 'text' }))
      .then((text) => parseWordFile(text));
    return this.cache;
  }
}
