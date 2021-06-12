#!/usr/bin/env node
const cdkutils = require('./utils/cdkutils');
let args = process.argv.slice(2);
const fs = require('fs');
const path = require('path');

if (args.length === 0) {
    //Dynamic execution
    console.log("Dynamic execution2")
} else {
    //Call the corresponding converter removing the converter name parameter.
    process.env.EXTERNAL_IP = "78.30.20.108";

    if (args[0] === 'deploy') {
        // let cdkPath = './cdk.json';
        // let data = require(cdkPath);

        // try {
        //     if (!fs.existsSync(cdkPath)) {
        //         fs.writeFileSync(cdkPath, JSON.stringify(data))
        //     }
        //   } catch(err) {
        //     console.error(err)
        //   }

        cdkutils.deploy(['EC2Stack', 'LambdasStack']).then(outputs => {
            console.log("Storing outputs in frontend", outputs)
            let infrastructureJson = { "h0ck_core": "http://" + outputs?.EC2Stack?.h0ckec2publicip + ":7001"};
            console.log(infrastructureJson)
            fs.writeFileSync(path.join(__dirname, "/frontfiles/infrastructure.json"), JSON.stringify(infrastructureJson));
            console.log("Starting front deploy")
            cdkutils.deploy(['FrontStack'], {force: true}).then(outputs => {
                console.log("Deployment finished")
            })
        });
    } else if (args[0] === 'destroy') {
        cdkutils.destroy();
    }
    else {
        console.log("Command", args[0], "not found");
    }
}