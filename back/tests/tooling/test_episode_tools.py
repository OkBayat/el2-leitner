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

        # This test uses synthetic media, not the BBC recording. Bind the fixture's review
        # to those exact bytes, then exercise the same review and package owners as production.
        data = json.loads((self.episode / "listening.json").read_text())
        digest = tools.hashlib.sha256((self.episode / "audio.mp3").read_bytes()).hexdigest()
        for selected in data["tests"]:
            selected["sourceReview"]["audioSha256"] = digest
            selected["sourceReview"]["method"] = "Synthetic media fixture for packaging and validation regression tests."
        (self.episode / "listening.json").write_text(json.dumps(data), encoding="utf-8")
        tools.subprocess.run([
            shutil.which("node"), str(ROOT / "scripts/record-listening-question-review.js"),
            "--episode", str(self.episode), "--confirm-reviewed", "--require-audio"
        ], check=True, capture_output=True, text=True)

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

    def bundle(self):
        output = self.root / "bundle.zip"
        tools.package_episode(self.episode, output, allow_source_transcript=True)
        return output

    def rewrite_bundle(self, source, change):
        with zipfile.ZipFile(source) as archive:
            files = {info.filename: archive.read(info) for info in archive.infolist()}
        change(files)
        output = self.root / "modified.zip"
        with zipfile.ZipFile(output, "w") as archive:
            for name, content in files.items():
                archive.writestr(name, content)
        return output

    def test_verify_checks_all_hashes_and_reports_transcript_status(self):
        report, files = tools.verify_bundle(self.bundle())
        self.assertEqual(report["testCount"], 3)
        self.assertEqual(report["transcriptStatus"], "source_reference_only")
        self.assertEqual(set(files), {"episode.json", "listening.json", "cover.jpg", "audio.mp3", "transcript.md", "vocabulary.md"})

    def test_tampered_or_unexpected_bundle_members_are_rejected_before_install(self):
        bundle = self.bundle()
        for suffix, content in (("audio.mp3", b"ID3-changed"), ("../outside.txt", b"unsafe"), ("extra.txt", b"unexpected")):
            with self.subTest(suffix=suffix):
                modified = self.rewrite_bundle(bundle, lambda files: files.update({self.episode.name + "/" + suffix: content}))
                with self.assertRaises(ValueError):
                    tools.install_bundle(modified, self.root / "destination", allow_source_transcript=True)
                self.assertFalse((self.root / "destination").exists())
                modified.unlink()

    def test_bundle_manifest_must_match_validated_episode_and_transcript(self):
        bundle = self.bundle()
        for key, value in (("episodeId", "wrong-episode"), ("testCount", 999), ("transcriptStatus", "provided_unverified")):
            with self.subTest(key=key):
                def change(files):
                    name = self.episode.name + "/BUNDLE.json"
                    data = json.loads(files[name]); data[key] = value
                    files[name] = json.dumps(data).encode()
                modified = self.rewrite_bundle(bundle, change)
                with self.assertRaises(ValueError):
                    tools.verify_bundle(modified)
                modified.unlink()

    def test_new_bundle_install_is_validated_and_never_overwrites_a_directory(self):
        bundle = self.bundle()
        target = self.root / "catalog"
        target.mkdir()
        with self.assertRaisesRegex(ValueError, "source-reference"):
            tools.install_bundle(bundle, target)
        self.assertFalse((target / self.episode.name).exists())
        report = tools.install_bundle(bundle, target, allow_source_transcript=True)
        self.assertEqual(report["action"], "installed")
        self.assertEqual((target / self.episode.name / "audio.mp3").read_bytes(), (self.episode / "audio.mp3").read_bytes())
        tools.validate_for_bundle(target / self.episode.name)
        with self.assertRaisesRegex(ValueError, "already exists"):
            tools.install_bundle(bundle, target, allow_source_transcript=True)

    def test_audio_only_install_preserves_edited_json_and_transcript_and_is_idempotent(self):
        bundle = self.bundle()
        (self.episode / "audio.mp3").unlink()
        edited = (self.episode / "listening.json").read_bytes() + b"\n"
        (self.episode / "listening.json").write_bytes(edited)
        (self.episode / "transcript.md").write_text("My locally supplied transcript.")
        report = tools.install_bundle(bundle, self.root, audio_only=True)
        self.assertEqual(report["action"], "audio_installed")
        self.assertEqual((self.episode / "listening.json").read_bytes(), edited)
        self.assertEqual((self.episode / "transcript.md").read_text(), "My locally supplied transcript.")
        self.assertEqual(tools.install_bundle(bundle, self.root, audio_only=True)["action"], "unchanged")
        (self.episode / "audio.mp3").write_bytes(b"ID3-local-edition")
        with self.assertRaisesRegex(ValueError, "different audio"):
            tools.install_bundle(bundle, self.root, audio_only=True)
        self.assertEqual((self.episode / "audio.mp3").read_bytes(), b"ID3-local-edition")

    def test_audio_only_rejects_missing_or_wrong_episode_and_symlink_target(self):
        bundle = self.bundle()
        empty = self.root / "empty"; empty.mkdir()
        with self.assertRaisesRegex(ValueError, "existing episode"):
            tools.install_bundle(bundle, empty, audio_only=True)
        data = json.loads((self.episode / "episode.json").read_text())
        data["publicId"] = "wrong-episode"
        (self.episode / "episode.json").write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "identity"):
            tools.install_bundle(bundle, self.root, audio_only=True)
        linked = self.root / "linked"; linked.symlink_to(empty)
        with self.assertRaisesRegex(ValueError, "symbolic"):
            tools.install_bundle(bundle, linked, allow_source_transcript=True)

    def test_duplicate_zip_members_and_symlink_members_are_rejected(self):
        bundle = self.bundle()
        for duplicate in (True, False):
            output = self.root / ("duplicate.zip" if duplicate else "symlink.zip")
            with zipfile.ZipFile(bundle) as source, zipfile.ZipFile(output, "w") as destination:
                for info in source.infolist():
                    if not duplicate and info.filename.endswith("audio.mp3"):
                        info.external_attr = 0o120777 << 16
                    destination.writestr(info, source.read(info))
                if duplicate:
                    import warnings
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore", UserWarning)
                        destination.writestr(self.episode.name + "/audio.mp3", b"ID3")
            with self.assertRaises(ValueError):
                tools.verify_bundle(output)

    def test_rehashed_invalid_test_content_still_fails_application_validation(self):
        bundle = self.bundle()
        def change(files):
            prefix = self.episode.name + "/"
            data = json.loads(files[prefix + "listening.json"])
            data["tests"][0]["difficulty"] = "not-a-difficulty"
            content = json.dumps(data).encode()
            files[prefix + "listening.json"] = content
            report = json.loads(files[prefix + "BUNDLE.json"])
            report["files"]["listening.json"] = {"bytes": len(content), "sha256": tools.hashlib.sha256(content).hexdigest()}
            files[prefix + "BUNDLE.json"] = json.dumps(report).encode()
        modified = self.rewrite_bundle(bundle, change)
        target = self.root / "catalog"; target.mkdir()
        with self.assertRaises(tools.subprocess.CalledProcessError):
            tools.install_bundle(modified, target, allow_source_transcript=True)
        self.assertEqual(list(target.iterdir()), [])

    def test_rehashed_wrong_audio_identity_still_fails_the_quality_gate(self):
        bundle = self.bundle()
        def change(files):
            prefix = self.episode.name + "/"
            content = b"ID3-different-audio-edit"
            files[prefix + "audio.mp3"] = content
            report = json.loads(files[prefix + "BUNDLE.json"])
            report["files"]["audio.mp3"] = {"bytes": len(content), "sha256": tools.hashlib.sha256(content).hexdigest()}
            files[prefix + "BUNDLE.json"] = json.dumps(report).encode()
        modified = self.rewrite_bundle(bundle, change)
        with self.assertRaises(tools.subprocess.CalledProcessError):
            tools.verify_bundle(modified)

    def test_schema_valid_six_question_content_cannot_be_packaged(self):
        path = self.episode / "listening.json"
        data = json.loads(path.read_text())
        selected = data["tests"][0]
        selected["groups"] = selected["groups"][:2]
        for group in selected["groups"]:
            group["questions"] = group["questions"][:3]
        number = 0
        for group in selected["groups"]:
            for question in group["questions"]:
                number += 1
                question["number"] = number
        path.write_text(json.dumps(data))
        destination = self.root / "too-short.zip"
        with self.assertRaises(tools.subprocess.CalledProcessError):
            tools.package_episode(self.episode, destination, allow_source_transcript=True)
        self.assertFalse(destination.exists())

    def test_non_object_manifests_and_invalid_cover_types_are_rejected_cleanly(self):
        bundle = self.bundle()
        for value in ([], {"imageFile": []}):
            with self.subTest(value=value):
                modified = self.rewrite_bundle(bundle, lambda files: files.update({self.episode.name + "/episode.json": json.dumps(value).encode()}))
                with self.assertRaises(ValueError):
                    tools.verify_bundle(modified)
                modified.unlink()

    def test_verify_and_audio_only_install_are_available_through_the_cli(self):
        bundle = self.bundle()
        script = ROOT / "scripts/manage-listening-episode.py"
        for args in (["verify", str(bundle)], ["install", str(bundle), "--into", str(self.root), "--audio-only"]):
            result = tools.subprocess.run([tools.sys.executable, str(script), *args], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"testCount": 3', result.stdout)

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
