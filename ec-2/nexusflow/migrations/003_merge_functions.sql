CREATE OR REPLACE FUNCTION are_fuzzy_equal(val1 TEXT, val2 TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    IF val1::NUMERIC = val2::NUMERIC THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN val1 = val2;
END;
$$;

CREATE OR REPLACE FUNCTION jsonb_deep_merge(a JSONB, b JSONB)
RETURNS JSONB
LANGUAGE SQL IMMUTABLE
AS $$
    SELECT jsonb_object_agg(
        COALESCE(ka, kb),
        CASE
            WHEN va IS NULL THEN vb
            WHEN vb IS NULL THEN va
            WHEN jsonb_typeof(va) = 'object' AND jsonb_typeof(vb) = 'object' THEN jsonb_deep_merge(va, vb)
            ELSE vb
        END
    )
    FROM jsonb_each(a) AS e1(ka, va)
    FULL JOIN jsonb_each(b) AS e2(kb, vb) ON ka = kb
$$;
