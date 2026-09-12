# Operational scripts

Keep small repository-level operational Bash entrypoints in this directory. These scripts should be invoked from the repository root and should delegate domain-specific work to the owning application/tool instead of duplicating business logic.

## Listening episode bundle installer

```bash
bash scripts/install-listening-episode.sh <episode-bundle.zip>
```

The installer:

1. verifies the ZIP with `back/scripts/manage-listening-episode.py`;
2. detects the episode folder from the verified bundle;
3. installs only the ignored `audio.mp3` when that episode already exists;
4. installs the complete bundle when it is a new episode;
5. refuses unsafe bundles and does not overwrite different existing audio;
6. does not deploy automatically.

Example:

```bash
bash scripts/install-listening-episode.sh vocora-bbc-260618-source-reference.zip
```

After reviewing the installed content, deploy separately when intended:

```bash
bash scripts/deploy.sh
```

## Deployment

```bash
bash scripts/deploy.sh
```

Deployment remains a separate explicit action so installing local content cannot restart production accidentally.
Its environment contract, incremental build behavior, and private Ollama/Qwen
provisioning are documented in [Server deployment](../docs/DEPLOYMENT.md).
