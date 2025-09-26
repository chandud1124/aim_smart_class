// MQTT Broker setup using Aedes (Node.js)
// Run this file to start a local MQTT broker on port 1883

import aedes from 'aedes';
import net from 'net';

const broker = aedes();
const PORT = 3002; // Try a different port
const HOST = '0.0.0.0'; // Listen on all interfaces

const server = net.createServer(broker.handle);

server.listen(PORT, HOST, function () {
  const address = server.address();
  console.log(`MQTT broker started and listening on ${address.address}:${address.port}`);
});

broker.on('client', function (client) {
  console.log(`Client Connected: ${client ? client.id : client} to broker`);
});

broker.on('clientDisconnect', function (client) {
  console.log(`Client Disconnected: ${client ? client.id : client} from broker`);
});

broker.on('publish', function (packet, client) {
  if (client) {
    console.log(`Message from client ${client.id}: topic=${packet.topic} payload=${packet.payload.toString()}`);
  }
});
