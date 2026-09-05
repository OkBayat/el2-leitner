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
import stat
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
    if not isinstance(data, dict):
        raise ValueError("The episode manifest must be an object.")
    if data.get("audioFile") != "audio.mp3" or data.get("imageFile") not in (
        "cover.jpg", "cover.jpeg", "cover.png", "cover.webp"
    ):
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


def verify_bundle(source: Path) -> tuple[dict, dict[str, bytes]]:
    """Validate the exact ZIP contract before installation; never call extractall on a bundle."""
    regular_file(source, 130_000_000)
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        names = [member.filename for member in members]
        if len(names) != 7 or len(set(names)) != 7:
            raise ValueError("A bundle must contain exactly seven unique file members.")
        folder = names[0].split("/")[0]
        if len(folder) > 160 or not DIRECTORY_PATTERN.fullmatch(folder):
            raise ValueError("Invalid bundle episode folder.")
        limits = {"BUNDLE.json": 64_000, "episode.json": 2_000_000,
                  "listening.json": 2_000_000, "transcript.md": 2_000_000,
                  "vocabulary.md": 2_000_000, "audio.mp3": MAX_AUDIO_BYTES,
                  **{name: MAX_IMAGE_BYTES for name in ("cover.jpg", "cover.jpeg", "cover.png", "cover.webp")}}
        files = {}
        for member in members:
            name = member.filename.removeprefix(folder + "/")
            if (member.filename != folder + "/" + name or name not in limits
                    or stat.S_IFMT(member.external_attr >> 16) not in (0, stat.S_IFREG)
                    or member.flag_bits & 1 or not 0 < member.file_size <= limits[name]):
                raise ValueError(f"Unsafe, unexpected or oversized bundle member: {member.filename}")
            with archive.open(member) as stream:
                content = stream.read(limits[name] + 1)
            if len(content) != member.file_size or len(content) > limits[name]:
                raise ValueError(f"Invalid bundle member size: {name}")
            files[name] = content
    report = json.loads(files.pop("BUNDLE.json", b"{}"))
    data = json.loads(files.get("episode.json", b"{}"))
    if not isinstance(report, dict) or not isinstance(data, dict):
        raise ValueError("Bundle and episode manifests must be objects.")
    image_file = data.get("imageFile")
    if image_file not in ("cover.jpg", "cover.jpeg", "cover.png", "cover.webp"):
        raise ValueError("The bundle must select a supported episode cover filename.")
    expected = {"episode.json", "listening.json", "transcript.md", "vocabulary.md", "audio.mp3", image_file}
    checksums = report.get("files")
    if (type(report.get("schemaVersion")) is not int or report["schemaVersion"] != 1 or report.get("folder") != folder
            or set(files) != expected or not isinstance(checksums, dict) or set(checksums) != expected):
        raise ValueError("Bundle file list does not match its episode manifest.")
    for name, content in files.items():
        if checksums[name] != {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}:
            raise ValueError(f"Bundle checksum or byte count mismatch: {name}")
    listening = json.loads(files["listening.json"])
    transcript = files["transcript.md"].decode("utf-8")
    transcript_status = "source_reference_only" if SOURCE_ONLY_MARKER in transcript else "provided_unverified"
    if (not isinstance(listening, dict) or not isinstance(listening.get("tests"), list)
            or report.get("episodeId") != data.get("publicId")
            or type(report.get("testCount")) is not int or report["testCount"] != len(listening["tests"])
            or report.get("transcriptStatus") != transcript_status):
        raise ValueError("Bundle identity, test count or transcript status is inconsistent.")
    # Checksums detect corruption, not authorship. The actual application parser still validates all content.
    with tempfile.TemporaryDirectory(prefix="vocora-bundle-verify-") as temporary:
        staged = Path(temporary) / folder
        staged.mkdir()
        for name, content in files.items():
            (staged / name).write_bytes(content)
        validate_for_bundle(staged)
    return report, files


def install_bundle(source: Path, target_root: Path, *, audio_only: bool = False,
                   allow_source_transcript: bool = False) -> dict:
    """Install validated new content, or only missing audio without overwriting local edits."""
    report, files = verify_bundle(source)
    root = target_root.absolute()
    if any(part.is_symlink() for part in (root, *root.parents)):
        raise ValueError("Installation paths must not contain symbolic links.")
    if not root.is_dir():
        raise ValueError("The target episode catalog directory must already exist.")
    destination = root / report["folder"]
    result = {"episodeId": report["episodeId"], "directory": str(destination),
              "testCount": report["testCount"], "transcriptStatus": report["transcriptStatus"]}
    if audio_only:
        if not destination.exists():
            raise ValueError("Audio-only installation requires an existing episode directory.")
        episode_directory(destination)
        if manifest(destination).get("publicId") != report["episodeId"]:
            raise ValueError("The existing episode identity does not match the bundle.")
        audio = destination / "audio.mp3"
        if audio.exists() or audio.is_symlink():
            if regular_file(audio, MAX_AUDIO_BYTES).read_bytes() == files["audio.mp3"]:
                return {**result, "action": "unchanged"}
            raise ValueError("The episode already contains different audio; preserve or remove it explicitly first.")
        fd, temporary = tempfile.mkstemp(prefix=".episode-audio-", suffix=".tmp", dir=destination)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(files["audio.mp3"])
            os.chmod(temporary, 0o644)
            # Creating a hard link is exclusive: even a concurrent install cannot overwrite local audio.
            os.link(temporary, audio)
        finally:
            Path(temporary).unlink(missing_ok=True)
        return {**result, "action": "audio_installed"}
    if report["transcriptStatus"] == "source_reference_only" and not allow_source_transcript:
        raise ValueError("This is a source-reference-only bundle; use --allow-source-transcript to install it explicitly.")
    if destination.exists() or destination.is_symlink():
        raise ValueError("Episode directory already exists. Use --audio-only to preserve local metadata and tests.")
    # Stage outside the watched catalog, on the same filesystem, so deployment never sees half an episode.
    with tempfile.TemporaryDirectory(prefix=".vocora-episode-", dir=root.parent) as temporary:
        staged = Path(temporary) / report["folder"]
        staged.mkdir(mode=0o755)
        for name, content in files.items():
            atomic_write(staged / name, content)
        atomic_write(staged / "BUNDLE.json", (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        if destination.exists() or destination.is_symlink():
            raise ValueError("Episode directory already exists; no files were replaced.")
        staged.rename(destination)
    return {**result, "action": "installed"}


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
    verify = subcommands.add_parser("verify", help="Verify bundle paths, checksums, metadata and the actual episode schema.")
    verify.add_argument("bundle", type=Path)
    install = subcommands.add_parser("install", help="Install a validated bundle without overwriting local episode edits.")
    install.add_argument("bundle", type=Path)
    install.add_argument("--into", dest="target", type=Path, required=True)
    install.add_argument("--audio-only", action="store_true")
    install.add_argument("--allow-source-transcript", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "verify":
            report, _ = verify_bundle(args.bundle)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0
        if args.command == "install":
            report = install_bundle(args.bundle, args.target, audio_only=args.audio_only,
                                    allow_source_transcript=args.allow_source_transcript)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0
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
    except (ValueError, OSError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f"Episode preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
