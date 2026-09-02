import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ShareStoryDialogComponent } from './share-story-dialog.component';

@Injectable({ providedIn: 'root' })
export class ShareStoryService {
  private readonly dialog = inject(MatDialog);
  open(): void { this.dialog.open(ShareStoryDialogComponent, { maxWidth: '95vw' }); }
}
