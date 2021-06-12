#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { EC2Stack } = require('../lib/ec2-stack');
const { FrontStack } = require('../lib/front-stack');
const { LambdasStack } = require('../lib/lambdas-stack');




const app = new cdk.App();

// let imagesStack = new ECRImagesStack(app, 'ECRImagesStack', {

// });

// let infrastructureStack = new InfrastructureStack(app, 'InfrastructureStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '123456789012', region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });


// let infrastructureStack2 = new InfrastructureStack2(app, 'InfrastructureStack-2', {
// coreip: infrastructureStack.h0ck_ec2_public_ip
// })

// infrastructureStack2.addDependency(infrastructureStack);
//infrastructureStack.addDependency(imagesStack);
let ec2Stack = new EC2Stack(app, 'EC2Stack', {});
let frontStack = new FrontStack(app, 'FrontStack', {});
let lambdas = new LambdasStack(app, 'LambdasStack', {});
frontStack.addDependency(ec2Stack);

