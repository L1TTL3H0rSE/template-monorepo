-- name: GetExample :one
SELECT id, name, created_at
FROM example
WHERE id = $1;

-- name: ListExamples :many
SELECT id, name, created_at
FROM example
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC
LIMIT sqlc.arg('page_size') OFFSET sqlc.arg('page_offset');

-- name: CountExamples :one
SELECT COUNT(*)::bigint AS total
FROM example
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: CountExamplesByName :one
SELECT COUNT(*)::bigint AS total
FROM example
WHERE name = $1;

-- name: CreateExample :one
INSERT INTO example (name)
VALUES ($1)
RETURNING id, name, created_at;

-- name: UpdateExampleName :one
UPDATE example
SET name = $2
WHERE id = $1
RETURNING id, name, created_at;

-- name: DeleteExample :exec
DELETE FROM example
WHERE id = $1;
