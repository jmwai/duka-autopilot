resource "google_service_account" "web" {
  project      = var.project_id
  account_id   = "${local.prefix}-web-runtime"
  display_name = "Duka ${var.environment} web runtime"
}

resource "google_service_account" "runtime" {
  for_each     = local.runtime_accounts
  project      = var.project_id
  account_id   = "${local.prefix}-${each.key}-runtime"
  display_name = "Duka ${var.environment} ${each.key} runtime"
}

resource "google_service_account" "pubsub_invoker" {
  project      = var.project_id
  account_id   = "${local.prefix}-pubsub-invoker"
  display_name = "Duka ${var.environment} Pub/Sub invoker"
}

resource "google_service_account" "scheduler_invoker" {
  project      = var.project_id
  account_id   = "${local.prefix}-scheduler-invoker"
  display_name = "Duka ${var.environment} Scheduler invoker"
}

resource "google_project_iam_member" "firestore" {
  for_each = local.runtime_accounts
  project  = var.project_id
  role     = "roles/datastore.user"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"

  condition {
    title       = "${local.prefix}-${each.key}-database-only"
    description = "Restrict this runtime to its named Firestore database"
    expression  = "resource.name == 'projects/${var.project_id}/databases/${google_firestore_database.app.name}'"
  }
}

resource "google_project_iam_member" "vertex_model_user" {
  for_each = local.runtime_accounts
  project  = var.project_id
  role     = "roles/aiplatform.user"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "runtime_trace_writer" {
  for_each = local.runtime_accounts
  project  = var.project_id
  role     = "roles/telemetry.tracesWriter"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "runtime_service_usage" {
  for_each = local.runtime_accounts
  project  = var.project_id
  role     = "roles/serviceusage.serviceUsageConsumer"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "web_trace_writer" {
  project = var.project_id
  role    = "roles/telemetry.tracesWriter"
  member  = "serviceAccount:${google_service_account.web.email}"
}

resource "google_project_iam_member" "web_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.web.email}"
}

resource "google_project_iam_member" "deployer_log_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_secret_manager_secret_iam_member" "api_channel" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.channel_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_secret_manager_secret_iam_member" "api_owner" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.owner_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_secret_manager_secret_iam_member" "api_session" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.session_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_secret_manager_secret_iam_member" "user_key" {
  for_each  = local.runtime_accounts
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.user_key_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_service_account_iam_member" "deployer_can_use_web" {
  service_account_id = google_service_account.web.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_can_use_runtime" {
  for_each           = local.runtime_accounts
  service_account_id = google_service_account.runtime[each.key].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_service_account.deployer.email}"
}
