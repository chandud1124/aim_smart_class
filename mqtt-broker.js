// MQTT Broker setup using Aedes (Node.js)
// Run this file to start a local MQTT broker on port 1883

const aedes = require('aedes')();
const net = require('net');

const PORT = 1883;

const server = net.createServer(aedes.handle);

server.listen(PORT, function () {
  console.log(`MQTT broker started and listening on port ${PORT}`);
});

aedes.on('client', function (client) {
  console.log(`Client Connected: ${client ? client.id : client} to broker`);
});

aedes.on('clientDisconnect', function (client) {
  console.log(`Client Disconnected: ${client ? client.id : client} from broker`);
});

aedes.on('publish', function (packet, client) {
  if (client) {
    console.log(`Message from client ${client.id}: topic=${packet.topic} payload=${packet.payload.toString()}`);
  }
});
