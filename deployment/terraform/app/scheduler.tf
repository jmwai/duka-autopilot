locals {
  scheduled_jobs = {
    nightly = {
      job_name = google_cloud_run_v2_job.nightly.name
      schedule = "0 2 * * *"
    }
    digest = {
      job_name = google_cloud_run_v2_job.digest.name
      schedule = "30 6 * * *"
    }
  }
}

resource "google_cloud_scheduler_job" "jobs" {
  for_each         = local.scheduled_jobs
  project          = var.project_id
  region           = var.region
  name             = "${local.prefix}-${each.key}"
  description      = "Run the Duka ${each.key} Cloud Run Job"
  schedule         = each.value.schedule
  time_zone        = "Africa/Nairobi"
  attempt_deadline = "180s"

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri = format(
      "https://run.googleapis.com/v2/projects/%s/locations/%s/jobs/%s:run",
      var.project_id,
      var.region,
      each.value.job_name,
    )

    oauth_token {
      service_account_email = google_service_account.scheduler_invoker.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}
