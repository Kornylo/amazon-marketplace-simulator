CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sellers / credentials
CREATE TABLE IF NOT EXISTS sim_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL UNIQUE,
  lwa_client_id VARCHAR NOT NULL,
  lwa_client_secret VARCHAR NOT NULL,
  marketplace_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access tokens issued by LWA
CREATE TABLE IF NOT EXISTS sim_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL,
  token VARCHAR NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listings state
CREATE TABLE IF NOT EXISTS sim_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Active',
  price NUMERIC(10,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  quantity INTEGER DEFAULT 0,
  issues JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '{}',
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, marketplace_id, sku)
);

-- Inventory state
CREATE TABLE IF NOT EXISTS sim_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  fulfillable_quantity INTEGER DEFAULT 0,
  inbound_working_quantity INTEGER DEFAULT 0,
  inbound_shipped_quantity INTEGER DEFAULT 0,
  inbound_receiving_quantity INTEGER DEFAULT 0,
  reserved_fc_processing INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, marketplace_id, sku)
);

-- Pricing state
CREATE TABLE IF NOT EXISTS sim_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  listed_price JSONB,
  competitive_price JSONB,
  buy_box_price JSONB,
  buy_box_winner BOOLEAN DEFAULT false,
  hijacker_present BOOLEAN DEFAULT false,
  hijacker_price JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, marketplace_id, asin)
);

-- Orders
CREATE TABLE IF NOT EXISTS sim_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Pending',
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  last_updated_date TIMESTAMPTZ DEFAULT NOW(),
  order_total JSONB,
  ship_service_level VARCHAR DEFAULT 'Standard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS sim_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  title VARCHAR,
  quantity_ordered INTEGER DEFAULT 1,
  quantity_shipped INTEGER DEFAULT 0,
  item_price JSONB
);

-- Catalog / PIM
CREATE TABLE IF NOT EXISTS sim_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin VARCHAR NOT NULL UNIQUE,
  title VARCHAR NOT NULL,
  brand VARCHAR,
  product_type VARCHAR,
  dimensions JSONB,
  images JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '{}',
  sales_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments
CREATE TABLE IF NOT EXISTS sim_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'CREATED',
  ship_from_address JSONB,
  fulfillment_center_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support cases
CREATE TABLE IF NOT EXISTS sim_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  case_type VARCHAR NOT NULL,
  sku VARCHAR,
  asin VARCHAR,
  subject VARCHAR NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reimbursements
CREATE TABLE IF NOT EXISTS sim_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  sku VARCHAR NOT NULL,
  asin VARCHAR NOT NULL,
  reason VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'SUBMITTED',
  expected_dimensions JSONB,
  current_dimensions JSONB,
  estimated_overcharge JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller Central Actions
CREATE TABLE IF NOT EXISTS sim_sc_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id VARCHAR NOT NULL UNIQUE,
  type VARCHAR NOT NULL,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  sku VARCHAR,
  asin VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'DRAFT',
  payload JSONB NOT NULL DEFAULT '{}',
  before_state JSONB,
  after_state JSONB,
  validation_errors JSONB DEFAULT '[]',
  decision_reason VARCHAR,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SC Action events
CREATE TABLE IF NOT EXISTS sim_sc_action_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  from_status VARCHAR,
  to_status VARCHAR,
  actor VARCHAR DEFAULT 'system',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock updates (SP-API submission tracking)
CREATE TABLE IF NOT EXISTS sim_mock_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  marketplace_id VARCHAR NOT NULL,
  update_type VARCHAR NOT NULL,
  sku VARCHAR,
  asin VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'SUBMITTED',
  payload JSONB NOT NULL DEFAULT '{}',
  validation_errors JSONB DEFAULT '[]',
  decision_reason VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock update events
CREATE TABLE IF NOT EXISTS sim_mock_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  from_status VARCHAR,
  to_status VARCHAR,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active scenario per seller
CREATE TABLE IF NOT EXISTS sim_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL UNIQUE,
  scenario_key VARCHAR NOT NULL DEFAULT 'HEALTHY',
  config JSONB DEFAULT '{}',
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- SC Action policies
CREATE TABLE IF NOT EXISTS sim_sc_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR NOT NULL UNIQUE,
  policy VARCHAR NOT NULL DEFAULT 'APPROVE_ONLY_VALID',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS sim_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id VARCHAR NOT NULL UNIQUE,
  seller_id VARCHAR NOT NULL,
  report_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'IN_QUEUE',
  document_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS sim_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor VARCHAR DEFAULT 'system',
  action VARCHAR NOT NULL,
  resource_type VARCHAR,
  resource_id VARCHAR,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
