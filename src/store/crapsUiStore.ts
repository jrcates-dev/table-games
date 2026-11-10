import { createTableUi } from './tableUi'

/**
 * Craps interface chrome: which drawer is open, and whether the bet rail is
 * folded away. The same chrome every other railed table keeps (see
 * `tableUi.ts`), with the rail remembered under the same key as before.
 */
export type CrapsPanelId = 'reference' | 'stats' | 'settings'

export const useCrapsUiStore = createTableUi<CrapsPanelId>('craps')
