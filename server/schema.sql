-- ---------------------------------------------------------------------------
-- Tengile MalaMala — enquiry submissions
-- Covers all fields collected across the three Plan Your Stay steps,
-- plus the contact fields and the quick modal enquiry.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enquiries (
  id                BIGSERIAL PRIMARY KEY,

  -- Step 1: Dates & guests
  arrival_date      DATE,
  departure_date    DATE,
  adults            SMALLINT,
  children          SMALLINT,
  flexibility       TEXT,

  -- Step 2: Lodge & transfers
  lodge             TEXT,
  transfer          TEXT,
  experiences       TEXT,

  -- Step 3: Final details (contact)
  full_name         TEXT,
  email             TEXT,
  phone             TEXT,
  country           TEXT,
  notes             TEXT,
  consent           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Provenance / ops (no secrets, no IP addresses)
  source            TEXT NOT NULL DEFAULT 'plan-your-stay',
  status            TEXT NOT NULL DEFAULT 'new',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_status_idx     ON enquiries (status);
