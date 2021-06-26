#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as cxapi from 'aws-cdk-lib/cx-api';

import { SdkProvider } from 'aws-cdk/lib/api/aws-auth';
import { CloudFormationDeployments } from 'aws-cdk/lib/api/cloudformation-deployments';
import { CloudExecutable } from 'aws-cdk/lib/api/cxapp/cloud-executable';
import { execProgram } from 'aws-cdk/lib/api/cxapp/exec';
import { ToolkitInfo } from 'aws-cdk/lib/api/toolkit-info';
import { BootstrapSource, Bootstrapper } from 'aws-cdk/lib/api/bootstrap';
import { CdkToolkit } from 'aws-cdk/lib/cdk-toolkit';
import { RequireApproval } from 'aws-cdk/lib/diff';
import { debug } from 'aws-cdk/lib/logging';
import { Command, Configuration } from 'aws-cdk/lib/settings';
import * as version from 'aws-cdk/lib/version';

class deployOptions {
  force?: boolean
}
let configuration = null;
let sdkProvider = null;
let cloudFormation = null;
let cloudExecutable = null;
let toolkitStackName: string = null;
let loaded = false;

async function preLoad(appFile, force) {
  if (!loaded || force) {
    //Set the default region specified in the CDK var
    process.env.AWS_DEFAULT_REGION = process.env.CDK_DEFAULT_REGION;

    debug('CDK toolkit version:', version.DISPLAY_VERSION);
    let tempConfig = {
      app: 'node ' + path.join(__dirname, '../' , appFile),
      _: {}
    }
    configuration = new Configuration({
      commandLineArguments: {
        ...tempConfig,
        _: tempConfig._ as [Command, ...string[]], // TypeScript at its best
      }
    });
    await configuration.load();
    sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
      profile: configuration.settings.get(['profile']),
      ec2creds: undefined,
      httpOptions: {
        proxyAddress: undefined,
        caBundlePath: undefined,
      },
    });

    cloudFormation = new CloudFormationDeployments({ sdkProvider });
    cloudExecutable = new CloudExecutable({
      configuration,
      sdkProvider,
      synthesizer: execProgram,
    });

    toolkitStackName = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
    loaded = true;
  }
  return;
}


function determineBootsrapVersion(args: { template?: string }, configuration: Configuration): BootstrapSource {
  const isV1 = version.DISPLAY_VERSION.startsWith('1.');
  return isV1 ? determineV1BootstrapSource(args, configuration) : determineV2BootstrapSource(args);
}

function determineV1BootstrapSource(args: { template?: string }, configuration: Configuration): BootstrapSource {
  let source: BootstrapSource;
  if (args.template) {
    console.log(`Using bootstrapping template from ${args.template}`);
    source = { source: 'custom', templateFile: args.template };
  } else if (process.env.CDK_NEW_BOOTSTRAP) {
    console.log('CDK_NEW_BOOTSTRAP set, using new-style bootstrapping');
    source = { source: 'default' };
  } else if (isFeatureEnabled(configuration, cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT)) {
    console.log(`'${cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT}' context set, using new-style bootstrapping`);
    source = { source: 'default' };
  } else {
    // in V1, the "legacy" bootstrapping is the default
    source = { source: 'legacy' };
  }
  return source;
}

function determineV2BootstrapSource(args: { template?: string }): BootstrapSource {
  let source: BootstrapSource;
  if (args.template) {
    console.log(`Using bootstrapping template from ${args.template}`);
    source = { source: 'custom', templateFile: args.template };
  } else if (process.env.CDK_LEGACY_BOOTSTRAP) {
    console.log('CDK_LEGACY_BOOTSTRAP set, using legacy-style bootstrapping');
    source = { source: 'legacy' };
  } else {
    // in V2, the "new" bootstrapping is the default
    source = { source: 'default' };
  }
  return source;
}

function isFeatureEnabled(configuration: Configuration, featureFlag: string) {
  return configuration.context.get(featureFlag) ?? cxapi.futureFlagDefault(featureFlag);
}


async function deploy(appFile, forceConfig, stackNamesList?: string[], options?: deployOptions, ) {
  await preLoad(appFile, forceConfig);
  debug(`Toolkit stack: ${toolkitStackName}`);

  const stacks = stackNamesList || ['*'];
  const cli = new CdkToolkit({
    cloudExecutable,
    cloudFormation,
    verbose: true,
    ignoreErrors: false,
    strict: false,
    configuration,
    sdkProvider,
  });

  

  console.log(options?.force ? "Forcing" : "Not forcing")
  const source: BootstrapSource = determineBootsrapVersion({}, configuration);
  const bootstrapper = new Bootstrapper(source);
  console.log("Bootstraping")
  await cli.bootstrap([], bootstrapper, {
    toolkitStackName: toolkitStackName,
    tags: configuration.settings.get(['tags']),
    parameters: {
      bucketName: configuration.settings.get(['toolkitBucket', 'bucketName']),
      kmsKeyId: configuration.settings.get(['toolkitBucket', 'kmsKeyId']),
    },
  });
  console.log("Bootstraped")
  console.log("Synth")
  await cli.synth(stacks, false, false)
  console.log("Synthed")
  await cli.deploy({
    stackNames: stacks,
    toolkitStackName,
    force: options?.force,
    requireApproval: RequireApproval.Never,
    outputsFile: "./tmpOutputFileDeployment.json",
    tags: configuration.settings.get(['tags']),
    progress: configuration.settings.get(['progress']),
  });

  let data = fs.readFileSync('./tmpOutputFileDeployment.json', { encoding: 'utf8' })
  fs.unlinkSync('./tmpOutputFileDeployment.json');
  let dataParsed = JSON.parse(data);
  return dataParsed;
}

async function destroy(appFile, forceConfig) {
  await preLoad(appFile, forceConfig);

  debug('CDK toolkit version:', version.DISPLAY_VERSION);
  // let tempConfig = {
  //   app: 'node ' + path.join(__dirname, '../' + appFile),
  //   _: {}
  // }
  // const configuration = new Configuration({
  //   commandLineArguments: {
  //     ...tempConfig,
  //     _: tempConfig._ as [Command, ...string[]], // TypeScript at its best
  //   }
  // });
  // await configuration.load();

  // const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
  //   profile: configuration.settings.get(['profile']),
  //   ec2creds: undefined,
  //   httpOptions: {
  //     proxyAddress: undefined,
  //     caBundlePath: undefined,
  //   },
  // });

  // const cloudFormation = new CloudFormationDeployments({ sdkProvider });
  // const cloudExecutable = new CloudExecutable({
  //   configuration,
  //   sdkProvider,
  //   synthesizer: execProgram,
  // });

  // const toolkitStackName: string = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
  // debug(`Toolkit stack: ${toolkitStackName}`);

  const stacks = ['*'];
  const cli = new CdkToolkit({
    cloudExecutable,
    cloudFormation,
    verbose: true,
    ignoreErrors: false,
    strict: false,
    configuration,
    sdkProvider,
  });


  return cli.destroy({
    stackNames: stacks,
    exclusively: false,
    force: true,
    roleArn: undefined,
  });
}

module.exports.deploy = deploy;
module.exports.destroy = destroy;

// deploy(["EC2Stack"]).then(res=>{
//     console.log("Finished deployment")
//     console.log(res);
// });
//destroy();
