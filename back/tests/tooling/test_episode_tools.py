import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("episode_tools", ROOT / "scripts/manage-listening-episode.py")
tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tools)


class EpisodeToolsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)
        source = ROOT / "data/listening/episodes/2026-06-18-limiting-screen-time-for-children"
        self.episode = self.root / source.name
        self.episode.mkdir()
        for filename in ("episode.json", "listening.json", "cover.jpg", "vocabulary.md", "transcript.md"):
            shutil.copyfile(source / filename, self.episode / filename)
        (self.episode / "audio.mp3").write_bytes(b"ID3" + bytes(128))

    def test_official_urls_only_including_redirect_targets(self):
        self.assertEqual(tools.bbc_url("https://downloads.bbc.co.uk/audio.mp3"), "https://downloads.bbc.co.uk/audio.mp3")
        for url in ("http://bbc.co.uk/a", "https://bbc.co.uk.evil.test/a", "https://127.0.0.1/a",
                    "https://bbc.co.uk:999/a", "https://user:password@bbc.co.uk/a", "file:///etc/passwd"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                tools.bbc_url(url)

    def test_wrong_media_content_is_rejected(self):
        for name in ("audio.mp3", "cover.jpg", "cover.png", "cover.webp"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                tools.validate_media(b"<html>Access denied</html>", name)

    def test_asset_fetch_does_not_replace_existing_files(self):
        with patch.object(tools, "build_opener") as opener:
            tools.fetch_assets(self.episode)
            opener.return_value.open.assert_not_called()

    def test_missing_audio_fails_actual_node_validation(self):
        (self.episode / "audio.mp3").unlink()
        with self.assertRaises(tools.subprocess.CalledProcessError):
            tools.package_episode(self.episode, self.root / "broken.zip", allow_source_transcript=True)
        self.assertFalse((self.root / "broken.zip").exists())

    def test_source_only_transcript_is_not_misrepresented_as_complete(self):
        with self.assertRaisesRegex(ValueError, "Full transcript is missing"):
            tools.package_episode(self.episode, self.root / "incomplete.zip")

    def test_authorized_local_transcript_import_preserves_speaker_paragraphs(self):
        local = self.root / "authorized.txt"
        local.write_text("Neil: A sample supplied by the author.\n\nBeth: Another original sentence.", encoding="utf-8")
        tools.import_transcript(self.episode, local)
        self.assertIn("\n\nBeth:", (self.episode / "transcript.md").read_text())
        report = tools.package_episode(self.episode, self.root / "authorized.zip")
        self.assertEqual(report["transcriptStatus"], "provided_unverified")

    def test_bundle_is_deterministic_checksummed_and_has_only_required_files(self):
        (self.episode / "unrelated-private.txt").write_text("Never put me into a ZIP")
        a, b = self.root / "a.zip", self.root / "b.zip"
        report = tools.package_episode(self.episode, a, allow_source_transcript=True)
        tools.package_episode(self.episode, b, allow_source_transcript=True)
        self.assertEqual(a.read_bytes(), b.read_bytes())
        self.assertEqual(report["testCount"], 3)
        self.assertEqual(report["transcriptStatus"], "source_reference_only")
        with zipfile.ZipFile(a) as archive:
            self.assertEqual(len(archive.namelist()), 7)
            for name, info in report["files"].items():
                content = archive.read(self.episode.name + "/" + name)
                self.assertEqual(info["sha256"], tools.hashlib.sha256(content).hexdigest())
            self.assertNotIn("unrelated-private.txt", " ".join(archive.namelist()))

    def test_packaging_does_not_overwrite_an_existing_zip(self):
        destination = self.root / "keep.zip"
        destination.write_bytes(b"keep")
        with self.assertRaisesRegex(ValueError, "already exists"):
            tools.package_episode(self.episode, destination, allow_source_transcript=True)
        self.assertEqual(destination.read_bytes(), b"keep")

    def test_symlinked_asset_or_directory_is_rejected(self):
        (self.episode / "audio.mp3").unlink()
        (self.episode / "audio.mp3").symlink_to(self.episode / "episode.json")
        with self.assertRaises(ValueError):
            tools.regular_file(self.episode / "audio.mp3")
        linked = self.root / "2026-06-18-linked"
        linked.symlink_to(self.episode)
        with self.assertRaises(ValueError):
            tools.episode_directory(linked)

    def test_manifest_cannot_select_arbitrary_files(self):
        data = json.loads((self.episode / "episode.json").read_text())
        data["imageFile"] = "../../credentials.json"
        (self.episode / "episode.json").write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            tools.manifest(self.episode)


if __name__ == "__main__":
    unittest.main()
