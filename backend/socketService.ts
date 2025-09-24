// socketService.ts
// Handles frontend WebSocket/Socket.IO connections and bridges to MQTT

import { Server as SocketIOServer, Socket } from 'socket.io';
import mqttClient, { publishToClassroom } from './mqttService';

let io: SocketIOServer | null = null;

export function initSocketService(server: any) {
  io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket: Socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // Example: Listen for classroom command from frontend and publish to MQTT
    socket.on('classroom-command', ({ classroomId, command }) => {
      publishToClassroom(classroomId, 'commands', command);
      socket.emit('command-ack', { classroomId, status: 'sent' });
    });

    // Example: Subscribe to classroom topics on request
    socket.on('subscribe-classroom', ({ classroomId }) => {
      // Optionally subscribe to MQTT topics here
      socket.join(`classroom-${classroomId}`);
      socket.emit('subscribed', { classroomId });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  // Bridge MQTT messages to Socket.IO
  mqttClient.on('message', (topic: string, message: Buffer) => {
    if (!io) return;
    // Example: Forward telemetry/status to relevant room
    const match = topic.match(/^classroom\/(.+)\/(status|telemetry)$/);
    if (match) {
      const classroomId = match[1];
      const type = match[2];
      io.to(`classroom-${classroomId}`).emit(`mqtt-${type}`, {
        classroomId,
        type,
        payload: message.toString()
      });
    }
  });
}

export default { initSocketService };
