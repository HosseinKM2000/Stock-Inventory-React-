const KEY = "inventory_device_fingerprint";

function uuid() {
  return crypto.randomUUID();
}

export function getDeviceFingerprint() {
  let id = localStorage.getItem(KEY);

  if (!id) {
    id = uuid();
    localStorage.setItem(KEY, id);
  }

  return id;
}