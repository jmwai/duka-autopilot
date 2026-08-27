output "release" {
  value = {
    environment    = var.environment
    git_sha        = var.release_sha
    backend_image  = var.backend_image
    frontend_image = var.frontend_image
  }
}

output "service_urls" {
  value = {
    api    = google_cloud_run_v2_service.api.uri
    web    = google_cloud_run_v2_service.web.uri
    worker = google_cloud_run_v2_service.worker.uri
  }
}

output "job_names" {
  value = {
    digest  = google_cloud_run_v2_job.digest.name
    nightly = google_cloud_run_v2_job.nightly.name
    seed    = google_cloud_run_v2_job.seed.name
  }
}

output "durable_resources" {
  value = {
    agent_context      = google_vertex_ai_reasoning_engine.context.name
    firestore_database = google_firestore_database.app.name
    inbound_topic      = google_pubsub_topic.inbound.name
    push_subscription  = google_pubsub_subscription.inbound_push.name
    dead_letter_topic  = google_pubsub_topic.dead_letter.name
  }
}

output "scheduler_jobs" {
  value = { for name, job in google_cloud_scheduler_job.jobs : name => job.name }
}
