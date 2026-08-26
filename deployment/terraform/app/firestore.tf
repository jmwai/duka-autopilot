resource "google_firestore_database" "app" {
  project                     = var.project_id
  name                        = local.firestore_name
  location_id                 = var.region
  type                        = "FIRESTORE_NATIVE"
  app_engine_integration_mode = "DISABLED"
  delete_protection_state     = "DELETE_PROTECTION_ENABLED"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_firestore_index" "orders_by_customer" {
  project     = var.project_id
  database    = google_firestore_database.app.name
  collection  = "duka-orders"
  query_scope = "COLLECTION"

  fields {
    field_path = "customer_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "messages_by_customer" {
  project     = var.project_id
  database    = google_firestore_database.app.name
  collection  = "duka-messages"
  query_scope = "COLLECTION"

  fields {
    field_path = "customer_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}
