import { RedactionResult, ChatEndpointLike } from "./types.js";

export type ObserverCallback<T> = (value: T) => void;
export type ObserverErrorCallback = (error: any) => void;
export type ObserverCompleteCallback = () => void;

export interface RedactionObserver<T> {
  next?: ObserverCallback<T>;
  error?: ObserverErrorCallback;
  complete?: ObserverCompleteCallback;
}

export interface RedactionSubscription {
  unsubscribe: () => void;
  closed: boolean;
}

export class PromptRedactionObservable {
  private subscribeFn: (
    observer: RedactionObserver<RedactionResult>,
  ) => () => void;

  constructor(
    subscribeFn: (
      observer: RedactionObserver<RedactionResult>,
    ) => () => void | void,
  ) {
    this.subscribeFn = (observer) => {
      const teardown = subscribeFn(observer);
      return typeof teardown === "function" ? teardown : () => {};
    };
  }

  public subscribe(
    observerOrNext:
      | RedactionObserver<RedactionResult>
      | ObserverCallback<RedactionResult>,
    error?: ObserverErrorCallback,
    complete?: ObserverCompleteCallback,
  ): RedactionSubscription {
    const observer: RedactionObserver<RedactionResult> =
      typeof observerOrNext === "function"
        ? { next: observerOrNext, error, complete }
        : observerOrNext;

    let isClosed = false;

    const safeObserver: RedactionObserver<RedactionResult> = {
      next: (val) => {
        if (!isClosed && observer.next) {
          observer.next(val);
        }
      },
      error: (err) => {
        if (!isClosed) {
          isClosed = true;
          if (observer.error) {
            observer.error(err);
          }
        }
      },
      complete: () => {
        if (!isClosed) {
          isClosed = true;
          if (observer.complete) {
            observer.complete();
          }
        }
      },
    };

    const teardown = this.subscribeFn(safeObserver);

    return {
      closed: isClosed,
      unsubscribe: () => {
        if (!isClosed) {
          isClosed = true;
          if (typeof teardown === "function") {
            teardown();
          }
        }
      },
    };
  }

  public async toPromise(): Promise<RedactionResult> {
    return new Promise((resolve, reject) => {
      let lastValue: RedactionResult | undefined;
      this.subscribe({
        next: (val) => {
          lastValue = val;
        },
        error: (err) => reject(err),
        complete: () => {
          if (lastValue) {
            resolve(lastValue);
          } else {
            reject(new Error("Observable completed without emitting a value"));
          }
        },
      });
    });
  }

  public pipe<R>(
    project: (result: RedactionResult) => Promise<R> | R,
  ): Promise<R> {
    return this.toPromise().then((res) => project(res));
  }

  public chain(endpoint: ChatEndpointLike): Promise<any> {
    return this.toPromise().then((res) => {
      return endpoint.chat([
        {
          role: "user",
          content: res.redactedText,
        },
      ]);
    });
  }
}
