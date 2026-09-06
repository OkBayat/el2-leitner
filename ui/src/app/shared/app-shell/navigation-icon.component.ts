import {ChangeDetectionStrategy, Component, input} from '@angular/core';

export type NavigationIcon = 'home' | 'listening' | 'review' | 'words' | 'library' | 'progress' |
	'settings' | 'more' | 'account' | 'course' | 'streak' | 'share' | 'theme' | 'logout';

@Component({
	selector: 'app-navigation-icon',
	templateUrl: 'navigation-icon.component.html',
	styles: ':host{display:inline-block;width:32px;height:32px;line-height:0;flex-shrink:0}svg{display:block;width:100%;height:100%}',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationIconComponent {
	readonly name = input.required<NavigationIcon>();
}
