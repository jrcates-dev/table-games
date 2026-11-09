import { evaluate, type EvJob } from './ev'

/**
 * Values every set off the main thread. A few thousand dealer hands set the
 * house way is a moment on a laptop and longer on a phone — long enough to
 * stall the deal if the table did it itself.
 */
self.onmessage = (event: MessageEvent<EvJob>) => {
  const { id, ...job } = event.data
  self.postMessage({ id, evs: evaluate(job) })
}
