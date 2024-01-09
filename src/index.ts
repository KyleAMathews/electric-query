import { useLiveQuery } from "electric-sql/react"
import { ElectricDatabase, electrify } from "electric-sql/wa-sqlite"
import { TabIdCoordinator } from "browser-tab-id"
import { ElectricConfig } from "electric-sql/config"

interface InitElectricParams {
  appName: string
  sqliteWasmPath: string
  schema: any // Replace 'any' with the actual type of schema if available
  config: ElectricConfig
}

// Get our tabId
const tabIdCoordinator = new TabIdCoordinator()

let electricResolve: (value: unknown) => void
let electricReject: (value: unknown) => void
const electricPromise = new Promise((resolve, reject) => {
  electricResolve = resolve
  electricReject = reject
})

export function setLoggedOut() {
  electricReject(`not logged in`)
}

export async function initElectric(params: InitElectricParams) {
  const { appName, sqliteWasmPath, schema, config } = params
  const tabId = tabIdCoordinator.tabId
  const tabScopedDbName = `${appName}-${tabId}.db`
  console.log({ tabScopedDbName })

  const conn = await ElectricDatabase.init(tabScopedDbName, sqliteWasmPath)
  const electric = await electrify(conn, schema, config)
  electricResolve(electric)

  return electric
}

interface ElectricWithDb {
  db: any // Specify the type of 'db' more precisely if possible
}

type ShapeFunction<Electric extends ElectricWithDb> = (params: {
  db: Electric[`db`]
}) => Array<{
  shape: Promise<any>
  isReady: () => Promise<boolean>
}>

type QueriesRecord<Electric extends ElectricWithDb> = (params: {
  db: Electric[`db`]
}) => Record<string, QueryFunction>

type QueryFunction = () => Promise<any>

// Define everything in loaders w/ a key & then the hook just references that key
const routeCache = new Map()
const queriesMap = new Map()

export async function electricSqlLoader<Electric extends ElectricWithDb>({
  key,
  shapes,
  queries,
}: {
  key: string
  shapes: ShapeFunction<Electric>
  queries: QueriesRecord<Electric>
}) {
  console.time(`loading ${key}`)

  // Wait for Electric to be active
  let electric
  try {
    electric = (await electricPromise) as Electric
  } catch (e) {
    return
  }

  const { db } = electric

  const resolvedShapes = shapes({ db })

  async function syncTables() {
    const syncPromises = await Promise.all(
      resolvedShapes.map((shape) => shape.shape)
    )
    await Promise.all(syncPromises.map((shape) => shape.synced))
  }

  let isReadies = [false]
  try {
    isReadies = await Promise.all(
      resolvedShapes.map((shape) => shape.isReady())
    )
  } catch (e) {
    console.log(`a isReady failed... so probably it's not ready`, e)
  }

  // Check if all isReadies are true
  if (isReadies.every((isReady) => isReady === true)) {
    // Start syncing but don't block rendering the app on it.
    Promise.resolve().then(() => syncTables())
  } else {
    await syncTables()
  }

  const setupQueries = queries({ db })
  queriesMap.set(key, setupQueries)

  // Run queries
  const promises = Object.entries(setupQueries).map(([_key, func]) => {
    if (typeof func === `function`) {
      return func()
      // I.e. it is a promise from db.raw
    } else {
      return Promise.resolve(func).then((result) => {
        return { result }
      })
    }
  })
  const resolvedPromises = await Promise.all(promises)
  const queryResults = Object.fromEntries(
    resolvedPromises.map((result, i) => [
      Object.keys(setupQueries)[i],
      result.result,
    ])
  )

  routeCache.set(key, queryResults)
  console.timeEnd(`loading ${key}`)
}

export function useElectricData(key: string) {
  const queriesMapResult = queriesMap.get(key)

  if (!queriesMapResult) {
    throw new Error(`Queries not found for ${key}.`)
  }

  const cachedResult = routeCache.get(key)

  if (!cachedResult) {
    throw new Error(
      `precached query results not found for ${key}. Check your loader code to make sure it's caching correctly`
    )
  }

  // Call useLiveQuery for each query.
  const results = Object.keys(queriesMapResult).map((key) => {
    const query = queriesMapResult[key]
    let resultsReal
    if (typeof query === `function`) {
      // We're living dangerously.
      // eslint-disable-next-line
      const { results } = useLiveQuery(query);
      resultsReal = results
    } else {
      resultsReal = cachedResult[key]
    }
    return [key, resultsReal]
  })

  // Use cached results until all the live queries
  // have returned results.
  if (results.some((r) => r[1] === undefined)) {
    return cachedResult
  } else {
    return Object.fromEntries(results)
  }
}
