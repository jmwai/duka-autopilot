output "project_number" {
  value = data.google_project.current.number
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "terraform_state_bucket" {
  value = google_storage_bucket.terraform_state.name
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_accounts" {
  value = { for environment, account in google_service_account.deployer : environment => account.email }
}

output "evaluator_service_account" {
  value = google_service_account.evaluator.email
}

output "secret_names" {
  value = sort([for secret in google_secret_manager_secret.runtime : secret.secret_id])
}
