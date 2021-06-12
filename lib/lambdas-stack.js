const { Fn, Stack, Duration, Tags, Token, RemovalPolicy, SymlinkFollowMode, CfnOutput, aws_ecr_assets, aws_iam, aws_lambda, aws_s3, aws_s3_deployment, aws_ecr, aws_ec2 } = require('aws-cdk-lib');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');


class LambdasStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);


    //Tag all resources created by this infrastructure as a h0ck resource.
    Tags.of(this).add('h0ck-resource', 'true')

    let layers = [];
    //Deploy all layers from the layer folder
    fs.readdirSync(__dirname + "/../frameworks/layers").forEach(layerFolder => {
      if (layerFolder === 'layer-framework-scraping') { return; }//TODO: Remove
      const layer = new aws_lambda.LayerVersion(this, layerFolder, {
        layerVersionName: 'h0ck-infrastructure-lambda-layer-' + layerFolder,
        code: aws_lambda.Code.fromAsset(path.join(__dirname, '../frameworks/layers', layerFolder)),
        compatibleRuntimes: [aws_lambda.Runtime.NODEJS_14_X],
        license: 'Apache-2.0',
      });
      layers.push(layer);
    });

    //Create the roles for the new lambdas
    let lambdaRole = new aws_iam.Role(this, 'h0ck-infrastructure-role-lambda-default', {
      roleName: 'h0ck-infrastructure-role-lambda-default',
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    })


    //Read infrastructure defined in root file.
    let infrastructureData = yaml.load(fs.readFileSync(path.join(__dirname, '../h0ck-infrastructure.yaml')));
    let lambdaData = infrastructureData.services.lambda;

    //Assign empty code for the lambdas
    let lambdaCode = aws_lambda.Code.fromAsset(path.join(__dirname, '../emptyFunctionCode'));


    //Push the docker image for the frameworks to a ECR Repository
    const imageAsset2 = new aws_ecr_assets.DockerImageAsset(this, 'h0ck-framework-scraping-image', {
      directory: path.join(__dirname, "../frameworks"),
      file: "dockerfile-scraping",
      tag: "latest",
    });


    //Create all corresponding lambdas
    lambdaData.filter(isDockerDeployment).forEach(lambdaDeployment => {
      for (let i = 1; i <= lambdaDeployment.amount; i++) {
        let lambdaName = lambdaDeployment.name + '-lambda-' + i;
        const handler = new aws_lambda.DockerImageFunction(this, lambdaName,
          {
            functionName: lambdaName,
            runtime: aws_lambda.Runtime.NODEJS_14_X,
            code: aws_lambda.DockerImageCode.fromEcr(imageAsset2.repository, { tag: Fn.split(":", imageAsset2.imageUri, 2)[1] }),
            handler: "/opt/nodejs/executor.handler",
            memorySize: lambdaDeployment.memory || 256,
            timeout: Duration.seconds(lambdaDeployment.timeout || 5),
            roles: [lambdaRole]
          });
        Tags.of(handler).add('h0ck-lambda-type', lambdaDeployment.name)
      }

    })

    //Create all the lambdas specified in the infrastructure file
    lambdaData.filter(isNotADockerDeployment).forEach(lambdaDeployment => {
      for (let i = 1; i <= lambdaDeployment.amount; i++) {
        let lambdaName = lambdaDeployment.name + '-lambda-' + i;
        const handler = new aws_lambda.Function(this, lambdaName,
          {
            functionName: lambdaName,
            runtime: aws_lambda.Runtime.NODEJS_14_X,
            code: lambdaCode,
            layers: layers || ['layer-core-executor'],
            handler: "/opt/nodejs/executor.handler",
            memorySize: lambdaDeployment.memory || 256,
            timeout: Duration.seconds(lambdaDeployment.timeout || 5),
            roles: [lambdaRole]
          });
        Tags.of(handler).add('h0ck-lambda-type', lambdaDeployment.name)
      }

    })


    function isDockerDeployment(deployment) {
      return deployment.dockerFile != null;
    }
    function isNotADockerDeployment(deployment) {
      return deployment.dockerFile == null;
    }



  }
}

module.exports = { LambdasStack }
