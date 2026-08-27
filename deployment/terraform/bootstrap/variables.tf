variable "project_id" {
  description = "Existing credited GCP project ID."
  type        = string
  default     = "agent-platform-503913"
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

variable "region" {
  description = "Cloud Run, Artifact Registry, Pub/Sub and Scheduler region."
  type        = string
  default     = "europe-west1"
}

variable "github_owner" {
  type    = string
  default = "jmwai"
}

variable "github_repository" {
  type    = string
  default = "duka-autopilot"
}

variable "github_owner_id" {
  description = "Immutable numeric GitHub owner ID; obtain immediately before WIF bootstrap."
  type        = string
}

variable "github_repository_id" {
  description = "Immutable numeric GitHub repository ID."
  type        = string
}

variable "billing_account_id" {
  description = "Optional billing account ID. Leave empty to defer the budget resource."
  type        = string
  default     = ""
  sensitive   = true
}

variable "budget_usd" {
  type    = number
  default = 50
}
