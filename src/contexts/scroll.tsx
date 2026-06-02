import { createContext, useContext } from 'react'

export const ScrollContainerContext = createContext<React.RefObject<HTMLElement> | null>(null)

export function useScrollContainer() {
  return useContext(ScrollContainerContext)
}
