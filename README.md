# H0ck Framework - Infrastructure

Repository for H0ck Framework Infrastructure. In this repository all the configuration, data and files for the deployment in AWS is stored. 

This is also a NPM package that can be executed in with a command line interface:

    npx h0ck-infrastructure

The stacks used in the deployment are specified in the /lib folder. There is one file for each one of the component.
This component implements the AWS CDK framework. All the info about this framework can be found on 

https://aws.amazon.com/es/cdk/

## Services deployed
### EC2 Machine
By default one instance of a T2 micro with linux is deployed. A docker compose is sent to the EC2 and executed to deploy the H0ck Core API together with a Redis database. Finally the IP of the machine is extracted to a environment variable used in the deploy for the next service, the AWS S3 Bucket.
### S3 Bucket
The deployment creates a S3 buckets with all the files contained in the frontfiles folder. The front files are already in the folder, but the react app will be built before deployment to have the latest version and to create the infrastructure.json file with the IP of the EC2 machine previously deployed on it.

By default, once the application is destroyed the bucket together with all the files are removed.

### Lambda functions
The final service to be deployed are the specified lambda functions. The amount of lambda deployment and its configuration can be changed in the h0ck-infrastructure.yaml file. This file contains which amount of lambdas should be deployed for each one of the frameworks availables.

Lambdas uses AWS Lambda Layers so each instance of a Lambda only takes some bytes of space. The more lambdas are deployed, the more IPs will be available for the H0ck framework to use and to distribute the jobs.
