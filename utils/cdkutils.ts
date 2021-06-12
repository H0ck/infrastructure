#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';


import { SdkProvider } from 'aws-cdk/lib/api/aws-auth';
import { CloudFormationDeployments } from 'aws-cdk/lib/api/cloudformation-deployments';
import { CloudExecutable } from 'aws-cdk/lib/api/cxapp/cloud-executable';
import { execProgram } from 'aws-cdk/lib/api/cxapp/exec';
import { ToolkitInfo } from 'aws-cdk/lib/api/toolkit-info';
import { CdkToolkit } from 'aws-cdk/lib/cdk-toolkit';
import { RequireApproval } from 'aws-cdk/lib/diff';
import { debug } from 'aws-cdk/lib/logging';
import { Command, Configuration } from 'aws-cdk/lib/settings';
import * as version from 'aws-cdk/lib/version';

class deployOptions {
    force?: boolean
}

async function deploy(stackNamesList?: string[], options?: deployOptions) {
    debug('CDK toolkit version:', version.DISPLAY_VERSION);
    let tempConfig = {
        app: 'node ' +  path.join(__dirname , '../bin/infrastructure.js'),
        _: {}
    }
    const configuration = new Configuration({
        commandLineArguments: {
            ...tempConfig,
            _: tempConfig._ as [Command, ...string[]], // TypeScript at its best
          }
    });
    await configuration.load();
    const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
        profile: configuration.settings.get(['profile']),
        ec2creds: null,
        httpOptions: {
            proxyAddress: null,
            caBundlePath: null,
        },
    });

    const cloudFormation = new CloudFormationDeployments({ sdkProvider });
    const cloudExecutable = new CloudExecutable({
        configuration,
        sdkProvider,
        synthesizer: execProgram,
    });

    const toolkitStackName: string = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
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

    console.log(options?.force ? "Forcing": "Not forcing")
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

async function destroy() {
    debug('CDK toolkit version:', version.DISPLAY_VERSION);
    let tempConfig = {
        app: 'node ' +  path.join(__dirname , '../bin/infrastructure.js'),
        _: {}
    }
    const configuration = new Configuration({
        commandLineArguments: {
            ...tempConfig,
            _: tempConfig._ as [Command, ...string[]], // TypeScript at its best
          }
    });
    await configuration.load();

    const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
        profile: configuration.settings.get(['profile']),
        ec2creds: null,
        httpOptions: {
            proxyAddress: null,
            caBundlePath: null,
        },
    });

    const cloudFormation = new CloudFormationDeployments({ sdkProvider });
    const cloudExecutable = new CloudExecutable({
        configuration,
        sdkProvider,
        synthesizer: execProgram,
    });

    const toolkitStackName: string = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
    debug(`Toolkit stack: ${toolkitStackName}`);

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
        roleArn: null,
    });
}

module.exports.deploy = deploy;
module.exports.destroy = destroy;

// deploy(["EC2Stack"]).then(res=>{
//     console.log("Finished deployment")
//     console.log(res);
// });
//destroy();
