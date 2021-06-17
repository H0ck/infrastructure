#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var cxapi = require("aws-cdk-lib/cx-api");
var aws_auth_1 = require("aws-cdk/lib/api/aws-auth");
var cloudformation_deployments_1 = require("aws-cdk/lib/api/cloudformation-deployments");
var cloud_executable_1 = require("aws-cdk/lib/api/cxapp/cloud-executable");
var exec_1 = require("aws-cdk/lib/api/cxapp/exec");
var toolkit_info_1 = require("aws-cdk/lib/api/toolkit-info");
var bootstrap_1 = require("aws-cdk/lib/api/bootstrap");
var cdk_toolkit_1 = require("aws-cdk/lib/cdk-toolkit");
var diff_1 = require("aws-cdk/lib/diff");
var logging_1 = require("aws-cdk/lib/logging");
var settings_1 = require("aws-cdk/lib/settings");
var version = require("aws-cdk/lib/version");
var deployOptions = /** @class */ (function () {
    function deployOptions() {
    }
    return deployOptions;
}());
function determineBootsrapVersion(args, configuration) {
    var isV1 = version.DISPLAY_VERSION.startsWith('1.');
    return isV1 ? determineV1BootstrapSource(args, configuration) : determineV2BootstrapSource(args);
}
function determineV1BootstrapSource(args, configuration) {
    var source;
    if (args.template) {
        console.log("Using bootstrapping template from " + args.template);
        source = { source: 'custom', templateFile: args.template };
    }
    else if (process.env.CDK_NEW_BOOTSTRAP) {
        console.log('CDK_NEW_BOOTSTRAP set, using new-style bootstrapping');
        source = { source: 'default' };
    }
    else if (isFeatureEnabled(configuration, cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT)) {
        console.log("'" + cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT + "' context set, using new-style bootstrapping");
        source = { source: 'default' };
    }
    else {
        // in V1, the "legacy" bootstrapping is the default
        source = { source: 'legacy' };
    }
    return source;
}
function determineV2BootstrapSource(args) {
    var source;
    if (args.template) {
        console.log("Using bootstrapping template from " + args.template);
        source = { source: 'custom', templateFile: args.template };
    }
    else if (process.env.CDK_LEGACY_BOOTSTRAP) {
        console.log('CDK_LEGACY_BOOTSTRAP set, using legacy-style bootstrapping');
        source = { source: 'legacy' };
    }
    else {
        // in V2, the "new" bootstrapping is the default
        source = { source: 'default' };
    }
    return source;
}
function isFeatureEnabled(configuration, featureFlag) {
    var _a;
    return (_a = configuration.context.get(featureFlag)) !== null && _a !== void 0 ? _a : cxapi.futureFlagDefault(featureFlag);
}
function deploy(stackNamesList, options) {
    return __awaiter(this, void 0, void 0, function () {
        var tempConfig, configuration, sdkProvider, cloudFormation, cloudExecutable, toolkitStackName, stacks, cli, source, bootstrapper, data, dataParsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logging_1.debug('CDK toolkit version:', version.DISPLAY_VERSION);
                    tempConfig = {
                        app: 'node ' + path.join(__dirname, '../bin/infrastructure.js'),
                        _: {}
                    };
                    configuration = new settings_1.Configuration({
                        commandLineArguments: __assign(__assign({}, tempConfig), { _: tempConfig._ })
                    });
                    return [4 /*yield*/, configuration.load()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, aws_auth_1.SdkProvider.withAwsCliCompatibleDefaults({
                            profile: configuration.settings.get(['profile']),
                            ec2creds: undefined,
                            httpOptions: {
                                proxyAddress: undefined,
                                caBundlePath: undefined
                            }
                        })];
                case 2:
                    sdkProvider = _a.sent();
                    cloudFormation = new cloudformation_deployments_1.CloudFormationDeployments({ sdkProvider: sdkProvider });
                    cloudExecutable = new cloud_executable_1.CloudExecutable({
                        configuration: configuration,
                        sdkProvider: sdkProvider,
                        synthesizer: exec_1.execProgram
                    });
                    toolkitStackName = toolkit_info_1.ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
                    logging_1.debug("Toolkit stack: " + toolkitStackName);
                    stacks = stackNamesList || ['*'];
                    cli = new cdk_toolkit_1.CdkToolkit({
                        cloudExecutable: cloudExecutable,
                        cloudFormation: cloudFormation,
                        verbose: true,
                        ignoreErrors: false,
                        strict: false,
                        configuration: configuration,
                        sdkProvider: sdkProvider
                    });
                    console.log((options === null || options === void 0 ? void 0 : options.force) ? "Forcing" : "Not forcing");
                    source = determineBootsrapVersion({}, configuration);
                    bootstrapper = new bootstrap_1.Bootstrapper(source);
                    console.log("Bootstraping");
                    return [4 /*yield*/, cli.bootstrap([], bootstrapper, {
                            toolkitStackName: toolkitStackName,
                            tags: configuration.settings.get(['tags']),
                            parameters: {
                                bucketName: configuration.settings.get(['toolkitBucket', 'bucketName']),
                                kmsKeyId: configuration.settings.get(['toolkitBucket', 'kmsKeyId'])
                            }
                        })];
                case 3:
                    _a.sent();
                    console.log("Bootstraped");
                    return [4 /*yield*/, cli.deploy({
                            stackNames: stacks,
                            toolkitStackName: toolkitStackName,
                            force: options === null || options === void 0 ? void 0 : options.force,
                            requireApproval: diff_1.RequireApproval.Never,
                            outputsFile: "./tmpOutputFileDeployment.json",
                            tags: configuration.settings.get(['tags']),
                            progress: configuration.settings.get(['progress'])
                        })];
                case 4:
                    _a.sent();
                    data = fs.readFileSync('./tmpOutputFileDeployment.json', { encoding: 'utf8' });
                    fs.unlinkSync('./tmpOutputFileDeployment.json');
                    dataParsed = JSON.parse(data);
                    return [2 /*return*/, dataParsed];
            }
        });
    });
}
function destroy() {
    return __awaiter(this, void 0, void 0, function () {
        var tempConfig, configuration, sdkProvider, cloudFormation, cloudExecutable, toolkitStackName, stacks, cli;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logging_1.debug('CDK toolkit version:', version.DISPLAY_VERSION);
                    tempConfig = {
                        app: 'node ' + path.join(__dirname, '../bin/infrastructure.js'),
                        _: {}
                    };
                    configuration = new settings_1.Configuration({
                        commandLineArguments: __assign(__assign({}, tempConfig), { _: tempConfig._ })
                    });
                    return [4 /*yield*/, configuration.load()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, aws_auth_1.SdkProvider.withAwsCliCompatibleDefaults({
                            profile: configuration.settings.get(['profile']),
                            ec2creds: undefined,
                            httpOptions: {
                                proxyAddress: undefined,
                                caBundlePath: undefined
                            }
                        })];
                case 2:
                    sdkProvider = _a.sent();
                    cloudFormation = new cloudformation_deployments_1.CloudFormationDeployments({ sdkProvider: sdkProvider });
                    cloudExecutable = new cloud_executable_1.CloudExecutable({
                        configuration: configuration,
                        sdkProvider: sdkProvider,
                        synthesizer: exec_1.execProgram
                    });
                    toolkitStackName = toolkit_info_1.ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
                    logging_1.debug("Toolkit stack: " + toolkitStackName);
                    stacks = ['*'];
                    cli = new cdk_toolkit_1.CdkToolkit({
                        cloudExecutable: cloudExecutable,
                        cloudFormation: cloudFormation,
                        verbose: true,
                        ignoreErrors: false,
                        strict: false,
                        configuration: configuration,
                        sdkProvider: sdkProvider
                    });
                    return [2 /*return*/, cli.destroy({
                            stackNames: stacks,
                            exclusively: false,
                            force: true,
                            roleArn: undefined
                        })];
            }
        });
    });
}
module.exports.deploy = deploy;
module.exports.destroy = destroy;
// deploy(["EC2Stack"]).then(res=>{
//     console.log("Finished deployment")
//     console.log(res);
// });
//destroy();
