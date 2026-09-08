---
type: Decision
title: Vocora URL Identity and Resource Naming Convention
description: Stable numeric public route identities for Learning Paths, lessons, and exercises.
tags: [architecture, learning-path, routing, resource-names, public-identity]
timestamp: 2026-09-08T07:30:00Z
---

Vocora uses stable, database-generated numeric public IDs for Learning Path
routes. Titles, display names, source slugs, and internal database keys are not
route identifiers.

# Problem

The original exercise URL embedded source-shaped string IDs:

```text
/learning-path/bbc-six-minute-english-learning-path/lessons/bbc-6-minute-english-260402/exercises/bbc6-bbc-6-minute-english-260402-quick-review
```

Those identifiers looked like display slugs, produced long URLs, invited
renaming mistakes, and made naming conflicts part of navigation design. The
route also used a singular collection segment even though it addressed one
resource from a collection.

# External Principles Considered

Google's API Design Guide and approved AIPs were used as architectural evidence,
not copied as a complete API framework.

* Model the API around named resources and their parent-child hierarchy.
* Alternate plural collection names and resource identifiers in resource names.
* Keep resource identification independent from the database schema; exposing
  the storage key directly tightly couples the API to persistence.
* Return canonical resource identities even when an alias is accepted during a
  migration.
* Keep identifiers stable across API and product evolution.

Vocora adopts those principles for addressability and stability. It does not
adopt Google's entire `name`-field or RPC method convention because the current
Express and Angular contracts already use concise ID fields.

# Decision

The canonical browser hierarchy is:

```text
/learning-paths/{pathPublicId}
/learning-paths/{pathPublicId}/lessons/{lessonPublicId}/exercises/{exercisePublicId}
```

Valid examples:

```text
/learning-paths/1
/learning-paths/1/lessons/5/exercises/10
```

Collection segments are plural. IDs contain decimal digits only and do not use
`lp-`, `ls-`, or `ex-` prefixes because the surrounding collection segment
already supplies the resource type. Each resource type has its own globally
unique sequence, so child IDs remain unambiguous while the hierarchy still
enforces parent membership.

The JSON API represents these `BIGINT` public IDs as decimal strings to avoid
JavaScript integer precision loss. They remain numeric identifiers in URLs.

# Identity Separation

Each resource has three distinct identities:

1. The existing internal `BIGINT` primary key owns relational joins and learner
   progress foreign keys and is never exposed.
2. The existing source-owned string ID continues to reconcile file-managed
   definitions and preserve content identity.
3. A route mapping table owns an immutable, auto-incrementing numeric public ID.

Vocora keeps the current internal `BIGINT` keys instead of migrating them to
UUIDs. UUID conversion would rewrite mature foreign-key and progress boundaries
without improving URL stability or privacy. Separation, not UUID syntax, is the
required property.

The database backfills mapping rows for existing resources, allocates new IDs
with `AUTO_INCREMENT` after resource insertion, enforces one mapping per
resource, and prevents mapping updates. Numeric IDs are not authorization:
every lookup remains authenticated and resource-scoped.

# Migration

Migration `020_learning_path_route_public_ids.sql` adds and backfills route-ID
mapping tables without changing internal keys, source IDs, learner progress, or
content rows. Existing resources receive IDs in internal creation order; future
IDs increase independently for paths, lessons, and exercises.

New navigation and API calls use canonical numeric IDs. Existing singular
slug-based exercise URLs remain a temporary compatibility alias: the frontend
calls an authenticated legacy resolver, verifies the path/lesson/exercise
hierarchy, and replaces the browser URL with the canonical numeric URL. Existing
`/library/{collectionId}/learning-path` links similarly load once and replace
the URL with `/learning-paths/{pathPublicId}`. Compatibility aliases return
canonical IDs and must not become a second permanent identity system.

Bookmarks and analytics should store the canonical URL after redirect. Route
IDs never change when titles, source display text, positions, or content
versions change. Retired resources keep their mapping so IDs are never reused.

# Citations

[1] [Google API Design Guide](https://cloud.google.com/apis/design)
[2] [Google API Design Guide: Resource names](https://cloud.google.com/apis/design/resource_names)
[3] [AIP-121: Resource-oriented design](https://google.aip.dev/121)
[4] [AIP-122: Resource names](https://google.aip.dev/122)
[5] [Collection Learning Path architecture](../../docs/COLLECTION_LEARNING_PATH.md)
[6] [Route identity migration](../../back/database/migrations/020_learning_path_route_public_ids.sql)
