type Listener = () => void;

class NetworkService {
  private online = navigator.onLine;

  private listeners = new Set<Listener>();

  constructor() {
    window.addEventListener("online", async () => {
      this.online = true;
      this.notify();
    });

    window.addEventListener("offline", () => {
      this.online = false;

      this.notify();
    });
  }

  isOnline() {
    return this.online;
  }

  isOffline() {
    return !this.online;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const networkService = new NetworkService();
