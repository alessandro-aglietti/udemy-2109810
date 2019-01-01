// sample from http://bcoin.io/guides/connect-local-nodes.html

// necessary for portability
const os = require('os');
const path = require('path');

const bcoin = require('bcoin').set('testnet');
const NetAddress = bcoin.net.NetAddress;
const Network = bcoin.Network;
const pEvent = require('p-event'); // tool to await for events

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const testnet = Network.get().toString();
const logPrefix = path.join(os.homedir(), 'connect-test');

// create nodes
const spvNode = new bcoin.SPVNode({
  network: testnet,
  httpPort: 48449, // avoid clash of ports

  // write log file and chain data to specific directory
  prefix: path.join(logPrefix, 'SPV'),
  memory: false,
  logFile: true,
  logConsole: false,
  logLevel: 'spam',

  // reduce log spam on SPV node (cannot reduce to 0 for full node)
  maxOutbound: 1,
});

// nodes created!


(async () => {
  // creates directory at `prefix`
  await spvNode.ensure();

  // start nodes
  await spvNode.open();

  await spvNode.connect();
  // nodes started!

  // start the SPV node's blockchain sync
  spvNode.startSync();

  // SPV node: watch this address
  const address = bcoin.Address.fromString('R9M3aUWCcKoiqDPusJvqNkAbjffLgCqYip', spvNode.network);
  spvNode.pool.watchAddress(address);

  // SPV node: catch tx events
  spvNode.on('tx', (tx) => {
    console.log('-- SPV node received tx: --\n', tx);
  });

  // allow some time for spvNode to figure
  // out that its peer list is empty
  await delay(800);

  // no peers for the spvNode yet :(
  console.log('spvNode\'s peers before connection:', spvNode.pool.peers.head());

  // get peer from known address
  const addr = new NetAddress({
    host: '127.0.0.1',
    port: 18333
  });

  // connect spvNode with fullNode
  const peer = spvNode.pool.createOutbound(addr);
  spvNode.pool.peers.add(peer);

  // await to establish connection
  await pEvent(spvNode.pool, 'peer connect');
  // nodes are now connected!

  console.log('spvNode\'s peers after connection:', spvNode.pool.peers.head());

  // closing nodes
  await spvNode.disconnect();

  await spvNode.close();
  // nodes closed
})();
