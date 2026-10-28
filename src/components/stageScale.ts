import { createContext, useContext } from 'react'

/** The logical-to-screen scale a `Stage` is currently drawing at. */
export const StageScale = createContext(1)

/** The current scale, for anything that renders its own pixels, like a WebGL canvas. */
export function useStageScale(): number {
  return useContext(StageScale)
}
