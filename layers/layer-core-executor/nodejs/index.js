let fs = require('fs')
exports.handler = async (payload) => {
    console.log(process.version)
    fs.readdirSync('/opt/nodejs').forEach(file => {
        console.log("-->", file);
      });
    return payload
}