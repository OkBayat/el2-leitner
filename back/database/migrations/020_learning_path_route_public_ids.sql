CREATE TABLE learning_path_route_ids (
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

CREATE TABLE learning_path_lesson_route_ids (
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

CREATE TABLE learning_path_exercise_route_ids (
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

INSERT INTO learning_path_route_ids (learning_path_id)
SELECT id FROM collection_learning_paths ORDER BY id;

INSERT INTO learning_path_lesson_route_ids (lesson_id)
SELECT id FROM learning_path_lessons ORDER BY id;

INSERT INTO learning_path_exercise_route_ids (exercise_id)
SELECT id FROM learning_path_exercises ORDER BY id;

CREATE TRIGGER collection_learning_paths_assign_route_id
AFTER INSERT ON collection_learning_paths
FOR EACH ROW
INSERT INTO learning_path_route_ids (learning_path_id) VALUES (NEW.id);

CREATE TRIGGER learning_path_lessons_assign_route_id
AFTER INSERT ON learning_path_lessons
FOR EACH ROW
INSERT INTO learning_path_lesson_route_ids (lesson_id) VALUES (NEW.id);

CREATE TRIGGER learning_path_exercises_assign_route_id
AFTER INSERT ON learning_path_exercises
FOR EACH ROW
INSERT INTO learning_path_exercise_route_ids (exercise_id) VALUES (NEW.id);

CREATE TRIGGER learning_path_route_ids_immutable
BEFORE UPDATE ON learning_path_route_ids
FOR EACH ROW
SET NEW.public_id = OLD.public_id, NEW.learning_path_id = OLD.learning_path_id;

CREATE TRIGGER learning_path_lesson_route_ids_immutable
BEFORE UPDATE ON learning_path_lesson_route_ids
FOR EACH ROW
SET NEW.public_id = OLD.public_id, NEW.lesson_id = OLD.lesson_id;

CREATE TRIGGER learning_path_exercise_route_ids_immutable
BEFORE UPDATE ON learning_path_exercise_route_ids
FOR EACH ROW
SET NEW.public_id = OLD.public_id, NEW.exercise_id = OLD.exercise_id;
