const config                = require('./config/index.config.js');
const Cortex                = require('ion-cortex');
const Machiner                = require('./managers/MachineManager')

const cortex = new Cortex({
    prefix: config.dotEnv.CORTEX_PREFIX,
    url: config.dotEnv.CORTEX_REDIS,
    type: config.dotEnv.CORTEX_TYPE,
    state: ()=>{
        return {} 
    },
    activeDelay: "50ms",
    idlDelay: "200ms",
});

const machiner = new Machiner({cortex, config});
