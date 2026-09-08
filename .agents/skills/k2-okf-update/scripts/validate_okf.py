#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

SUPPORTED_VERSION = '0.1'
RESERVED_NAMES = {'index.md', 'log.md'}


def problem(code: str, path: Path, message: str) -> dict:
    return {'code': code, 'message': message, 'path': path.as_posix()}


def frontmatter(source: str):
    lines = source.splitlines()
    if not lines or lines[0].strip() != '---':
        return None
    for index in range(1, len(lines)):
        if lines[index].strip() == '---':
            values = {}
            for line in lines[1:index]:
                if ':' not in line or line.lstrip().startswith('#'):
                    continue
                key, value = line.split(':', 1)
                values[key.strip()] = value.strip().strip('"\'')
            return values
    return None


def validate(root: Path) -> dict:
    okf_root = root / 'okf'
    problems = []
    version = None
    checked_concepts = 0

    if not okf_root.is_dir():
        problems.append(problem('missing_bundle', Path('okf'), 'The root OKF bundle directory is missing.'))
        return {
            'checked_concepts': 0,
            'ok': False,
            'okf_version': None,
            'problems': problems,
            'schema_version': 1,
        }

    index_path = okf_root / 'index.md'
    log_path = okf_root / 'log.md'
    if not index_path.is_file():
        problems.append(problem('missing_index', Path('okf/index.md'), 'The OKF root index.md is required.'))
    if not log_path.is_file():
        problems.append(problem('missing_log', Path('okf/log.md'), 'The OKF root log.md is required.'))

    if index_path.is_file():
        metadata = frontmatter(index_path.read_text(encoding='utf-8'))
        version = metadata.get('okf_version') if metadata else None
        if version != SUPPORTED_VERSION:
            problems.append(problem(
                'unsupported_okf_version',
                Path('okf/index.md'),
                f'Expected okf_version {SUPPORTED_VERSION}; found {version or "missing"}.',
            ))

    for path in sorted(okf_root.rglob('*.md')):
        if path.name in RESERVED_NAMES:
            continue
        checked_concepts += 1
        relative = path.relative_to(root)
        metadata = frontmatter(path.read_text(encoding='utf-8'))
        if metadata is None:
            problems.append(problem('missing_frontmatter', relative, 'OKF concepts must start with YAML frontmatter.'))
            continue
        concept_type = metadata.get('type', '').strip()
        if not concept_type:
            problems.append(problem('missing_type', relative, 'OKF concept frontmatter must contain a non-empty type.'))

    problems.sort(key=lambda item: (item['path'], item['code'], item['message']))
    return {
        'checked_concepts': checked_concepts,
        'ok': not problems,
        'okf_version': version,
        'problems': problems,
        'schema_version': 1,
    }


def parse_args():
    parser = argparse.ArgumentParser(description='Validate the Vocora root OKF bundle.')
    parser.add_argument('--root', default='.', help='Repository root. Defaults to the current directory.')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = validate(Path(args.root).resolve())
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
