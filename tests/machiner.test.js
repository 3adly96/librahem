const Cortex                = require('ion-cortex');

const cortex = new Cortex({
    prefix: config.dotEnv.CORTEX_PREFIX,
    url: config.dotEnv.CORTEX_REDIS,
    type: 'tester',
    state: ()=>{
        return {} 
    },
    activeDelay: "50ms",
    idlDelay: "200ms",
});


await cortex.AsyncEmitToOneOf({
    type: 'maat', call:'machiner.createMachine', args: {
        nodeType: 'sfu'
    }});
