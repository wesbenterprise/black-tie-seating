-- Supabase Schema for Barnett Office
-- Project: barnett-office (one project for all apps)
-- App: Seating Planner
--
-- Run this in your Supabase SQL Editor
-- Each app gets its own table(s) with a prefix pattern

-- ============================================
-- SEATING PLANNER TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS seating_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  version_name TEXT NOT NULL,
  tables JSONB NOT NULL DEFAULT '[]',
  unseated JSONB NOT NULL DEFAULT '[]',
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seating_events_key ON seating_events(key);
CREATE INDEX IF NOT EXISTS idx_seating_events_event_name ON seating_events(event_name);

-- Allow public access (no auth required)
ALTER TABLE seating_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on seating_events" ON seating_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FUTURE APPS (examples - uncomment as needed)
-- ============================================

-- Property Manager
-- CREATE TABLE IF NOT EXISTS property_units (...);
-- CREATE TABLE IF NOT EXISTS property_tenants (...);

-- Investment Tracker  
-- CREATE TABLE IF NOT EXISTS investment_deals (...);

-- Family Hub
-- CREATE TABLE IF NOT EXISTS family_tasks (...);

