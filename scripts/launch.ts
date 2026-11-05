import type { ChildProcess } from 'node:child_process';
import { constants } from 'node:os';

type InterruptSignal = 'SIGINT' | 'SIGTERM';

interface SignalSource {
  on(event: InterruptSignal, listener: () => void): unknown;
  off(event: InterruptSignal, listener: () => void): unknown;
}

interface ChildExitOptions {
  signals?: SignalSource;
  shutdownTimeoutMs?: number;
  onError?: (error: Error) => void;
  requestInterrupt?: (signal: InterruptSignal) => void | Promise<void>;
  forceStop?: () => void | Promise<void>;
}

/** Preserve test exit codes and bound interruption even when teardown does not finish. */
export function waitForChild(child: ChildProcess, options: ChildExitOptions = {}): Promise<number> {
  const signals = options.signals ?? process;
  const onError = options.onError ?? ((error: Error) => console.error(error.message));
  return new Promise((resolve) => {
    let interruptedBy: InterruptSignal | undefined;
    let finished = false;
    let launchFailed = false;
    let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
    let forcedStop: Promise<void> | undefined;

    const sendSignal = (signal: NodeJS.Signals) => {
      try {
        child.kill(signal);
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const forceStop = () => {
      if (finished || forcedStop) return;
      forcedStop = Promise.resolve().then(() => options.forceStop
        ? options.forceStop() : sendSignal('SIGKILL')).catch((error: unknown) => {
        onError(error instanceof Error ? error : new Error(String(error)));
        sendSignal('SIGKILL');
      });
    };
    const interrupt = (signal: InterruptSignal) => {
      if (finished) return;
      if (interruptedBy) {
        forceStop();
        return;
      }
      interruptedBy = signal;
      shutdownTimer = setTimeout(forceStop, options.shutdownTimeoutMs ?? 30_000);
      const failedDelivery = (error: unknown) => {
        onError(error instanceof Error ? error : new Error(String(error)));
        forceStop();
      };
      try {
        Promise.resolve(options.requestInterrupt ? options.requestInterrupt(signal) : sendSignal('SIGINT'))
          .catch(failedDelivery);
      } catch (error) { failedDelivery(error); }
    };
    const onSIGINT = () => interrupt('SIGINT');
    const onSIGTERM = () => interrupt('SIGTERM');
    const onChildError = (error: Error) => {
      if (child.pid === undefined) launchFailed = true;
      onError(error);
    };
    const finish = async (code: number | null, signal: NodeJS.Signals | null) => {
      if (finished) return;
      finished = true;
      if (shutdownTimer) clearTimeout(shutdownTimer);
      signals.off('SIGINT', onSIGINT);
      signals.off('SIGTERM', onSIGTERM);
      child.off('error', onChildError);
      child.off('close', finish);
      // A tree terminator can still be collecting descendants after the root closes.
      await forcedStop;
      resolve(interruptedBy
        ? interruptedBy === 'SIGINT' ? 130 : 143
        : launchFailed ? 1 : code ?? (signal ? 128 + constants.signals[signal] : 1));
    };

    signals.on('SIGINT', onSIGINT);
    signals.on('SIGTERM', onSIGTERM);
    child.on('error', onChildError);
    child.once('close', finish);
  });
}
