#!/usr/bin/env python3
"""Prepare trusted local episode assets and reproducible ZIP bundles (Python 3 + Node)."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
import zipfile

SOURCE_ONLY_MARKER = "TRANSCRIPT_SOURCE_ONLY"
DIRECTORY_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\Z")
MAX_AUDIO_BYTES = 100_000_000
MAX_IMAGE_BYTES = 10_000_000
BBC_DOMAINS = ("bbc.co.uk", "bbc.com", "bbci.co.uk")
SCRIPT_DIRECTORY = Path(__file__).resolve().parent


def bbc_url(value: str) -> str:
    """Restrict both requested URLs and redirects to HTTPS BBC hosts, without credentials."""
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.port not in (None, 443)
            or not any(host == domain or host.endswith("." + domain) for domain in BBC_DOMAINS)):
        raise ValueError("Only credential-free HTTPS BBC asset URLs on port 443 are accepted.")
    return value


class BbcRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return super().redirect_request(request, fp, code, message, headers, bbc_url(newurl))


def regular_file(path: Path, max_bytes: int = 2_000_000) -> Path:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= max_bytes:
        raise ValueError(f"Expected a non-empty regular file, not a symlink: {path}")
    return path


def episode_directory(value: str | Path) -> Path:
    candidate = Path(value).absolute()
    if any(part.is_symlink() for part in (candidate, *candidate.parents)):
        raise ValueError("Episode paths must not contain symbolic links.")
    if not candidate.is_dir() or not DIRECTORY_PATTERN.fullmatch(candidate.name):
        raise ValueError("Episode directory must be an existing YYYY-MM-DD-slug directory.")
    return candidate


def manifest(directory: Path) -> dict:
    data = json.loads(regular_file(directory / "episode.json").read_text(encoding="utf-8"))
    if data.get("audioFile") != "audio.mp3" or data.get("imageFile") not in {
        "cover.jpg", "cover.jpeg", "cover.png", "cover.webp"
    }:
        raise ValueError("The manifest must use audio.mp3 and a supported cover filename.")
    return data


def validate_media(content: bytes, name: str) -> None:
    if name.endswith(".mp3"):
        valid = content[:3] == b"ID3" or (len(content) > 1 and content[0] == 255 and content[1] & 224 == 224)
    elif name.endswith(".png"):
        valid = content[:8] == b"\x89PNG\r\n\x1a\n"
    elif name.endswith(".webp"):
        valid = content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    else:
        valid = content[:3] == b"\xff\xd8\xff"
    if not valid:
        raise ValueError(f"The download is not the expected media type: {name}")


def atomic_write(path: Path, content: bytes) -> None:
    if path.is_symlink():
        raise ValueError(f"Refusing to replace a symbolic link: {path}")
    fd, temporary = tempfile.mkstemp(prefix=".episode-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def fetch_assets(directory: Path, *, overwrite: bool = False) -> None:
    data = manifest(directory)
    sources = data.get("sources", {})
    opener = build_opener(BbcRedirectHandler())
    for filename, field, limit in [(data["imageFile"], "imageUrl", MAX_IMAGE_BYTES),
                                   ("audio.mp3", "audioUrl", MAX_AUDIO_BYTES)]:
        destination = directory / filename
        if destination.exists() and not overwrite:
            validate_media(regular_file(destination, limit).read_bytes(), filename)
            print(f"Kept {filename}; use --overwrite to replace it.")
            continue
        url = bbc_url(sources.get(field, ""))
        request = Request(url, headers={"User-Agent": "Vocora personal-study episode preparation/1.0"})
        with opener.open(request, timeout=60) as response:
            bbc_url(response.geturl())
            content = response.read(limit + 1)
        if not content or len(content) > limit:
            raise ValueError(f"Asset is empty or exceeds the {limit}-byte limit: {filename}")
        validate_media(content, filename)
        atomic_write(destination, content)
        print(f"Saved {filename}: {len(content)} bytes, SHA-256 {hashlib.sha256(content).hexdigest()}")


def import_transcript(directory: Path, source: Path) -> None:
    if source.suffix.lower() not in {".md", ".txt"}:
        raise ValueError("Supply your authorized local UTF-8 .md or .txt transcript, not a PDF or URL.")
    text = regular_file(source).read_text(encoding="utf-8-sig").strip()
    if not text or SOURCE_ONLY_MARKER in text:
        raise ValueError("The provided transcript is empty or still a source-reference placeholder.")
    title = manifest(directory)["title"]
    if not text.startswith("# "):
        text = f"# {title} — Full transcript\n\n{text}"
    atomic_write(directory / "transcript.md", (text + "\n").encode("utf-8"))
    print("Imported the local transcript. It is file-only and is never synchronized into the database.")


def validate_for_bundle(directory: Path) -> None:
    node = shutil.which("node")
    if not node:
        raise ValueError("Node.js is required to validate the episode against Vocora's actual parser.")
    subprocess.run([node, str(SCRIPT_DIRECTORY / "validate-listening-lessons.js"),
                    "--require-audio", "--episode", str(directory)], check=True)


def package_episode(directory: Path, output: Path, *, allow_source_transcript: bool = False) -> dict:
    validate_for_bundle(directory)
    data = manifest(directory)
    transcript = regular_file(directory / "transcript.md").read_text(encoding="utf-8")
    source_only = SOURCE_ONLY_MARKER in transcript
    if source_only and not allow_source_transcript:
        raise ValueError("Full transcript is missing. Import your authorized local transcript first, or explicitly use --allow-source-transcript for an incomplete sample.")
    paths = [directory / name for name in ["episode.json", "listening.json", data["imageFile"],
                                          "audio.mp3", "transcript.md", "vocabulary.md"]]
    output = output.absolute()
    if output.suffix.lower() != ".zip" or output == directory or directory in output.parents:
        raise ValueError("Write the .zip outside the episode directory.")
    if output.exists() or output.is_symlink():
        raise ValueError("Output already exists; choose another name or remove it explicitly.")
    files = {path.name: regular_file(path, MAX_AUDIO_BYTES).read_bytes() for path in paths}
    listening = json.loads(files["listening.json"])
    report = {
        "schemaVersion": 1, "episodeId": data["publicId"], "folder": directory.name,
        "testCount": len(listening["tests"]),
        "transcriptStatus": "source_reference_only" if source_only else "provided_unverified",
        "notice": "BBC assets retain their original copyright. Availability is not a redistribution licence. Verify your intended use. Tests and vocabulary explanations are independently authored IELTS-style practice, not an official IELTS test.",
        "files": {name: {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
                  for name, content in sorted(files.items())}
    }
    files["BUNDLE.json"] = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Fixed timestamps and sorted paths make identical input files produce identical ZIP bytes.
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(f"{directory.name}/{name}", date_time=(2000, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    fetch = subcommands.add_parser("fetch-assets", help="Fetch only manifest-linked official BBC cover and MP3.")
    fetch.add_argument("episode")
    fetch.add_argument("--overwrite", action="store_true")
    transcript = subcommands.add_parser("import-transcript", help="Import a local transcript you have permission to use.")
    transcript.add_argument("episode")
    transcript.add_argument("--from", dest="source", type=Path, required=True)
    package = subcommands.add_parser("package", help="Validate one episode and create a checksummed ZIP.")
    package.add_argument("episode")
    package.add_argument("--output", type=Path, required=True)
    package.add_argument("--allow-source-transcript", action="store_true")
    args = parser.parse_args()
    try:
        directory = episode_directory(args.episode)
        if args.command == "fetch-assets":
            fetch_assets(directory, overwrite=args.overwrite)
        elif args.command == "import-transcript":
            import_transcript(directory, args.source)
        else:
            report = package_episode(directory, args.output, allow_source_transcript=args.allow_source_transcript)
            print(json.dumps({"zip": str(args.output), "testCount": report["testCount"],
                              "transcriptStatus": report["transcriptStatus"]}, indent=2))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Episode preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
