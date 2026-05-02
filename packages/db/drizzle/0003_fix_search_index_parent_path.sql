DROP FUNCTION IF EXISTS search_index_parent_path(integer);--> statement-breakpoint
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
$$;
