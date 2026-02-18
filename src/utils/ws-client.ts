import chalk from 'chalk';
import WebSocket from 'ws';

interface WebSocketClient {
  send: (data: string) => void;
  close: () => void;
  onOpen: (callback: () => void) => void;
  onMessage: (callback: (data: string) => void) => void;
  onClose: (callback: () => void) => void;
}

function buildConnectionUrl(
  baseUrl: string,
  sourceType: string,
  sourceName: string
): string {
  const connectionUrl = new URL(baseUrl);
  connectionUrl.searchParams.set('sourceType', sourceType);
  connectionUrl.searchParams.set('sourceName', sourceName);
  return connectionUrl.toString();
}

export function createWebSocketClient(
  baseUrl: string,
  sourceType: string,
  sourceName: string
): WebSocketClient {
  const connectionUrl = buildConnectionUrl(baseUrl, sourceType, sourceName);
  const socket = new WebSocket(connectionUrl);

  let openCallback: (() => void) | undefined;
  let messageCallback: ((data: string) => void) | undefined;
  let closeCallback: (() => void) | undefined;

  socket.on('open', () => openCallback?.());
  socket.on('message', (data: WebSocket.Data) =>
    messageCallback?.(data.toString())
  );
  socket.on('close', () => closeCallback?.());
  socket.on('error', (error: Error) => {
    console.error(chalk.red('WebSocket error:'), error.message);
  });

  return {
    send: (data: string) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(data);
    },
    close: () => socket.close(),
    onOpen: callback => {
      openCallback = callback;
    },
    onMessage: callback => {
      messageCallback = callback;
    },
    onClose: callback => {
      closeCallback = callback;
    },
  };
}
