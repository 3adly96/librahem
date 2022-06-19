const debug = require('debug')('LoadMonitoring');
const axios = require('axios');
const dns   = require('dns');

module.exports = class Machiner {
    constructor({ cortex, config }) {
        this.cortex        = cortex;
        this.cortexExposed  = ['delOneOfMachinesByTag', 'createMachine'];

        this.env           = config.dotEnv.ENVIROMENT;
        this.keys          = { digitalOcean: config.dotEnv.DIGITAL_OCEAN_KEY };
        this.projectId     = config.dotEnv.DO_PROJECT_ID;
        this.region        = "fra1";
        this.dropletImages = {
            spark: config.dotEnv.DO_SPARK_IMG,
            sfu: config.dotEnv.DO_SFU_IMG
        }
        this.dropletSizes  = {
            spark: config.dotEnv.DO_SPARK_SIZE,
            sfu: config.dotEnv.DO_SFU_SIZE
        }
        
        this.cortex.sub('machiner.*', (d, meta, cb) => {
            let [moduleName, fnName] = meta.event.split('.');
            try {
                this.interceptor({ data: d, meta, cb, fnName });
            } catch (err) {
                cb({ error: `failed to execute ${fnName}` });
            }
        });
    }

    createUserData({ rdname, type }) {
        if(type == 'spark') {
            let domain = null;
            if(rdname.split('-')[0] == 'prd' ) `${rdname.substring(4)}.spacejat.com`;
            else domain = `${rdname}.spacejat.com`;
            return `#cloud-config\nruncmd:\n - sed -i 's/DOMAIN=.*/DOMAIN=${domain}/g' /code/crysb-spark/.env\n - printf DROPLET_ID=$(cat /var/lib/cloud/data/instance-id)'%b\\n' >> /code/crysb-spark/.env\n - cd /code/crysb-spark/ \n - git stash\n - git checkout master\n - git pull\n - npm install\n - reboot\n`
        }
        else if (type == 'sfu') {
            return `#cloud-config\nruncmd:\n - sed -i "s/MEDIASOUP_LISTEN_IP=.*/MEDIASOUP_LISTEN_IP=$(curl ifconfig.co)/g" /code/crysb-sfu/.env\n - sed -i 's/HOST=.*/HOST=${rdname}/g' /code/crysb-sfu/.env\n - printf DROPLET_ID=$(cat /var/lib/cloud/data/instance-id)'%b\\n' >> /code/crysb-sfu/.env\n - cd /code/crysb-sfu/ \n - git stash\n - git checkout master\n - git pull\n - npm install\n - reboot\n`
        }
    }

    createDns(dropletId) {
        console.log('creating machine dns');
        const digitalInterval = setInterval(async () => {
            try {
                const res = await this.getDropletById({ id: dropletId });

                // calling dream host for DNS creation
                if (res.droplet.status == "active") {
                    
                    console.log('*** Digitaloccean droplet info ***');
                    const publicIP = res.droplet.networks.v4[0].ip_address;
                    const privateIP = res.droplet.networks.v4[1].ip_address;
                    const rdname = res.droplet.name;
                    console.log("*** dropletPrivateIP ***", privateIP)
                    console.log("*** dropletPublicIP ***", publicIP)
                    const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };

                    let url = `https://api.digitalocean.com/v2/domains/spacejat.com/records`
                    let dnsData = {
                        "type": "A",
                        "name": rdname,
                        "data": publicIP,
                        "priority": null,
                        "port": null,
                        "ttl": 60,
                        "weight": null,
                        "flags": null,
                        "tag": null
                    }
                    console.log("*** url for DNS ***")
                    console.log(url)

                    let records = await axios.post(url, dnsData, { headers });

                    console.log('*** DNS response is success ***');
                    console.log(records.data);
                    // const dnsId = records.data.domain_record.id
                    clearInterval(digitalInterval);
                    let iterations = 0;
                    let dreamInterval = setInterval(() => {
                        iterations++;
                        if (iterations <= 20)
                            dns.lookup(`${rdname}.spacejat.com`, (err, address) => {
                                if (address) {
                                    console.log("*** droplet DNS created ***", address , `${rdname}.spacejat.com` )
                                    clearInterval(dreamInterval);
                                } else {
                                    console.log("*** droplet DNS still in progress ***")
                                }
                            });
                        else {
                            console.log(`Could not find DNS for ${rdname}.spacejat.com`);
                            clearInterval(dreamInterval);
                        }
                    }, 10000);
                }
            } catch (error) {
                return console.log("*** Error catch block ***", error);
            }
        }, 40000);
    }

    async assignResourceToProject(id) {
        const data = {
            "resources": [
                `do:droplet:${id}`
            ]
        }
        try {
            const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };
            const res = await axios.post(`https://api.digitalocean.com/v2/projects/${this.projectId}/resources`, data, { headers });
            console.log("*** Assigning resource to project ***")
            console.log(res.data)
        } catch (err) {
            console.log("*** Error while assigning resources to project ***")
            console.log(err);
        }
    }

    getRdname({ type, cortexList }) {
        const nodesValues = Object.values(cortexList[type]);
        if(nodesValues[0].nodeCpuLong){
            const distNodes = [];
            for(const {node} of nodesValues) {
                if(node && !distNodes.includes(node)) distNodes.push(node);
            }
            return `${this.env}-${type}-${distNodes.length+1}`;
        }
        return `${this.env}-${type}-${nodesValues.length+1}`;
    }

    async createMachine({ type, cortexList }) {
        let rdname = this.getRdname({ type, cortexList });
        const userData = this.createUserData({ type, rdname });
        const machineData = {
            "name": rdname,
            "region": this.region,
            "size": this.dropletSizes[type] || 's-1vcpu-1gb',
            "image": this.dropletImages[type],
            "ssh_keys": [34711773, 34653500],
            "backups": "false",
            "ipv6": "false",
            "volumes": null,
            "user_data": userData,
            "tags": [`${this.env}-${type}`]
        }
        console.log(machineData)
        const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };
        try {
            const res = await axios.post("https://api.digitalocean.com/v2/droplets", machineData, { headers });
            console.log('*** Digitalocean create droplet response ***');
            console.log(res.data);
            if(type != 'sfu') this.createDns(res.data.droplet.id);
            this.assignResourceToProject(res.data.droplet.id);
            return res.data
        } catch (err) {
            console.log("*** Digitalocean create droplet error ***",err);
            return { error: err.response.data };
        }
    }

    async getDropletById({ id }) {
        const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };
        try {        
            const res = await axios.get(`https://api.digitalocean.com/v2/droplets/${id}`, { headers });
            console.log(res.data)
            return res.data;
        } catch(err){
            console.log("*** Error catch block ***",err);
            return { error: err.response.data };
        }
    }

    delOneOfMachinesByTag({ tag }) {
        this.listDroplets({ tag }).then(data => {
            console.log(`Deleting droplet ${data.droplets[0].id} due to unnecessery existance.`);
            this.deleteDropletById({ id: data.droplets[0].id });
        });
    }

    async deleteDropletById({ id }) {
        const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };
        const droplet = await axios.get(`https://api.digitalocean.com/v2/droplets/${id}`, { headers });
        let dropletname = droplet.data.droplet.name
        let domain;
        if(dropletname.split('-')[0] == 'prd' ) domain = `${dropletname.substring(4)}.spacejat.com`;
        else domain = `${dropletname}.spacejat.com`;
        try {   
            axios.delete(`https://api.digitalocean.com/v2/droplets/${id}`, { headers });
            const dnsList = await axios.get(`https://api.digitalocean.com/v2/domains/spacejat.com/records?name=${domain}`, { headers });
            for (const { id } of dnsList.data.domain_records) {
                axios.delete(`https://api.digitalocean.com/v2/domains/spacejat.com/records/${id}`, { headers });
            }
            return `Droplet ${id} deleted`;
        } catch(err){
            console.log("*** Error catch block ***",err);
            return { error: err };
        }
    }

    async listDroplets({ tag }) {
        const headers = { Authorization: `Bearer ${this.keys.digitalOcean}` };
        try {
            const res = await axios.get(`https://api.digitalocean.com/v2/droplets${tag ? `?tag_name=${tag}` :''}`, { headers });
            return res.data;
        } catch(err){
            console.log("*** Error catch block ***",err);
            return { error: err.response.data };
        }
    }
    
    /** manager interceptor */
    async interceptor({ data, cb, meta, fnName }) {
        if (this.cortexExposed.includes(fnName)) {
            let result = await this[`${fnName}`](data);
            cb(result);
        } else {
            cb({ error: `${fnName} is not executable` })
        }
    }
}