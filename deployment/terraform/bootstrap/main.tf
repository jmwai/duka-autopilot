data "google_project" "current" {
  project_id = var.project_id

  # A new hackathon project may not have Resource Manager enabled yet. Make
  # Terraform establish the declared API before the budget reads its number.
  depends_on = [google_project_service.apis["cloudresourcemanager.googleapis.com"]]
}

check "project_identity" {
  assert {
    condition     = data.google_project.current.number == var.expected_project_number
    error_message = "Refusing bootstrap: project_id must resolve to project number ${var.expected_project_number}."
  }
}

locals {
  services = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtrace.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
    "telemetry.googleapis.com",
  ])
  environments = toset(["dev", "prod"])
  secret_suffixes = toset([
    "channel-key",
    "owner-password",
    "session-secret",
    "user-key-secret",
  ])
  runtime_secrets = {
    for pair in setproduct(local.environments, local.secret_suffixes) :
    "${pair[0]}-${pair[1]}" => { environment = pair[0], suffix = pair[1] }
  }
}

resource "google_project_service" "apis" {
  for_each           = local.services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = "duka-images"
  description   = "Immutable Duka Autopilot release images"
  format        = "DOCKER"

  cleanup_policy_dry_run = true
  depends_on             = [google_project_service.apis]
}

resource "google_storage_bucket" "terraform_state" {
  project                     = var.project_id
  name                        = "${var.project_id}-tfstate"
  location                    = "EU"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret" "runtime" {
  for_each  = local.runtime_secrets
  project   = var.project_id
  secret_id = "duka-${each.value.environment}-${each.value.suffix}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions"
  description               = "Keyless CI/CD identities for Duka Autopilot"
  disabled                  = false

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "duka-github"
  display_name                       = "Duka GitHub OIDC"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor_id"         = "assertion.actor_id"
    "attribute.environment"      = "assertion.environment"
    "attribute.ref"              = "assertion.ref"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_id"    = "assertion.repository_id"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.owner_id"         = "assertion.repository_owner_id"
    "attribute.workflow_ref"     = "assertion.job_workflow_ref"
  }

  attribute_condition = <<-EOT
    assertion.repository_owner_id == '${var.github_owner_id}' &&
    assertion.repository_id == '${var.github_repository_id}' &&
    ((assertion.environment == 'development' && assertion.ref == 'refs/heads/dev') ||
     (assertion.environment == 'production' && assertion.ref == 'refs/heads/main'))
  EOT

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deployer" {
  for_each     = local.environments
  project      = var.project_id
  account_id   = "duka-gha-${each.key}-deployer"
  display_name = "Duka ${each.key} GitHub deployer"
}

resource "google_service_account" "evaluator" {
  project      = var.project_id
  account_id   = "duka-gha-dev-evaluator"
  display_name = "Duka development model evaluator"
}

resource "google_service_account_iam_member" "github_impersonation" {
  for_each           = local.environments
  service_account_id = google_service_account.deployer[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member = format(
    "principalSet://iam.googleapis.com/%s/attribute.environment/%s",
    google_iam_workload_identity_pool.github.name,
    each.key == "dev" ? "development" : "production",
  )
}

resource "google_service_account_iam_member" "github_eval_impersonation" {
  service_account_id = google_service_account.evaluator.name
  role               = "roles/iam.workloadIdentityUser"
  member = format(
    "principalSet://iam.googleapis.com/%s/attribute.environment/development",
    google_iam_workload_identity_pool.github.name,
  )
}

resource "google_artifact_registry_repository_iam_member" "deployer_writer" {
  for_each   = local.environments
  project    = var.project_id
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer[each.key].email}"
}

resource "google_project_iam_member" "deployer_service_usage" {
  for_each = local.environments
  project  = var.project_id
  role     = "roles/serviceusage.serviceUsageConsumer"
  member   = "serviceAccount:${google_service_account.deployer[each.key].email}"
}

resource "google_project_iam_member" "evaluator_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.evaluator.email}"
}

resource "google_project_iam_member" "evaluator_model_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.evaluator.email}"
}

resource "google_billing_budget" "hackathon" {
  count           = var.billing_account_id == "" ? 0 : 1
  billing_account = var.billing_account_id
  display_name    = "Duka Autopilot hackathon budget"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_usd)
    }
  }

  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.8 }
  threshold_rules { threshold_percent = 1.0 }
}
