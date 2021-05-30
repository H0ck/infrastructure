
const requireFromString = require('require-from-string');
const utils = require('./executor-utils');

exports.handler = async (payload) => {
        let response = {}
        try {
            let responseScript = await runScript(utils.JSONEscape(payload.code), payload.config);
            response.result = responseScript
        } catch (err) {
            response.err = 'Error in code execution: ' + err
            throw err;
        } finally {
            return response
        }
};


// Run raw JS file with a specific configuration.
async function runScript(scriptText, config) {
    let scriptResponse;
    try {
        const module = requireFromString(scriptText);
        scriptResponse = await module.main(config.params);
    } catch (error) {
        scriptResponse = 'Error running code: ' + error;
        throw Error(scriptResponse);
    }
    return scriptResponse;
}

