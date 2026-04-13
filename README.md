# Lambda GitHub CI/CD

A basic AWS Lambda project that reads an item from DynamoDB and uses GitHub Actions for CI/CD.

## Project structure

- `src/index.js` — Lambda handler that reads `id` and queries DynamoDB.
- `src/dynamoClient.js` — DynamoDB client setup.
- `test/index.test.js` — Jest tests for Lambda behavior.
- `.github/workflows/ci-cd.yml` — GitHub Actions pipeline for tests and deployment.

## Dependencies

- `@aws-sdk/client-dynamodb` — AWS SDK v3 DynamoDB client.
- `@aws-sdk/util-dynamodb` — marshall/unmarshall helpers.
- `jest` — test runner.

## Installation

```bash
cd /Users/deepak/PERSONAL/DEEPAK/LEARNING/AWS/serverless/lambda-github-cicd
npm install
```

## Environment variables

The Lambda function expects the following environment variables:

- `TABLE_NAME` — DynamoDB table name.
- `KEY_ATTRIBUTE` — primary key attribute name used for `GetItem` (defaults to `productId`).

For GitHub Actions deploy, configure these repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET` — S3 bucket for SAM deployment artifacts.
- `AWS_SAM_STACK_NAME` — CloudFormation stack name for the SAM app.
- `TABLE_NAME` — DynamoDB table name.
- `AWS_LAMBDA_FUNCTION_NAME` — exact Lambda function name from the AWS console.

Example `.env` values for local testing:

```dotenv
TABLE_NAME=products
KEY_ATTRIBUTE=productId
AWS_REGION=us-east-1
AWS_PROFILE=default
AWS_LAMBDA_FUNCTION_NAME=lambda-github-cicd
```

> `AWS_LAMBDA_ROLE_ARN` must be a full ARN like `arn:aws:iam::123456789012:role/lambda-execution-role`, not just the role name.

## SAM deployment and permissions

This project now uses AWS SAM to create the full stack in one deployment:
- Lambda function
- API Gateway HTTP API
- IAM role and permissions

The GitHub Actions workflow builds and deploys the SAM template directly.

### Required IAM permissions for deploy user

The deploy credentials must be allowed to:
- `cloudformation:*` on the target stack
- `iam:CreateRole`, `iam:PassRole` for the Lambda execution role created by SAM
- `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` for the deployment bucket
- `lambda:*`, `apigateway:*`, `dynamodb:*` as needed by the stack

### Create the role with AWS CLI

Save this as `trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Then run:

```bash
aws iam create-role \
  --role-name lambda-github-cicd-role \
  --assume-role-policy-document file://trust-policy.json
```

Attach the Lambda execution policy:

```bash
aws iam attach-role-policy \
  --role-name lambda-github-cicd-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

If your function reads DynamoDB, attach read permissions too:

```bash
aws iam attach-role-policy \
  --role-name lambda-github-cicd-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess
```

Then get the role ARN:

```bash
aws iam get-role --role-name lambda-github-cicd-role --query 'Role.Arn' --output text
```

### Important

- The deploy user must have `iam:PassRole` permission on this role.
- Do not use service-linked roles like `AWSServiceRoleForLambda` for Lambda creation.
- Use the full ARN in `AWS_LAMBDA_ROLE_ARN`, for example:

```text
arn:aws:iam::705387578016:role/lambda-github-cicd-role
```

## Local testing

Run the unit tests locally:

```bash
npm test
```

Use a local `.env` file for environment values:

```bash
source .env
```

Invoke the Lambda handler directly from Node.js with a real or mocked DynamoDB environment.
The code uses `productId` by default.

```bash
source .env
KEY_ATTRIBUTE=productId TABLE_NAME=products node -e '
const { handler } = require("./src/index");
handler({ pathParameters: { productId: "P006" } })
  .then(res => console.log(res))
  .catch(err => console.error(err));
'
```

If you want to use a different key name, set `KEY_ATTRIBUTE` to that name.

If you are using real DynamoDB access, make sure AWS credentials are available locally through environment variables or `~/.aws/credentials`.

Example required credentials:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## Lambda usage

The handler reads the primary key from one of these places:

- `event.pathParameters[KEY_ATTRIBUTE]`
- `event.queryStringParameters[KEY_ATTRIBUTE]`
- JSON body field `[KEY_ATTRIBUTE]`

By default, `KEY_ATTRIBUTE` is `productId`.

Example response when the item exists:

```json
{
  "productId": "P006",
  "name": "Cotton Bedsheet",
  "category": "Home",
  "price": 1499,
  "stock": 40,
  "rating": 4.2
}
```

## CI/CD workflow

The GitHub Actions workflow defined in `.github/workflows/ci-cd.yml` does the following:

1. On pull requests and pushes to `main`, run `npm ci` and `npm test`.
2. On successful pushes to `main`, deploy the Lambda package to AWS using:
   - `aws lambda update-function-code`
   - Secrets from GitHub repository settings.

## Deployment notes

This workflow packages the `src` directory, `package.json`, and `package-lock.json` into `function.zip` before deploying. If you add additional files or dependencies, update the workflow packaging step accordingly.