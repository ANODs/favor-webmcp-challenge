import { create } from "zustand";

type BackButtonState = {
  stack: Array<() => void>;
  pushHandler: (handler: () => void) => void;
  popHandler: (handler: () => void) => void;
};

export const useBackButtonStore = create<BackButtonState>((set) => ({
  stack: [],
  pushHandler: (handler) => set((state) => ({ stack: [...state.stack, handler] })),
  popHandler: (handler) =>
    set((state) => ({ stack: state.stack.filter((h) => h !== handler) })),
}));
