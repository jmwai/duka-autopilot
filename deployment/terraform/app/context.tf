resource "google_vertex_ai_reasoning_engine" "context" {
  provider     = google-beta
  project      = var.project_id
  region       = var.agent_context_location
  display_name = "${local.prefix}-context"
  description  = "Context-only resource for Duka managed Sessions and Memory Bank"

  context_spec {
    memory_bank_config {
      generation_config {
        model = "projects/${var.project_id}/locations/global/publishers/google/models/gemini-3.5-flash"
      }
      similarity_search_config {
        embedding_model = "projects/${var.project_id}/locations/global/publishers/google/models/gemini-embedding-2"
      }
      ttl_config {
        default_ttl                 = "7776000s"
        memory_revision_default_ttl = "7776000s"
      }
      disable_memory_revisions = false
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_vertex_ai_reasoning_engine_iam_member" "sessions" {
  for_each         = local.runtime_accounts
  project          = var.project_id
  region           = var.agent_context_location
  reasoning_engine = google_vertex_ai_reasoning_engine.context.name
  role             = "roles/aiplatform.sessionUser"
  member           = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_vertex_ai_reasoning_engine_iam_member" "memory" {
  for_each         = local.runtime_accounts
  project          = var.project_id
  region           = var.agent_context_location
  reasoning_engine = google_vertex_ai_reasoning_engine.context.name
  role             = "roles/aiplatform.memoryUser"
  member           = "serviceAccount:${google_service_account.runtime[each.key].email}"
}
