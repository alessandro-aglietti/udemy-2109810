// sample from http://bcoin.io/guides/connect-local-nodes.html

// necessary for portability
const os = require('os');
const path = require('path');
const fs = require('fs');

const bcoin = require('bcoin').set('testnet');
// expose https://bcoin.io/docs/bcoin.js.html#line51
const NetAddress = bcoin.net.NetAddress;
const Network = bcoin.Network;
const MerkleBlock = bcoin.MerkleBlock;
const pEvent = require('p-event'); // tool to await for events

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const testnet = Network.get();
// bcoin didn't allow to disable seeds
// https://bcoin.io/docs/net_pool.js.html#line3633
testnet.seeds = [];

const logPrefix = path.join(__dirname, 'connect-test');

// create nodes
const spvNode = new bcoin.SPVNode({
  network: testnet.toString(),
  // bcoin can't disable http/rpc liste
  httpPort: 18331,

  // write log file and chain data to specific directory
  prefix: path.join(logPrefix, 'SPV'),
  memory: false,
  logFile: true,
  logConsole: false,
  logLevel: 'spam',

  // reduce log spam on SPV node (cannot reduce to 0 for full node)
  maxOutbound: 1,
  nodes: [],
  seeds: [],
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
  // enabling the bloom filter
  // https://bcoin.io/docs/net_pool.js.html#line89
  // se non viene passata l'opzione copia quello della chain
  // https://bcoin.io/docs/net_pool.js.html#line3693
  const address = bcoin.Address.fromString('n4qKPDRyiWjCriqEGyffzraXq6bqyf2fws', spvNode.network);
  spvNode.pool.watchAddress(address);

  // SPV node: catch tx events
  spvNode.on('tx', (tx) => {
    const txHash = tx.hash('hex');
    fs.writeFileSync(`${__dirname}/tx_${txHash}.json`, JSON.stringify(tx.toJSON(), null, 2));
    console.log(`-- SPV node received tx: -- ${txHash}`);
  });

  spvNode.on('block', (block) => {
      if (MerkleBlock.isMerkleBlock(block)) {
        const blockHash = block.hash('hex');
        fs.writeFileSync(`${__dirname}/block_${blockHash}.json`, JSON.stringify(block.toJSON(), null, 2));
        console.log(`-- SPV node received MERKLEBLOCK: -- ${blockHash}`);
      } else {
        console.log(`-- SPV node received block: -- ${block.hash}`);
      }
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

  await pEvent(spvNode.pool, 'peer close');

  // closing nodes
  await spvNode.disconnect();

  await spvNode.close();
  // nodes closed
})();
