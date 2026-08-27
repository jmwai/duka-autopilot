variable "project_id" {
  type    = string
  default = "agent-platform-503913"
}

variable "expected_project_number" {
  description = "Immutable project-number guard for the credited GCP project."
  type        = string
  default     = "183775788663"

  validation {
    condition     = can(regex("^[0-9]+$", var.expected_project_number))
    error_message = "expected_project_number must contain digits only"
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod"
  }
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "agent_context_location" {
  type    = string
  default = "global"
}

variable "model" {
  type    = string
  default = "gemini-3.7-flash"
}

variable "backend_image" {
  description = "Backend Artifact Registry image pinned by sha256 digest."
  type        = string
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.backend_image))
    error_message = "backend_image must be an immutable @sha256 digest"
  }
}

variable "frontend_image" {
  description = "Frontend Artifact Registry image pinned by sha256 digest."
  type        = string
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.frontend_image))
    error_message = "frontend_image must be an immutable @sha256 digest"
  }
}

variable "release_sha" {
  type = string
  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.release_sha))
    error_message = "release_sha must be a full 40-character Git SHA"
  }
}

variable "protect_durable_resources" {
  type    = bool
  default = true
}

variable "web_min_instances" {
  type    = number
  default = 0
}

variable "web_max_instances" {
  type    = number
  default = 2
}

variable "api_max_instances" {
  type    = number
  default = 2
}

variable "worker_max_instances" {
  type    = number
  default = 2
}
