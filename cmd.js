#!/usr/bin/env node
const cdkutils = require('./utils/cdkutils');
let args = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
const term = require('terminal-kit').terminal;
term.on('key', function (name, matches, data) {
    if (name === 'CTRL_C') { terminate(); }
});
var AWS = require('aws-sdk');
let ec2 = null;



function terminate() {
    term.grabInput(false);
    setTimeout(function () { process.exit() }, 100);
}


const KEYPAIR_NAME = 'h0ck-ec2-keypair'
const KEYPAIR_PATH = './' + KEYPAIR_NAME + '.keypair';

function createKeyPair() {
    ec2.createKeyPair({ KeyName: KEYPAIR_NAME }, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            console.log('Storing keypair on', KEYPAIR_PATH)
            fs.writeFileSync(KEYPAIR_PATH, data.KeyMaterial)
        }
    });
}

function deleteKeyPairIfExists() {
    ec2.describeKeyPairs({ KeyNames: [KEYPAIR_NAME] }, function (err, data) {
        if (!err) {
            if (fs.existsSync(KEYPAIR_PATH)) {
                fs.unlinkSync(KEYPAIR_PATH)
            }
            ec2.deleteKeyPair({ KeyName: KEYPAIR_NAME }, function (err, data) {
                if (err) {
                    console.error("Error deleting keypair")
                }
            })
        }
    });
}

function createKeyPairIfNotExists() {
    ec2.describeKeyPairs({ KeyNames: [KEYPAIR_NAME] }, function (err, data) {
        if (err) {
            if (err.code === 'InvalidKeyPair.NotFound') {
                createKeyPair();
            }
            else {
                console.log("Error", err);
            }
        } else {
            if (fs.existsSync(KEYPAIR_PATH)) {
                console.log('Keypair file exists and keypair exists on amazon. Not creating it');
            } else {
                ec2.deleteKeyPair({ KeyName: KEYPAIR_NAME }, function (err, data) {
                    if (err) {
                        console.error("Error deleting keypair")
                    }
                    else {
                        createKeyPair();
                    }
                })
            }

        }
    });
}

function checkEnvVars() {
    let listToCheck = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'CDK_DEFAULT_ACCOUNT', 'CDK_DEFAULT_REGION', 'EXTERNAL_IP'];
    return new Promise(async (resolve, reject) => {
        let allValid = true;
        for (let variable of listToCheck) {
            if (!process.env[variable]) {
                allValid = false;
                term.yellow(variable + " env var not setted, please set and restart or write the value: \n");
                let input = await term.inputField({}).promise;
                term("\n")
                process.env[variable] = input;
                await checkEnvVars();
                resolve()
            }
        }
        if (allValid) {
            resolve()
        }

    })

}

async function preconfig() {
    await checkEnvVars();
    AWS.config.update({ region: process.env.CDK_DEFAULT_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } });
    ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
}

async function deploy() {
    await preconfig();
    createKeyPairIfNotExists();
    await cdkutils.deploy('/bin/infrastructure.js', false, ['EC2Stack', 'LambdasStack'], false).then(async function (outputs) {
        let infrastructureJson = { "h0ck_core": "http://" + outputs?.EC2Stack?.h0ckec2publicip + ":7001" };
        fs.writeFileSync(path.join(__dirname, "/frontfiles/infrastructure.json"), JSON.stringify(infrastructureJson));
        let data = fs.readFileSync(path.join(__dirname, "/frontfiles/infrastructure.json"), 'utf8');
        await cdkutils.deploy('/bin/infrastructurefront.js', true, ['FrontStack'], { force: true }, true).then(outputs => {
            console.log("Deployment finished")
        })
    });
}

async function destroy() {
    await preconfig();
    deleteKeyPairIfExists();
    await cdkutils.destroy('/bin/infrastructurefront.js', false);
    await cdkutils.destroy('/bin/infrastructure.js', true);
}

if (args.length === 0) {
    //Dynamic execution
    const TERM_OPTIONS_TEXT = {
        DEPLOY: 'Deploy',
        DESTROY: 'Destroy'
    }

    const TERM_OPTIONS_ACTIONS = {
        'Deploy': deploy,
        'Destroy': destroy,
    }

    let package = require('./package.json');

    term.blue("==================================")("\n")
    term.blue("==  ").cyan("Welcome to H0ck Framework.  ").blue("==")("\n")
    term.blue("==================================")("\n")
    term.green("Infrastructure Version: " + package.version)("\n");
    term.cyan("More info of this Open Source Framework in ").yellow("https://github.com/H0ck")("\n")
    term.blue("==================================")("\n")
    term("\n")
    term.bold("Select what action do you want to do with the H0ck Framework:")("\n")
    term.singleColumnMenu(Object.values(TERM_OPTIONS_TEXT), {}, async function (err, response) {
        await TERM_OPTIONS_ACTIONS[response.selectedText]()
        term.processExit()
    })



} else {
    //Call the corresponding converter removing the converter name parameter.
    process.env.EXTERNAL_IP = "78.30.20.108";

    if (args[0] === 'deploy') {
        deploy();

    } else if (args[0] === 'destroy') {
        destroy();
    }
    else {
        console.log("Command", args[0], "not found");
    }
}