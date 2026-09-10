export type TeachingMarkdownBlock =
	| { readonly kind: 'h3' | 'h4' | 'paragraph'; readonly html: string }
	| {
			readonly kind: 'ordered-list' | 'bullet-list';
			readonly items: readonly string[];
	  };

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function inlineMarkdown(value: string): string {
	return escapeHtml(value)
		.replace(
			/\*\*([^*\n]+)\*\*/g,
			'<strong class="teaching-markdown__known">$1</strong>',
		)
		.replace(
			/__([^_\n]+)__/g,
			'<strong class="teaching-markdown__known">$1</strong>',
		)
		.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,!?;:)])/g, '$1<em>$2</em>')
		.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?;:)])/g, '$1<em>$2</em>');
}

export function parseTeachingMarkdown(
	markdown: string,
): readonly TeachingMarkdownBlock[] {
	const blocks: TeachingMarkdownBlock[] = [];
	let paragraph: string[] = [];
	let list: { kind: 'ordered-list' | 'bullet-list'; items: string[] } | null =
		null;

	const flushParagraph = (): void => {
		if (!paragraph.length) return;
		blocks.push({
			kind: 'paragraph',
			html: paragraph.map(inlineMarkdown).join('<br>'),
		});
		paragraph = [];
	};
	const flushList = (): void => {
		if (!list) return;
		blocks.push({ kind: list.kind, items: [...list.items] });
		list = null;
	};
	const appendListItem = (
		kind: 'ordered-list' | 'bullet-list',
		value: string,
	): void => {
		flushParagraph();
		if (list?.kind !== kind) flushList();
		list ??= { kind, items: [] };
		list.items.push(inlineMarkdown(value));
	};

	for (const sourceLine of markdown.replace(/\r\n?/g, '\n').split('\n')) {
		const line = sourceLine.trim();
		if (!line) {
			flushParagraph();
			flushList();
			continue;
		}
		const h4 = line.match(/^####\s+(.+)$/);
		const h3 = line.match(/^###\s+(.+)$/);
		if (h4 || h3) {
			flushParagraph();
			flushList();
			blocks.push({
				kind: h4 ? 'h4' : 'h3',
				html: inlineMarkdown((h4 ?? h3)![1]),
			});
			continue;
		}
		const ordered = line.match(/^\d+[.)]\s+(.+)$/);
		if (ordered) {
			appendListItem('ordered-list', ordered[1]);
			continue;
		}
		const bullet = line.match(/^[-*]\s+(.+)$/);
		if (bullet) {
			appendListItem('bullet-list', bullet[1]);
			continue;
		}
		flushList();
		paragraph.push(line);
	}

	flushParagraph();
	flushList();
	return blocks;
}
