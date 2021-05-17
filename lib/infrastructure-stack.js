const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const fs = require('fs');
const path = require('path');
const { Duration, Tags } = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const yaml = require('js-yaml');
const { Role, Policy } = require('@aws-cdk/aws-iam');
class InfrastructureStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    //Tag all resources created by this infrastructure as a h0ck resource.
    Tags.of(this).add('h0ck-resource', 'true')

    let layers = [];

    //Deploy all layers from the layer folder
    fs.readdirSync(__dirname + "/../layers").forEach(layerFolder => {
      const layer = new lambda.LayerVersion(this, layerFolder, {
        layerVersionName: 'h0ck-infrastructure-lambda-layer-' + layerFolder,
        code: lambda.Code.fromAsset(path.join(__dirname, '../layers', layerFolder)),
        compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
        license: 'Apache-2.0',
      });
      layers.push(layer);
    });


    //Create the roles for the new lambdas
    let lambdaRole = new Role(this, 'h0ck-infrastructure-role-lambda-default', {
      roleName: 'h0ck-infrastructure-role-lambda-default',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    })


    //Read infrastructure defined in root file.
    let infrastructureData = yaml.load(fs.readFileSync(path.join(__dirname, '../h0ck-infrastructure.yaml')));
    let lambdaData = infrastructureData.services.lambda;

    //Assign empty code for the lambdas
    let lambdaCode = lambda.Code.fromAsset(path.join(__dirname, '../emptyFunctionCode'));

    //Create all the lambdas specified in the infrastructure file
    lambdaData.forEach(lambdaDeployment => {
      for (let i = 1; i <= lambdaDeployment.amount; i++) {
        let lambdaName =  lambdaDeployment.name + '-lambda-' + i
        const handler = new lambda.Function(this, lambdaName,
          {
            functionName: lambdaName,

            runtime: lambda.Runtime.NODEJS_14_X,
            code: lambdaCode,
            handler: "/opt/nodejs/executor.handler",
            layers: layers || ['layer-core-executor'],
            memorySize: lambdaDeployment.memory || 256,
            timeout: Duration.seconds(lambdaDeployment.timeout || 5),
            roles: [lambdaRole]
          });
        Tags.of(handler).add('h0ck-lambda-type', lambdaDeployment.name)
      }

    })

  }
}

module.exports = { InfrastructureStack }
