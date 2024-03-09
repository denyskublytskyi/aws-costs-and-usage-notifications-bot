variable "TELEGRAM_BOT_TOKEN" {
  description = "Telegram bot token"
  type        = string
}

variable "TELEGRAM_CHAT_ID" {
  description = "Telegram chat id"
  default     = "-1001700010141"
  type        = string
}

variable "AWS_REGION" {
  description = "AWS region"
  default     = "eu-central-1"
  type        = string
}
