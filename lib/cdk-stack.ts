import { 
  aws_apigateway,
  aws_iam,
  aws_lambda, 
  aws_s3, 
  aws_s3_deployment,
  aws_secretsmanager,
  Duration,
  pipelines,
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class AwsWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new aws_s3.Bucket(this, 'site-contents', {
      bucketName: `${this.stackName.toLocaleLowerCase()}-website`,
      publicReadAccess: true,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      objectOwnership: aws_s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html"
    });

    const pageDeploy = new aws_s3_deployment.BucketDeployment(this, "deployWebContent", {
      sources: [aws_s3_deployment.Source.asset('./web/dist/spa')],
      destinationBucket: bucket
    });

    const aiFunc = new aws_lambda.Function( this, "aiLambda", {
      runtime: aws_lambda.Runtime.NODEJS_LATEST,
      code: aws_lambda.Code.fromAsset('./dist/lambda'),
      handler: 'ai_lambda.handler',
      timeout: Duration.seconds(60),
    });
    const funcRole = aiFunc.role;
    funcRole?.addManagedPolicy(aws_iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess")); //might want something more targeted later.

    const beaconFunc = new aws_lambda.Function(this, "beaconLambda", {
      runtime: aws_lambda.Runtime.NODEJS_LATEST,
      code: aws_lambda.Code.fromAsset('./dist/beaconLambda'),
      handler: 'beaconLambda.handler',
      timeout: Duration.seconds(30),
    });
    //shared existing secret, not created new for each branch
    const beaconSecret = aws_secretsmanager.Secret.fromSecretNameV2(this, "beaconSecret", "apiToken");
    beaconSecret.grantRead(beaconFunc);
    beaconFunc.role?.addManagedPolicy(aws_iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"));

    const gateway = new aws_apigateway.RestApi(this, `${this.stackName.toLocaleLowerCase()}-apiGateway`, {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS, // Equivalent to ['*']
        allowMethods: Cors.ALL_METHODS, // ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']
        allowHeaders: Cors.DEFAULT_HEADERS, // A set of standard headers
        allowCredentials: true, // Optional
      },
    });
    const apiEndpoint = gateway.root.addResource('api');

    const endpoint = gateway.root.addResource('ai');
    const method = endpoint.addMethod('POST', new aws_apigateway.LambdaIntegration(aiFunc));

    const beaconEndpoint = apiEndpoint.addResource('beacon');
    const beaconMethod = beaconEndpoint.addMethod('GET', new aws_apigateway.LambdaIntegration(beaconFunc));

  }
}
