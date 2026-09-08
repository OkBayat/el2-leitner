---
type: Concept
title: Repository Source Of Truth
description: Canonical source locations and architecture boundaries for Vocora.
tags: [project, repository, source-of-truth, architecture]
timestamp: 2026-09-08T04:00:00Z
---

Vocora source truth is split across backend source, frontend source, database
migrations, and checked-in configuration.

# Canonical Locations

* Backend application source lives under `back/src/**`.
* Frontend application source lives under `ui/src/**`.
* Database schema evolution lives in checked-in database migrations.
* File-managed vocabulary collections live under `back/data/collections/**`.
* File-managed listening episodes live under `back/data/listening/episodes/**`.

# Architecture Boundary

Backend changes preserve the existing Domain/Application/Infrastructure/Interface
separation. Frontend changes preserve the existing Angular
service/state/component boundaries.

# Authority Rule

Build output, generated artifacts, Docker layers, caches, and temporary files are
not source truth. When OKF content disagrees with current source or explicit
repository documentation, verify the source and correct the OKF concept.

# Citations

[1] [Vocora agent guide](../../AGENTS.md)
