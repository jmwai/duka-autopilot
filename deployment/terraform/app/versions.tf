terraform {
  required_version = ">= 1.10.0"

  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.45.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "7.45.0"
    }
  }
}

# The Agent Platform context lives in `global`. The provider derives the Vertex
# endpoint as https://{region}-aiplatform.googleapis.com/, which for `global`
# becomes the non-existent global-aiplatform.googleapis.com and returns 404.
# The global surface is served by the unprefixed host, so pin it explicitly.
locals {
  vertex_endpoint = "https://aiplatform.googleapis.com/v1beta1/"
}

provider "google" {
  project                   = var.project_id
  region                    = var.region
  vertex_ai_custom_endpoint = local.vertex_endpoint
}

provider "google-beta" {
  project                   = var.project_id
  region                    = var.region
  vertex_ai_custom_endpoint = local.vertex_endpoint
}
