variable "project_id" {
  description = "Existing credited GCP project ID."
  type        = string
  default     = "my-duka-autopilot"
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
