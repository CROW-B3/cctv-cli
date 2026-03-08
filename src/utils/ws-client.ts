import chalk from 'chalk';
import WebSocket from 'ws';

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;

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

  let socket: WebSocket;
  let openCallback: (() => void) | undefined;
  let messageCallback: ((data: string) => void) | undefined;
  let closeCallback: (() => void) | undefined;
  let retryCount = 0;
  let manuallyClosed = false;

  function connect() {
    socket = new WebSocket(connectionUrl);

    socket.on('open', () => {
      retryCount = 0;
      openCallback?.();
    });

    socket.on('message', (data: WebSocket.Data) =>
      messageCallback?.(data.toString())
    );

    socket.on('close', code => {
      if (manuallyClosed) {
        closeCallback?.();
        return;
      }

      if (retryCount >= MAX_RETRIES) {
        console.error(
          chalk.red(`Max retries (${MAX_RETRIES}) reached. Giving up.`)
        );
        closeCallback?.();
        return;
      }

      const jitter = Math.random() * BASE_DELAY_MS;
      const delay = BASE_DELAY_MS * 2 ** retryCount + jitter;
      retryCount++;
      console.warn(
        chalk.yellow(
          `Connection closed (code ${code}). Reconnecting in ${Math.round(delay)}ms... (attempt ${retryCount}/${MAX_RETRIES})`
        )
      );
      setTimeout(connect, delay);
    });

    socket.on('error', (error: Error) => {
      console.error(chalk.red('WebSocket error:'), error.message);
    });
  }

  connect();

  return {
    send: (data: string) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(data);
    },
    close: () => {
      manuallyClosed = true;
      socket.close();
    },
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
