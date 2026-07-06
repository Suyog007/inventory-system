-- Drop the unused Category.position column. The client never asked for a
-- manual sort order; categories now sort alphabetically by name everywhere
-- they're displayed.
ALTER TABLE "Category" DROP COLUMN "position";
