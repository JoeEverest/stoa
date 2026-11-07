// Set when the server runs inside the desktop app as an Electron utilityProcess.
declare namespace NodeJS {
  interface Process {
    parentPort?: {
      postMessage(message: unknown): void;
      on(event: "message", listener: (event: { data: any }) => void): void;
    };
  }
}
