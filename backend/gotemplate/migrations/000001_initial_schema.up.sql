CREATE TABLE example
(
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(200) NOT NULL,
    created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX example_name_idx ON example (name);
