let unsavedWork = false;

export function setUnsavedWork(value: boolean) {
  unsavedWork = value;
}

export function hasUnsavedWork() {
  return unsavedWork;
}
