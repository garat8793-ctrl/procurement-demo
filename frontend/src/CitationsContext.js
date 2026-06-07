import { createContext, useContext } from 'react';

export const CitationsContext = createContext(true);

export function useCitations() {
  return useContext(CitationsContext);
}
