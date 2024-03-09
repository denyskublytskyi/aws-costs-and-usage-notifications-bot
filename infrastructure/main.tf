terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.AWS_REGION

  default_tags {
    tags = {
      Application = "aws-costs-and-usage-notifications"
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "lambda_role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "ce_policy" {
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Resource = "*"
        Effect   = "Allow",
        Action   = [
          "ce:GetCostAndUsage",
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_ce" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.ce_policy.arn
}

data "archive_file" "lambda_zip" {
  type                        = "zip"
  source_dir                  = "functions"
  output_path                 = "../output/functions.zip"
  excludes                    = setunion(fileset(join("/", [path.module, "functions"]), "**/*.test.mjs"), fileset(join("/", [path.module, "functions"]), "**/__snapshots__/**"))
  exclude_symlink_directories = true
}

data "archive_file" "lib_layer" {
  type                        = "zip"
  source_dir                  = "layers/lib"
  output_path                 = "../out/layers/lib.zip"
  exclude_symlink_directories = true
}

resource "aws_lambda_layer_version" "lib" {
  layer_name          = "aws-costs-and-usage-lib"
  filename            = data.archive_file.lib_layer.output_path
  source_code_hash    = data.archive_file.lib_layer.output_base64sha256
  compatible_runtimes = ["nodejs20.x"]
}

resource "aws_cloudwatch_log_group" "aws_costs_and_usage_notifications" {
  name              = "/aws/lambda/aws-costs-and-usage-notifications"
  retention_in_days = 7
}

resource "aws_lambda_function" "aws_costs_and_usage_notifications" {
  depends_on    = [data.archive_file.lambda_zip]
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "aws-costs-and-usage-notifications"
  role          = aws_iam_role.lambda_role.arn
  handler       = "job.handler"
  runtime       = "nodejs20.x"
  publish       = true
  timeout       = 30
  layers        = [aws_lambda_layer_version.lib.arn]
  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.TELEGRAM_BOT_TOKEN
      TELEGRAM_CHAT_ID   = var.TELEGRAM_CHAT_ID
    }
  }
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

resource "aws_lambda_alias" "aws_costs_and_usage_notifications_current_alias" {
  function_name    = aws_lambda_function.aws_costs_and_usage_notifications.function_name
  function_version = aws_lambda_function.aws_costs_and_usage_notifications.version
  name             = "current"
}

resource "aws_scheduler_schedule_group" "aws_costs_and_usage_notifications" {
  name = "aws-costs-and-usage-notifications"
}

resource "aws_iam_role" "scheduler" {
  name               = "scheduler"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "scheduler" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaRole"
  role       = aws_iam_role.scheduler.name
}

resource "aws_sqs_queue" "dlq" {
  name = "aws-costs-and-usage-notifications-dlq"
}

resource "aws_scheduler_schedule" "aws_costs_and_usage_notifications" {
  group_name = aws_scheduler_schedule_group.aws_costs_and_usage_notifications.name
  name       = "aws-costs-and-usage-notifications"
  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 8 * * ? *)"
  schedule_expression_timezone = "Europe/Kiev"

  target {
    input = "{\"ScheduleArn\":\"<aws.scheduler.schedule-arn>\",\"ScheduledTime\":\"<aws.scheduler.scheduled-time>\",\"ExecutionId\":\"<aws.scheduler.execution-id>\",\"AttemptNumber\":\"<aws.scheduler.attempt-number>\"}"
    retry_policy {
      maximum_retry_attempts = 3
    }
    dead_letter_config {
      arn = aws_sqs_queue.dlq.arn

    }

    arn      = aws_lambda_function.aws_costs_and_usage_notifications.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
