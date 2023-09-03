# x32trimmer

a proof-of-concept script to do gain compensation for X32

___

## what is

Using AES50, it is possible to connect two X32 mixers to the same set of microphone preamps. Only one mixer can adjust the preamp gain, while the other has a digital trim control which turns the signal up or down by 18dB.

When the preamp gain is adjusted, the signal level will change for both mixers, which is not ideal.

This script reads the preamp gain configuration from one mixer, and applies a digital trim correction on the other mixer to keep the signal at the same level.

## config

all configuration is done in `config.json`:

- `preampX32` is the IP address of the mixer controlling the preamps.
- `trimX32` is the IP address of the mixer where trim compensation will be applied.

Each entry in the `channels` array is a mapping from a headamp to a channel trim.

`headamp` numbers are from 0-127, where:
- 0-31 are the Local XLRs
- 32-79 are AES50 A inputs
- 80-127 are AES50 B inputs

`trimChannel` is the channel you want to track that headamp, from 1-32. Aux channels are not supported yet.

The included config.json file will track preamps Local 1-8 on one console, and trim channels 1-8 on another. To add more tracked gains, just copy/paste and change the numbers.

Yes, I know this is a pain in the ass to set up. This took me two hours. Give me a break, willya?

## installation

Have node >=20.5 installed on your system, then download .zip from the green <>code button at the top of the page

cd into the downloaded directory

`npm i` to install the node packages

`node index.js` to run it

## use

First of all press `z` which will zero all the trims on the trimX32 mixer.

On the preampX32 mixer, start dialing in your gains. Once happy, press `s` to store them.

To begin tracking, press `[`. Gain changes from the preampX32 mixer will be monitored. If the preamp number is found in the config, the relevant channel on the trimX32 mixer will be trimmed to compensate.

Essentially, it's doing `trim = storedGain - actualGain` for each channel.

If the preamp is adjusted to more then 18dB away from the stored value, the script will spew warnings about being out of trim range.

This is about the only error checking in the whole thing. It's a jank proof of concept. So there.

To stop tracking, press `]`. Gain changes during this time will not be recorded, although the stored gains will remain.

`ctrl-c` or `q` to quit.

