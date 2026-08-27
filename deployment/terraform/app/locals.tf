data "google_project" "current" {
  project_id = var.project_id
}

check "project_identity" {
  assert {
    condition     = data.google_project.current.number == var.expected_project_number
    error_message = "Refusing app plan: project_id must resolve to project number ${var.expected_project_number}."
  }
}

data "google_service_account" "deployer" {
  project    = var.project_id
  account_id = "duka-gha-${var.environment}-deployer"
}

data "google_secret_manager_secret" "channel_key" {
  project   = var.project_id
  secret_id = "duka-${var.environment}-channel-key"
}

data "google_secret_manager_secret" "owner_password" {
  project   = var.project_id
  secret_id = "duka-${var.environment}-owner-password"
}

data "google_secret_manager_secret" "session_secret" {
  project   = var.project_id
  secret_id = "duka-${var.environment}-session-secret"
}

data "google_secret_manager_secret" "user_key_secret" {
  project   = var.project_id
  secret_id = "duka-${var.environment}-user-key-secret"
}

locals {
  prefix           = "duka-${var.environment}"
  firestore_name   = "duka-${var.environment}"
  pubsub_prefix    = "duka-${var.environment}-"
  runtime_accounts = toset(["api", "worker", "job"])
  common_environment = {
    AGENT_CONTEXT_LOCATION      = var.agent_context_location
    APP_NAME                    = "duka-autopilot"
    DUKA_BUS                    = "pubsub"
    DUKA_ENV                    = var.environment
    DUKA_SESSION_TTL            = "7776000s"
    DUKA_STORE                  = "firestore"
    DUKA_TURN_LEASE_SECONDS     = "180"
    DUKA_MAX_REQUEST_BYTES      = "8500000"
    DUKA_RATE_LIMIT_AUTH_LOGIN  = "10"
    DUKA_RATE_LIMIT_CHAT        = "60"
    DUKA_RATE_LIMIT_INBOUND     = "120"
    DUKA_RATE_LIMIT_PUBSUB_PUSH = "240"
    FIRESTORE_DATABASE          = google_firestore_database.app.name
    GEMINI_MODEL                = var.model
    GOOGLE_CLOUD_LOCATION       = "global"
    GOOGLE_CLOUD_PROJECT        = var.project_id
    # Required by /ready in cloud mode (FR-040): cloud must never fall back to
    # the Gemini Developer API. Its absence fails the startup probe closed.
    GOOGLE_GENAI_USE_VERTEXAI = "true"
    PUBSUB_TOPIC_PREFIX       = local.pubsub_prefix
    RELEASE_SHA               = var.release_sha
    DUKA_TRACE_ENABLED        = "true"
    DUKA_TRACE_SAMPLE_RATE    = "1.0"
  }
  labels = {
    app          = "duka-autopilot"
    environment  = var.environment
    "managed-by" = "terraform"
    release_sha  = var.release_sha
  }
}
