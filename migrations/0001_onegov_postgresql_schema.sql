-- OneGov Zambia PostgreSQL + PostGIS + pgvector Reference Migration (0001)
-- Compatible with PostgreSQL 16+, PostGIS 3.4+, pgvector 0.7+

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT 'Lusaka',
  status TEXT NOT NULL DEFAULT 'active',
  integration_mode TEXT NOT NULL DEFAULT 'sandbox',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  nrc_number TEXT,
  role TEXT NOT NULL DEFAULT 'citizen',
  institution_id INTEGER REFERENCES institutions(id),
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  low_data_mode BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_institution ON users(institution_id);

CREATE TABLE IF NOT EXISTS revenue_zones (
  id SERIAL PRIMARY KEY,
  zone_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT NOT NULL,
  council_name TEXT NOT NULL,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  expected_revenue_zmw INTEGER NOT NULL,
  actual_revenue_zmw INTEGER NOT NULL,
  registered_businesses INTEGER NOT NULL,
  active_permits INTEGER NOT NULL,
  unpaid_properties INTEGER NOT NULL,
  latitude TEXT NOT NULL,
  longitude TEXT NOT NULL,
  geom GEOGRAPHY(POINT, 4326),
  map_x INTEGER NOT NULL,
  map_y INTEGER NOT NULL,
  indicators_json JSONB NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_revenue_zones_province ON revenue_zones(province);
CREATE INDEX idx_revenue_zones_geom ON revenue_zones USING GIST(geom);

CREATE TABLE IF NOT EXISTS ip_applications (
  id SERIAL PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  applicant_user_id INTEGER NOT NULL REFERENCES users(id),
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  ip_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  classification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  similarity_report_json JSONB,
  embedding VECTOR(768),
  reviewed_by_user_id INTEGER REFERENCES users(id),
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ip_applications_type ON ip_applications(ip_type);
