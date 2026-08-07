CREATE TABLE IF NOT EXISTS collections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'collection',
  visibility VARCHAR(32) NOT NULL DEFAULT 'public',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  owner_user_id BIGINT UNSIGNED NULL,
  content_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  metadata_json JSON NULL,
  source_hash CHAR(64) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP(3) NULL,
  archived_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collections_public_id_unique (public_id),
  UNIQUE KEY collections_slug_unique (slug),
  KEY collections_library_index (visibility, status, archived_at),
  KEY collections_owner_index (owner_user_id),
  CONSTRAINT collections_owner_fk
    FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  collection_id BIGINT UNSIGNED NOT NULL,
  parent_section_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collection_sections_public_id_unique (public_id),
  KEY collection_sections_collection_index (collection_id, position),
  KEY collection_sections_parent_index (parent_section_id),
  CONSTRAINT collection_sections_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT collection_sections_parent_fk
    FOREIGN KEY (parent_section_id) REFERENCES collection_sections (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocabulary_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  language_code VARCHAR(16) NOT NULL DEFAULT 'en',
  primary_form VARCHAR(512) NOT NULL,
  normalized_form VARCHAR(512) NOT NULL,
  canonical_key VARCHAR(640) NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY vocabulary_entries_public_id_unique (public_id),
  UNIQUE KEY vocabulary_entries_canonical_key_unique (canonical_key),
  KEY vocabulary_entries_lookup_index (language_code, normalized_form, owner_user_id),
  CONSTRAINT vocabulary_entries_owner_fk
    FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocabulary_forms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  form VARCHAR(512) NOT NULL,
  normalized_form VARCHAR(512) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY vocabulary_forms_entry_form_unique (vocabulary_entry_id, normalized_form),
  KEY vocabulary_forms_lookup_index (normalized_form),
  CONSTRAINT vocabulary_forms_entry_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  collection_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED NULL,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  display_form VARCHAR(512) NULL,
  note TEXT NULL,
  introduced_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  removed_version BIGINT UNSIGNED NULL,
  removed_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collection_entries_public_id_unique (public_id),
  KEY collection_entries_membership_index (collection_id, vocabulary_entry_id, removed_at),
  KEY collection_entries_collection_index (collection_id, removed_at, position),
  KEY collection_entries_vocabulary_index (vocabulary_entry_id, removed_at),
  KEY collection_entries_section_index (section_id),
  CONSTRAINT collection_entries_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT collection_entries_section_fk
    FOREIGN KEY (section_id) REFERENCES collection_sections (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT collection_entries_vocabulary_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
