const { Stack, Tags, RemovalPolicy, CfnOutput, aws_s3, aws_s3_deployment, } = require('aws-cdk-lib');
const path = require('path');

require('dotenv').config()

// const config = {
//     env: {
//        account: "708458997034",
//         region: "eu-west-3"
//     }
// }

const config = {
    env: {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: process.env.CDK_DEFAULT_REGION,
    }
  }

  
const FRONT_BUILD_LOCATION = path.join(__dirname, "../frontfiles");


class FrontStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, { ...props, env: config.env });

        //Tag all resources created by this infrastructure as a h0ck resource.
        Tags.of(this).add('h0ck-resource', 'true')


        //Deploy the S3 bucket
        const frontBucket = new aws_s3.Bucket(this, "h0ck-front", {
            publicReadAccess: true,
            
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "index.html"
        });

        const bucketDeploy = new aws_s3_deployment.BucketDeployment(
            this,
            "h0ck-front-deployment", {
            sources: [
                aws_s3_deployment.Source.asset(FRONT_BUILD_LOCATION),
            ],
            retainOnDelete: false,
            destinationBucket: frontBucket
        }
        )


        new CfnOutput(this, 'h0ck-front-url', {
            value: frontBucket.bucketWebsiteUrl
        })



    }
}

module.exports = { FrontStack }
