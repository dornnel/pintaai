-- Add support for bidirectional reviews (painter → customer)
ALTER TABLE pintae.reviews
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'customer_to_painter',
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES pintae.users(id);

-- Index for querying by direction and reviewer
CREATE INDEX IF NOT EXISTS idx_reviews_direction ON pintae.reviews(direction);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON pintae.reviews(reviewer_id);
