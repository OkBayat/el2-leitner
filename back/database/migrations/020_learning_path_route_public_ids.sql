CREATE TABLE IF NOT EXISTS learning_path_route_ids (
  public_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  learning_path_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (public_id),
  UNIQUE KEY learning_path_route_ids_resource_unique (learning_path_id),
  CONSTRAINT learning_path_route_ids_path_fk
    FOREIGN KEY (learning_path_id) REFERENCES collection_learning_paths (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_path_lesson_route_ids (
  public_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (public_id),
  UNIQUE KEY learning_path_lesson_route_ids_resource_unique (lesson_id),
  CONSTRAINT learning_path_lesson_route_ids_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES learning_path_lessons (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_path_exercise_route_ids (
  public_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  exercise_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (public_id),
  UNIQUE KEY learning_path_exercise_route_ids_resource_unique (exercise_id),
  CONSTRAINT learning_path_exercise_route_ids_exercise_fk
    FOREIGN KEY (exercise_id) REFERENCES learning_path_exercises (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TRIGGER IF NOT EXISTS collection_learning_paths_assign_route_id
AFTER INSERT ON collection_learning_paths
FOR EACH ROW
INSERT INTO learning_path_route_ids (learning_path_id) VALUES (NEW.id);

CREATE TRIGGER IF NOT EXISTS learning_path_lessons_assign_route_id
AFTER INSERT ON learning_path_lessons
FOR EACH ROW
INSERT INTO learning_path_lesson_route_ids (lesson_id) VALUES (NEW.id);

CREATE TRIGGER IF NOT EXISTS learning_path_exercises_assign_route_id
AFTER INSERT ON learning_path_exercises
FOR EACH ROW
INSERT INTO learning_path_exercise_route_ids (exercise_id) VALUES (NEW.id);

INSERT IGNORE INTO learning_path_route_ids (learning_path_id)
SELECT id FROM collection_learning_paths ORDER BY id;

INSERT IGNORE INTO learning_path_lesson_route_ids (lesson_id)
SELECT id FROM learning_path_lessons ORDER BY id;

INSERT IGNORE INTO learning_path_exercise_route_ids (exercise_id)
SELECT id FROM learning_path_exercises ORDER BY id;

DROP TEMPORARY TABLE IF EXISTS learning_path_route_identity_verification;

CREATE TEMPORARY TABLE learning_path_route_identity_verification (
  missing_count BIGINT UNSIGNED NOT NULL,
  CONSTRAINT learning_path_route_identity_complete CHECK (missing_count = 0)
);

INSERT INTO learning_path_route_identity_verification (missing_count)
SELECT
  (SELECT COUNT(*)
   FROM collection_learning_paths p
   LEFT JOIN learning_path_route_ids pr ON pr.learning_path_id = p.id
   WHERE pr.learning_path_id IS NULL)
  + (SELECT COUNT(*)
     FROM learning_path_lessons l
     LEFT JOIN learning_path_lesson_route_ids lr ON lr.lesson_id = l.id
     WHERE lr.lesson_id IS NULL)
  + (SELECT COUNT(*)
     FROM learning_path_exercises e
     LEFT JOIN learning_path_exercise_route_ids er ON er.exercise_id = e.id
     WHERE er.exercise_id IS NULL);

DROP TEMPORARY TABLE learning_path_route_identity_verification;

CREATE TRIGGER IF NOT EXISTS learning_path_route_ids_generated_only
BEFORE INSERT ON learning_path_route_ids
FOR EACH ROW
SET NEW.learning_path_id = IF(COALESCE(NEW.public_id, 0) = 0, NEW.learning_path_id, NULL);

CREATE TRIGGER IF NOT EXISTS learning_path_lesson_route_ids_generated_only
BEFORE INSERT ON learning_path_lesson_route_ids
FOR EACH ROW
SET NEW.lesson_id = IF(COALESCE(NEW.public_id, 0) = 0, NEW.lesson_id, NULL);

CREATE TRIGGER IF NOT EXISTS learning_path_exercise_route_ids_generated_only
BEFORE INSERT ON learning_path_exercise_route_ids
FOR EACH ROW
SET NEW.exercise_id = IF(COALESCE(NEW.public_id, 0) = 0, NEW.exercise_id, NULL);

CREATE TRIGGER IF NOT EXISTS learning_path_route_ids_immutable
BEFORE UPDATE ON learning_path_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path route identities are immutable.';

CREATE TRIGGER IF NOT EXISTS learning_path_lesson_route_ids_immutable
BEFORE UPDATE ON learning_path_lesson_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path lesson route identities are immutable.';

CREATE TRIGGER IF NOT EXISTS learning_path_exercise_route_ids_immutable
BEFORE UPDATE ON learning_path_exercise_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path exercise route identities are immutable.';

CREATE TRIGGER IF NOT EXISTS learning_path_route_ids_append_only
BEFORE DELETE ON learning_path_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path route identities are append-only.';

CREATE TRIGGER IF NOT EXISTS learning_path_lesson_route_ids_append_only
BEFORE DELETE ON learning_path_lesson_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path lesson route identities are append-only.';

CREATE TRIGGER IF NOT EXISTS learning_path_exercise_route_ids_append_only
BEFORE DELETE ON learning_path_exercise_route_ids
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Learning Path exercise route identities are append-only.';

CREATE TRIGGER IF NOT EXISTS collection_learning_paths_parent_immutable
BEFORE UPDATE ON collection_learning_paths
FOR EACH ROW
SET NEW.collection_id = IF(NEW.collection_id <=> OLD.collection_id, OLD.collection_id, NULL);

CREATE TRIGGER IF NOT EXISTS learning_path_lessons_parent_immutable
BEFORE UPDATE ON learning_path_lessons
FOR EACH ROW
SET NEW.learning_path_id = IF(NEW.learning_path_id <=> OLD.learning_path_id, OLD.learning_path_id, NULL);

CREATE TRIGGER IF NOT EXISTS learning_path_exercises_parent_immutable
BEFORE UPDATE ON learning_path_exercises
FOR EACH ROW
SET NEW.lesson_id = IF(NEW.lesson_id <=> OLD.lesson_id, OLD.lesson_id, NULL);
