"use client";

import * as React from "react";

const STORAGE_KEY = "money-log:hide-values";
const CHANGE_EVENT = "money-log:hide-values-change";

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useHideValues() {
  const hidden = React.useSyncExternalStore(
    subscribe,
    readHidden,
    () => false
  );

  const setHidden = React.useCallback((next: boolean) => {
    writeHidden(next);
  }, []);

  const toggle = React.useCallback(() => {
    writeHidden(!readHidden());
  }, []);

  return { hidden, setHidden, toggle };
}
