CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" integer,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_search_index_item" ON "search_index" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "idx_search_index_cursor" ON "search_index" USING btree ("item_type","name","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_folders_name_trgm" ON "folders" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_name_trgm" ON "files" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_index_name_trgm" ON "search_index" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_index_path_trgm" ON "search_index" USING gin ("path" gin_trgm_ops);--> statement-breakpoint
WITH RECURSIVE folder_paths AS (
	SELECT
		id,
		name,
		parent_id,
		('/' || name)::text AS path
	FROM folders
	WHERE parent_id IS NULL

	UNION ALL

	SELECT
		f.id,
		f.name,
		f.parent_id,
		folder_paths.path || '/' || f.name AS path
	FROM folders f
	JOIN folder_paths ON f.parent_id = folder_paths.id
)
INSERT INTO search_index (
	item_type,
	item_id,
	name,
	parent_folder_id,
	path,
	created_at,
	updated_at
)
SELECT
	'folder',
	id,
	name,
	parent_id,
	path,
	now(),
	now()
FROM folder_paths
UNION ALL
SELECT
	'file',
	files.id,
	files.name,
	files.folder_id,
	folder_paths.path || '/' || files.name,
	now(),
	now()
FROM files
JOIN folder_paths ON files.folder_id = folder_paths.id
ON CONFLICT (item_type, item_id) DO UPDATE SET
	name = EXCLUDED.name,
	parent_folder_id = EXCLUDED.parent_folder_id,
	path = EXCLUDED.path,
	updated_at = now();--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_folder_path(folder_id integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	result text;
BEGIN
	WITH RECURSIVE ancestors AS (
		SELECT
			id,
			name,
			parent_id,
			0 AS depth
		FROM folders
		WHERE id = folder_id

		UNION ALL

		SELECT
			parent.id,
			parent.name,
			parent.parent_id,
			ancestors.depth + 1
		FROM folders parent
		JOIN ancestors ON ancestors.parent_id = parent.id
	)
	SELECT '/' || string_agg(name, '/' ORDER BY depth DESC)
	INTO result
	FROM ancestors;

	RETURN result;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_rebuild_folder_subtree(root_folder_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	root_path text;
BEGIN
	root_path := search_index_folder_path(root_folder_id);

	IF root_path IS NULL THEN
		RETURN;
	END IF;

	WITH RECURSIVE folder_tree AS (
		SELECT
			id,
			name,
			parent_id,
			root_path AS path
		FROM folders
		WHERE id = root_folder_id

		UNION ALL

		SELECT
			child.id,
			child.name,
			child.parent_id,
			folder_tree.path || '/' || child.name AS path
		FROM folders child
		JOIN folder_tree ON child.parent_id = folder_tree.id
	)
	INSERT INTO search_index (
		item_type,
		item_id,
		name,
		parent_folder_id,
		path,
		created_at,
		updated_at
	)
	SELECT
		'folder',
		id,
		name,
		parent_id,
		path,
		now(),
		now()
	FROM folder_tree
	UNION ALL
	SELECT
		'file',
		files.id,
		files.name,
		files.folder_id,
		folder_tree.path || '/' || files.name,
		now(),
		now()
	FROM files
	JOIN folder_tree ON files.folder_id = folder_tree.id
	ON CONFLICT (item_type, item_id) DO UPDATE SET
		name = EXCLUDED.name,
		parent_folder_id = EXCLUDED.parent_folder_id,
		path = EXCLUDED.path,
		updated_at = now();
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_sync_folder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM search_index
		WHERE item_type = 'folder'
		AND item_id = OLD.id;
		RETURN OLD;
	END IF;

	PERFORM search_index_rebuild_folder_subtree(NEW.id);
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_sync_file()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	folder_path text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM search_index
		WHERE item_type = 'file'
		AND item_id = OLD.id;
		RETURN OLD;
	END IF;

	folder_path := search_index_folder_path(NEW.folder_id);

	IF folder_path IS NULL THEN
		RETURN NEW;
	END IF;

	INSERT INTO search_index (
		item_type,
		item_id,
		name,
		parent_folder_id,
		path,
		created_at,
		updated_at
	)
	VALUES (
		'file',
		NEW.id,
		NEW.name,
		NEW.folder_id,
		folder_path || '/' || NEW.name,
		now(),
		now()
	)
	ON CONFLICT (item_type, item_id) DO UPDATE SET
		name = EXCLUDED.name,
		parent_folder_id = EXCLUDED.parent_folder_id,
		path = EXCLUDED.path,
		updated_at = now();

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER trg_search_index_folders_insert
AFTER INSERT ON folders
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_folder();--> statement-breakpoint
CREATE TRIGGER trg_search_index_folders_update
AFTER UPDATE OF name, parent_id ON folders
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_folder();--> statement-breakpoint
CREATE TRIGGER trg_search_index_folders_delete
AFTER DELETE ON folders
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_folder();--> statement-breakpoint
CREATE TRIGGER trg_search_index_files_insert
AFTER INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_file();--> statement-breakpoint
CREATE TRIGGER trg_search_index_files_update
AFTER UPDATE OF name, folder_id ON files
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_file();--> statement-breakpoint
CREATE TRIGGER trg_search_index_files_delete
AFTER DELETE ON files
FOR EACH ROW
EXECUTE FUNCTION search_index_sync_file();
