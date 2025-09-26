// mqttService.ts
// Manages MQTT connection with Mosquitto and handles classroom topics

import mqtt from 'mqtt';

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://172.16.3.171:3002';
const client = mqtt.connect(MQTT_BROKER_URL);

const classroomTopics = (id: string) => [
  `classroom/${id}/commands`,
  `classroom/${id}/status`,
  `classroom/${id}/telemetry`
];

client.on('connect', () => {
  console.log('[MQTT] Connected to broker:', MQTT_BROKER_URL);
});

client.on('error', (err) => {
  console.error('[MQTT] Connection error:', err);
});

export function subscribeToClassroom(id: string) {
  classroomTopics(id).forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
      else console.log(`[MQTT] Subscribed to ${topic}`);
    });
  });
}

export function publishToClassroom(id: string, topicType: 'commands' | 'status' | 'telemetry', message: any) {
  const topic = `classroom/${id}/${topicType}`;
  client.publish(topic, JSON.stringify(message));
}

client.on('message', (topic, message) => {
  // Handle incoming MQTT messages here
  console.log(`[MQTT] Message on ${topic}:`, message.toString());
  // TODO: Bridge to backend logic or emit to Socket.IO as needed
});

export default client;
