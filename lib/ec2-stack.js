const { Stack,  Tags,  CfnOutput, aws_iam, aws_ec2 } = require('aws-cdk-lib');


const config = {
    env: {
        account: "708458997034",
        region: "eu-west-3"
    }
}

class EC2Stack extends Stack {
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
      aws_ec2.Port.tcp(7001),
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
    ssmaUserData.addCommands('sudo mkdir /home/ec2-user/h0ck')
    ssmaUserData.addCommands('sudo curl https://raw.githubusercontent.com/H0ck/infrastructure/main/backend-docker/docker-compose.yaml -o /home/ec2-user/h0ck/docker-compose.yaml')
    ssmaUserData.addCommands('cd /home/ec2-user/h0ck')
    ssmaUserData.addCommands('sudo docker-compose -f /home/ec2-user/h0ck/docker-compose.yaml up -d')
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

    let ipOut = new CfnOutput(this, 'h0ck_ec2_public_ip', {
      value: instance.instancePublicIp
    })

    scope.ipOut = instance.instancePublicIp;


  }
}

module.exports = { EC2Stack }
