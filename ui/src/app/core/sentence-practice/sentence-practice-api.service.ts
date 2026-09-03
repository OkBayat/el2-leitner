import { Injectable, inject } from '@angular/core';
import { SentencePracticeDeck } from '../../domain/sentence-practice/sentence-practice';
import { ApiClientService } from '../http/api-client.service';

@Injectable({ providedIn: 'root' })
export class SentencePracticeApiService {
	private readonly api = inject(ApiClientService);

	getDeck(house = 1): Promise<SentencePracticeDeck> {
		return this.api.get<SentencePracticeDeck>(`/api/learning/sentence-practice?house=${encodeURIComponent(house)}`);
	}
}
