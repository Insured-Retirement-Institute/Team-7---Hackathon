import { 
  aws_apigateway,
  aws_iam,
  aws_lambda, 
  aws_s3, 
  aws_s3_deployment,
  pipelines
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
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

    const func = new aws_lambda.Function( this, "functionName", {
      runtime: aws_lambda.Runtime.NODEJS_LATEST,
      code: aws_lambda.Code.fromAsset('./dist/lambda'),
      handler: 'lambda.handler'
    });
    const funcRole = func.role;
    funcRole?.addManagedPolicy(aws_iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess")); //might want something more targeted later.

    const gateway = new aws_apigateway.RestApi(this, "apiGateway");
    const endpoint = gateway.root.addResource('api');
    const method = endpoint.addMethod('GET', new aws_apigateway.LambdaIntegration(func));
    
  }
}
