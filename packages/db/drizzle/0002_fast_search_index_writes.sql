CREATE INDEX IF NOT EXISTS "idx_folders_parent_name_id" ON "folders" USING btree ("parent_id","name","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_folders_root_name_id" ON "folders" USING btree ("name","id") WHERE "parent_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_folder_name_id" ON "files" USING btree ("folder_id","name","id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_parent_path(p_parent_folder_id integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	parent_path text;
BEGIN
	IF p_parent_folder_id IS NULL THEN
		RETURN NULL;
	END IF;

	SELECT path
	INTO parent_path
	FROM search_index
	WHERE item_type = 'folder'
	AND item_id = p_parent_folder_id;

	IF parent_path IS NULL THEN
		parent_path := search_index_folder_path(p_parent_folder_id);
	END IF;

	RETURN parent_path;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION search_index_sync_folder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	parent_path text;
	folder_path text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM search_index
		WHERE item_type = 'folder'
		AND item_id = OLD.id;
		RETURN OLD;
	END IF;

	IF TG_OP = 'INSERT' THEN
		parent_path := search_index_parent_path(NEW.parent_id);

		IF NEW.parent_id IS NOT NULL AND parent_path IS NULL THEN
			RETURN NEW;
		END IF;

		folder_path := COALESCE(parent_path, '') || '/' || NEW.name;

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
			'folder',
			NEW.id,
			NEW.name,
			NEW.parent_id,
			folder_path,
			now(),
			now()
		)
		ON CONFLICT (item_type, item_id) DO UPDATE SET
			name = EXCLUDED.name,
			parent_folder_id = EXCLUDED.parent_folder_id,
			path = EXCLUDED.path,
			updated_at = now();

		RETURN NEW;
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

	folder_path := search_index_parent_path(NEW.folder_id);

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
$$;
