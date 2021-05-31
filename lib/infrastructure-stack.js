const { Fn, Stack, Duration, Tags, Token, RemovalPolicy, SymlinkFollowMode, CfnOutput, aws_ecr_assets, aws_iam, aws_lambda, aws_s3, aws_s3_deployment, aws_ecr, aws_ec2 } = require('aws-cdk-lib');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');


require('dotenv').config()

const config = {
  env: {
    account: "708458997034",
    region: "eu-west-3"
  }
}

const FRONT_BUILD_LOCATION = "../front-core/build";

class InfrastructureStack extends Stack {
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
      directory: "./frameworks",
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
      console.log("Not a docker deployment")
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




    // EC2 machine deployment
    const roleEc2 = new aws_iam.Role(this, 'H0ck-Role-ForEc2', {
      assumedBy: new aws_iam.ServicePrincipal('ec2.amazonaws.com')
    });

    const defaultVpc = aws_ec2.Vpc.fromLookup(this, 'VPC-Default', { isDefault: true })

    const securityGroup = new aws_ec2.SecurityGroup(
      this,
      'h0ck-core-instance-1-sg',
      {
        vpc: defaultVpc,
        allowAllOutbound: true, // will let your instance send outboud traffic
        securityGroupName: 'simple-instance-1-sg',
      }
    )

    securityGroup.addIngressRule(
      aws_ec2.Peer.ipv4(process.env.EXTERNAL_IP + "/32"),
      aws_ec2.Port.tcp(22),
      'Allows SSH access from Internet'
    )

    securityGroup.addIngressRule(
      aws_ec2.Peer.ipv4(process.env.EXTERNAL_IP + "/32"),
      aws_ec2.Port.tcp(80),
      'Allows HTTP access from Internet'
    )

    securityGroup.addIngressRule(
      aws_ec2.Peer.ipv4(process.env.EXTERNAL_IP + "/32"),
      aws_ec2.Port.tcp(7000),
      'Allows HTTP access from Internet'
    )


    securityGroup.addIngressRule(
      aws_ec2.Peer.ipv4(process.env.EXTERNAL_IP + "/32"),
      aws_ec2.Port.tcp(443),
      'Allows HTTPS access from Internet'
    )

    roleEc2.addManagedPolicy(aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    // define a user data script to install & launch our web server 
    const ssmaUserData = aws_ec2.UserData.forLinux();
    // make sure the latest SSM Agent is installed.
    const SSM_AGENT_RPM = 'https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm';
    ssmaUserData.addCommands(`sudo yum install -y ${SSM_AGENT_RPM}`, 'restart amazon-ssm-agent');
    // install and start Nginx
    ssmaUserData.addCommands('yum install -y docker', 'service docker start');
    ssmaUserData.addCommands('sudo curl -L "https://github.com/docker/compose/releases/download/1.27.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose')
    ssmaUserData.addCommands('sudo chmod +x /usr/local/bin/docker-compose', 'ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose')
    ssmaUserData.addCommands('sudo yum install git -y')
    ssmaUserData.addCommands('curl https://raw.githubusercontent.com/H0ck/infrastructure/main/backend-docker/docker-compose.yaml -o docker-compose.yaml')
    ssmaUserData.addCommands('docker-compose up -d')

    




    //create a profile to attch the role to the instance


    // create the instance
    const instance = new aws_ec2.Instance(this, id, {
      instanceName: 'h0ck-ec2-core',
      machineImage: aws_ec2.MachineImage.latestAmazonLinux({
        generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.T2, aws_ec2.InstanceSize.MICRO),
      vpc: defaultVpc,
      securityGroup: securityGroup,
      role: roleEc2,
      userData: ssmaUserData,
      keyName: 'h0ck-ec2-key',
    });

    let ipOut = new CfnOutput(this, 'h0ck-ec2-public-ip', {
      value: instance.instancePublicIp
    })




    let frontFileCache = {}

    //Replace variables in front
    if (!Token.isUnresolved(ipOut.value)) {
      fs.readdirSync(path.join(FRONT_BUILD_LOCATION, "/static/js")).forEach(file => {
        let filePath = path.join(FRONT_BUILD_LOCATION, "/static/js", file);
        let fileContent = fs.readFileSync(filePath, 'UTF-8');
        let newFileContent = fileContent.replace(/###REACT_APP_CORE_API###/g, ipOut.value);
        frontFileCache[file] = fileContent;
        fs.writeFileSync(filePath, newFileContent);
      })
    }






    //Replace the build files to insert EC2 ip deployment

    //Deploy the S3 bucket
    const frontBucket = new aws_s3.Bucket(this, "h0ck-front", {
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html"
    });

    const bucketDeploy = new aws_s3_deployment.BucketDeployment(
      this,
      "h0ck-front-deployment", {
      sources: [aws_s3_deployment.Source.asset(FRONT_BUILD_LOCATION)],
      destinationBucket: frontBucket
    }
    )

    //Restore variables in front to keep files untouched after deploy
    if (!Token.isUnresolved(ipOut.value)) {
      fs.readdirSync(path.join(FRONT_BUILD_LOCATION, "/static/js")).forEach(file => {
        let filePath = path.join(FRONT_BUILD_LOCATION, "/static/js", file);
        fs.writeFileSync(filePath, frontFileCache[file]);
      })
    }

    new CfnOutput(this, 'h0ck-front-url', {
      value: frontBucket.bucketWebsiteUrl
    })



  }
}

module.exports = { InfrastructureStack }
