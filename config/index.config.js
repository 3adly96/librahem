
require('dotenv').config()
const os                               = require('os');
const pjson                            = require('../package.json');
const utils                            = require('../libs/utils');
const SERVICE_NAME                     = (process.env.SERVICE_NAME)? utils.slugify(process.env.SERVICE_NAME):pjson.name;
const ENV                              = process.env.ENV || "production";
const REDIS_URI                        = process.env.REDIS_URI || "redis://127.0.0.1:6222";

const CORTEX_PREFIX                    = process.env.CORTEX_PREFIX || 'none';
const CORTEX_REDIS                     = process.env.CORTEX_REDIS || REDIS_URI;
const CORTEX_TYPE                      = process.env.CORTEX_TYPE || SERVICE_NAME;

const CACHE_REDIS                      = process.env.CACHE_REDIS || REDIS_URI;
const CACHE_PREFIX                     = process.env.CACHE_PREFIX || `${SERVICE_NAME}:ch`;
const ENVIROMENT                       = process.env.ENVIROMENT;
const DIGITAL_OCEAN_KEY                = process.env.DIGITAL_OCEAN_KEY;
const DO_PROJECT_ID                    = process.env.DO_PROJECT_ID;
const DO_SPARK_IMG                     = process.env.DO_SPARK_IMG;
const DO_SFU_IMG                       = process.env.DO_SFU_IMG;
const DO_SFU_SIZE                      = process.env.DO_SFU_SIZE;
const DO_SPARK_SIZE                    = process.env.DO_SPARK_SIZE;

const config                           = require(`./envs/${ENV}.js`);
config.dotEnv = {
    SERVICE_NAME,
    ENV,
    CORTEX_REDIS,
    CORTEX_PREFIX,
    CORTEX_TYPE,
    CACHE_REDIS,
    CACHE_PREFIX,
    DO_SPARK_SIZE,
    DO_SFU_SIZE,
    DO_SFU_IMG,
    DO_SPARK_IMG,
    ENVIROMENT,
    DIGITAL_OCEAN_KEY,
    DO_PROJECT_ID
};



module.exports = config;
