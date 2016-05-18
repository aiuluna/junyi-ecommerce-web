var CONFIG_ROOT = process.env['MAYIHG_CONFIG']; //E:\workspace\ecommerce\conf\local
if (!CONFIG_ROOT)
  throw new Error('"MAYIHG_CONFIG" variable is not defined in your environment!');

var path = require('path'),
    fs = require('fs');

var configFile = path.join(CONFIG_ROOT, 'ecommerce', 'web', 'config.json');
if (!fs.existsSync(configFile))
  throw new Error('Config file not exists: ' + configFile);

module.exports = JSON.parse(fs.readFileSync(configFile));
