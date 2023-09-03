const osc = require('osc');
const fs = require('fs');
var keypress = require('keypress');

var config = {};
var preampX32; // = new osc.UDPPort();
var trimX32; // = new osc.UDPPort();

var gains = [];
var prevGains = [];
var storedGains = [];
var commandTrims = [];
var ch2map = Array(32).fill(-1);

var firstRun = true;
var enabled = false;

keypress(process.stdin);
process.stdin.setRawMode(true);
init();


function init() {
    fs.readFile('./config.json', 'utf8', (err, data) => {
        if (err) {
            console.log(`Error reading file from disk: ${err}`);
            process.exit();
        } else {
            config = JSON.parse(data);
            console.log(config);
            preampX32 = new osc.UDPPort({
                localPort: 15556,
                remotePort: 10023,
                localAddress: '0.0.0.0',
                remoteAddress: config.preampX32
            });
            trimX32 = new osc.UDPPort({
                localPort: 15557,
                remotePort: 10023,
                localAddress: '0.0.0.0',
                remoteAddress: config.trimX32
            });
            preampX32.open();
            trimX32.open();
			printInstructions();

			// create reverse lookup so we can find the preamp by the trim channel number
			for (let i=0; i<32; i++) {
				for (let j=0; j<config.channels.length; j++) {
					if (config.channels[j].trimChannel==(i+1)) {
						ch2map[i]=j;
						break;
					}
				}
			}

            preampX32.on('ready', function() {
                console.log(`preamp X32 ready on ${config.preampX32}`);
                setInterval(subscribePreamps, 8000);
                subscribePreamps();
                
            });

            trimX32.on('ready', function() {
                console.log(`trim X32 ready on ${config.trimX32}`);
                setInterval(subscribeTrims,8000);
                subscribeTrims();
            });

            preampX32.on('message', function(oscMessage) {
                handleGains(oscMessage);
            });

            trimX32.on('message', function (oscMessage) {
            	handleTrims(oscMessage);
            })
        }
    });
}

function handleGains(msg) {
    if (msg.address.match('ha')) {
        let g = Array.from(new Float32Array(msg.args[0].buffer, msg.args[0].byteOffset, msg.args[0].byteLength / 4));
        g.shift();
        if (firstRun) {
            for (let i = 0; i < 128; i++) {
                gains[i] = (g[i] * 72) - 12;
            }
            firstRun = false;
        } else {
            for (let i = 0; i < 128; i++) {
                let newGain = (g[i] * 72) - 12;
                if (gains[i] != newGain) { // we changed this one	
                    gains[i] = newGain;
                    // now try and find it in our "database" if we are tracking
                    if (enabled) {
                        var idx = 0;
                        while (idx < config.channels.length) {
                            if (config.channels[idx].headamp == i) {
                                var gainDifference = storedGains[i] - gains[i];
                                var ch = config.channels[idx];
                                if (Math.abs(gainDifference) > 18) {
                                    console.log(`WARNING: preamp #${ch.headamp} gain of ${gains[i].toFixed(1)} is out of trim range!`);
                                    break;
                                } else {
                                    console.log(`Preamp #${ch.headamp} changed, trim channel ${ch.trimChannel} -> ${gainDifference.toFixed(1)}dB`);
                                    setTrim(ch.trimChannel, gainDifference);
                                    commandedTrim[idx] = gainDifference;
                                    break;
                                }
                            }
                            idx++;
                        }
                        if (idx == config.channels.length) console.log(`preamp #${i} changed gain to ${gains[i].toFixed(1)}dB but we don't have it in our config`);
                    }
                }
            }
        }
    } 
}

function handleTrims (msg) {
	if (msg.address.match('tr')) {
   		let tr = Array.from(new Float32Array(msg.args[0].buffer, msg.args[0].byteOffset, msg.args[0].byteLength / 4));
   		tr.shift();			// remove first 4 bytes of the message which is the blob length
   		console.log (`${(tr[0]*36-18).toFixed(1)}`)
   		for (let i=0; i<tr.length; i++) {

   		}
    }
}
function subscribePreamps() {
    preampX32.send({
        address: `/formatsubscribe`,
        args: [{
            type: `s`,
            value: `/ha`
		}, {
            type: `s`,
            value: `/headamp/***/gain`
		}, {
            type: `i`,
            value: 0
		}, {
            type: `i`,
            value: 127
		}, {
            type: `i`,
            value: 1

		}]
    });
}

function subscribeTrims() {
    trimX32.send({
        address: `/formatsubscribe`,
        args: [{
            type: `s`,
            value: `/tr`
		}, {
            type: `s`,
            value: `/ch/**/preamp/trim`
		}, {
            type: `i`,
            value: 1
		}, {
            type: `i`,
            value: 32
		}, {
            type: `i`,
            value: 1

		}]
    });	
}


process.stdin.on('keypress', function(ch, key) {
    if (key && key.ctrl && key.name == 'c') {
        // process.stdin.pause();
        process.exit(1);
    }
    // console.log (ch);
    if (ch) {
        switch (ch) {
            case '[':
                console.log(`go`);
                enabled = true;
                break;
            case ']':
                console.log(`stop`);
                enabled = false;
                break;
            case 's':
                storePreamps();
                break;
            case 'z':
                zeroTrims();
                break;
            case 'q':
                preampX32.close();
                trimX32.close();
                process.exit(1);
                break;
        }
    }
});

function printInstructions() {
    console.log(`
press [ to start tracking
press ] to stop tracking
press s to store curent preamp gains
press z to zero trims on the trim mixer
press q or ctrl-c to quit
	`);
}

// Store current preamp values for future trim calculation.

function storePreamps() {
    storedGains = [...gains];
    prevGaine = [...gains];
    console.log(`gains stored`);
}

function zeroTrims() {
    for (let i = 0; i < config.channels.length; i++) {
        setTrim(config.channels[i].trimChannel, 0.0);
        console.log(`zero trim -> channel ${config.channels[i].trimChannel} on ${config.trimX32}`);
    }
}

function setTrim(channel, value) {
    if (value < -18 || value > 18) return;
    floatval = (value + 18) / 36;
    trimX32.send({
        address: `/ch/${channel.toString().padStart(2,'0')}/preamp/trim`,
        args: [{
            type: `f`,
            value: floatval
			}]
    });
}