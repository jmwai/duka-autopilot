resource "google_project_service_identity" "pubsub" {
  provider = google-beta
  project  = var.project_id
  service  = "pubsub.googleapis.com"
}

resource "google_pubsub_topic" "inbound" {
  project                    = var.project_id
  name                       = "${local.pubsub_prefix}inbound"
  message_retention_duration = "604800s"
  labels                     = local.labels
}

resource "google_pubsub_topic" "dead_letter" {
  project                    = var.project_id
  name                       = "${local.pubsub_prefix}inbound-dlq"
  message_retention_duration = "1209600s"
  labels                     = local.labels
}

resource "google_pubsub_subscription" "inbound_push" {
  project                    = var.project_id
  name                       = "${local.pubsub_prefix}inbound-push"
  topic                      = google_pubsub_topic.inbound.id
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  enable_message_ordering    = true
  labels                     = local.labels

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}/pubsub/push"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.worker.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  depends_on = [
    google_pubsub_topic_iam_member.pubsub_dead_letter_publisher,
    google_pubsub_subscription_iam_member.pubsub_source_subscriber,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}

resource "google_pubsub_subscription" "dead_letter" {
  project                    = var.project_id
  name                       = "${local.pubsub_prefix}inbound-dlq-inspection"
  topic                      = google_pubsub_topic.dead_letter.id
  ack_deadline_seconds       = 60
  message_retention_duration = "1209600s"
  labels                     = local.labels

  expiration_policy {
    ttl = "2678400s"
  }
}

resource "google_pubsub_topic_iam_member" "api_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.inbound.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_pubsub_topic_iam_member" "pubsub_dead_letter_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_project_service_identity.pubsub.email}"
}

resource "google_pubsub_subscription_iam_member" "pubsub_source_subscriber" {
  project      = var.project_id
  subscription = "${local.pubsub_prefix}inbound-push"
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_project_service_identity.pubsub.email}"
}

resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = google_service_account.pubsub_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_project_service_identity.pubsub.email}"
}
