-- Add missing columns for per-stream level/points if not present

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='stream_participants' AND column_name='level'
    ) THEN
        ALTER TABLE stream_participants ADD COLUMN level INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='stream_participants' AND column_name='puntos'
    ) THEN
        ALTER TABLE stream_participants ADD COLUMN puntos INTEGER DEFAULT 0;
    END IF;

    -- joined_at and left_at may already exist; add if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='stream_participants' AND column_name='joined_at'
    ) THEN
        ALTER TABLE stream_participants ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='stream_participants' AND column_name='left_at'
    ) THEN
        ALTER TABLE stream_participants ADD COLUMN left_at TIMESTAMP WITH TIME ZONE;
    END IF;
END$$;
