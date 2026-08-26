resource "google_cloud_run_v2_service" "api" {
  project             = var.project_id
  name                = "${local.prefix}-api"
  location            = var.region
  description         = "Private Duka owner and channel API"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    service_account                  = google_service_account.runtime["api"].email
    timeout                          = "70s"
    max_instance_request_concurrency = 10

    scaling {
      min_instance_count = 0
      max_instance_count = var.api_max_instances
    }

    containers {
      name  = "api"
      image = var.backend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = { cpu = "1", memory = "1Gi" }
      }

      dynamic "env" {
        for_each = merge(local.common_environment, {
          AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name
        })
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name = "DUKA_CHANNEL_KEY"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.channel_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DUKA_OWNER_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.owner_password.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DUKA_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DUKA_USER_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.user_key_secret.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        initial_delay_seconds = 2
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 12
        http_get { path = "/ready" }
      }
      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get { path = "/health" }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic]
  }
}

resource "google_cloud_run_v2_service" "worker" {
  project             = var.project_id
  name                = "${local.prefix}-worker"
  location            = var.region
  description         = "Private authenticated Pub/Sub worker"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    service_account                  = google_service_account.runtime["worker"].email
    timeout                          = "600s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
      max_instance_count = var.worker_max_instances
    }

    containers {
      name    = "worker"
      image   = var.backend_image
      command = ["uvicorn"]
      args    = ["app.worker_api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]

      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "1Gi" } }

      dynamic "env" {
        for_each = merge(local.common_environment, {
          AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name
        })
        content {
          name  = env.key
          value = env.value
        }
      }
      env {
        name = "DUKA_USER_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.user_key_secret.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        initial_delay_seconds = 2
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 12
        http_get { path = "/ready" }
      }
      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get { path = "/health" }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic]
  }
}

resource "google_cloud_run_v2_service" "web" {
  project             = var.project_id
  name                = "${local.prefix}-web"
  location            = var.region
  description         = "Public Duka frontend and narrow private-API BFF"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    service_account                  = google_service_account.web.email
    timeout                          = "70s"
    max_instance_request_concurrency = 20

    scaling {
      min_instance_count = var.web_min_instances
      max_instance_count = var.web_max_instances
    }

    containers {
      name  = "web"
      image = var.frontend_image

      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }

      env {
        name  = "DUKA_ENV"
        value = var.environment
      }
      env {
        name  = "DUKA_API_URL"
        value = google_cloud_run_v2_service.api.uri
      }
      env {
        name  = "RELEASE_SHA"
        value = var.release_sha
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "DUKA_TRACE_ENABLED"
        value = "true"
      }
      env {
        name  = "DUKA_TRACE_SAMPLE_RATE"
        value = "1.0"
      }

      startup_probe {
        initial_delay_seconds = 1
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 12
        http_get { path = "/ready" }
      }
      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get { path = "/health" }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic]
  }
}

resource "google_cloud_run_v2_job" "nightly" {
  project             = var.project_id
  name                = "${local.prefix}-nightly"
  location            = var.region
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    parallelism = 1
    task_count  = 1
    template {
      service_account = google_service_account.runtime["job"].email
      timeout         = "3600s"
      max_retries     = 1

      containers {
        name    = "nightly"
        image   = var.backend_image
        command = ["python", "-m", "app.jobs"]
        args    = ["nightly"]
        resources { limits = { cpu = "2", memory = "2Gi" } }

        dynamic "env" {
          for_each = merge(local.common_environment, {
            AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name
          })
          content {
            name  = env.key
            value = env.value
          }
        }
        env {
          name = "DUKA_USER_KEY_SECRET"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.user_key_secret.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_job" "digest" {
  project             = var.project_id
  name                = "${local.prefix}-digest"
  location            = var.region
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    parallelism = 1
    task_count  = 1

    template {
      service_account = google_service_account.runtime["job"].email
      timeout         = "600s"
      max_retries     = 1

      containers {
        name    = "digest"
        image   = var.backend_image
        command = ["python", "-m", "app.jobs"]
        args    = ["digest"]

        resources {
          limits = { cpu = "1", memory = "1Gi" }
        }

        dynamic "env" {
          for_each = merge(local.common_environment, {
            AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name
          })
          content {
            name  = env.key
            value = env.value
          }
        }

        env {
          name = "DUKA_USER_KEY_SECRET"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.user_key_secret.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_job" "seed" {
  project             = var.project_id
  name                = "${local.prefix}-seed"
  location            = var.region
  deletion_protection = var.protect_durable_resources
  labels              = local.labels

  template {
    parallelism = 1
    task_count  = 1

    template {
      service_account = google_service_account.runtime["job"].email
      timeout         = "600s"
      max_retries     = 0

      containers {
        name    = "seed"
        image   = var.backend_image
        command = ["python", "-m", "app.jobs"]
        args    = ["seed"]

        resources {
          limits = { cpu = "1", memory = "1Gi" }
        }

        dynamic "env" {
          for_each = merge(local.common_environment, {
            AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name
          })
          content {
            name  = env.key
            value = env.value
          }
        }
        env {
          name = "DUKA_USER_KEY_SECRET"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.user_key_secret.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_to_api" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.web.email}"
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_to_worker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_to_job" {
  for_each = {
    digest  = google_cloud_run_v2_job.digest.name
    nightly = google_cloud_run_v2_job.nightly.name
  }
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deployer_service" {
  for_each = {
    api    = google_cloud_run_v2_service.api.name
    web    = google_cloud_run_v2_service.web.name
    worker = google_cloud_run_v2_service.worker.name
  }
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.developer"
  member   = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deployer_job" {
  for_each = {
    digest  = google_cloud_run_v2_job.digest.name
    nightly = google_cloud_run_v2_job.nightly.name
    seed    = google_cloud_run_v2_job.seed.name
  }
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.developer"
  member   = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deployer_job_invoker" {
  for_each = {
    digest  = google_cloud_run_v2_job.digest.name
    nightly = google_cloud_run_v2_job.nightly.name
    seed    = google_cloud_run_v2_job.seed.name
  }
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.invoker"
  member   = "serviceAccount:${data.google_service_account.deployer.email}"
}
