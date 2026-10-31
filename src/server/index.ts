import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { RoomManager } from './roomManager';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT || '3000', 10);

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: { origin: '*' },
  });

  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    roomManager.registerSocket(socket);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log('> Ready on http://0.0.0.0:' + port);
  });
});
