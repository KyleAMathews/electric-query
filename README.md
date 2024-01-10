# electric-query
Library for deeply integrating [ElectricSQL](https://electric-sql.com/) partial syncing and queries with your React app routes.

## Install

`npm install electric-query`

## Why

This library makes it easy to sync and query the exact data that's needed for each route.

The simplest way to build an ElectricSQL app is to sync upfront all data. But this gets slow as for larger apps. So just like code splitting, you can split data syncing along route boundaries so the user waits for only the minimal amount of data to be synced.

ElectricSQL has this concept of “[Shapes](https://electric-sql.com/docs/usage/data-access/shapes)” — which let you declare the shape of data you want synced to construct a particular route’s UI. It’s basically the declarative equivalent of making an API call (an imperative operation). Instead of saying “fetch this shape of data”, you say “sync this shape of data”. You get the same initial load but ElectricSQL also ensures any updates across the system continue to get synced to you in real-time.

## Usage

The library exposes an `initElectric` function which takes care of initializing
Electric.

```ts
import { initElectric, setLoggedOut } from "electric-query"
import { Electric, schema } from "./generated/client"
import sqliteWasm from "wa-sqlite/dist/wa-sqlite-async.wasm?asset"

if (loggedIn) {
  const electric = await initElectric({
    appName: `my-app`,
    schema,
    sqliteWasmPath: sqliteWasm,
    config: {
      auth: {
        token,
      },
      debug: false, //DEBUG_MODE,
      url: electricUrl,
    },
  })
} else {
  setLoggedOut()
}
```

In the `loader` (or equivalent) function for each route, you define the sync shapes
and queries for each route. Electric Query ensures both are finished before
calling your route component. This means the new route can immediately render
without any blinking.

```ts
// In routes
const routes = [
  ...otherRoutes,
  {
    path: `/type/:id`,
    element: <Type />,
    loader: async (props) => {
      const url = new URL(props.request.url)
      const key = url.pathname + url.search
      await electricSqlLoader<Electric>({
        key,
        shapes: ({ db }) => [
          {
            shape: db.youtube_videos.sync(),
            // Check that at least one video is synced.
            // Eventually Electric will probably have metadata on synced status
            // we can check.
            isReady: async () => !!(await db.youtube_videos.findFirst()),
          },
        ],
        queries: ({ db }) => Video.queries({ db, id: props.params.videoId }),
      })

      return null
    },
  },
]
```

Each route component then uses an `useElectricData` hook to get the results
of the queries.

For easy reading, we suggest you write component queries alongside the UI code.

```ts
// In route components
import { useElectricData } from "electric-query"
import { useLocation } from "react-router-dom"
import { Electric, schema } from "../generated/client"

const queries = ({ db }: { db: Electric[`db`] }) => {
  return {
    foo: db.my_table.liveMany(),
  }
}

export default function Component() {
  const location = useLocation()
  const { foo } = useElectricData(location.pathname + location.search)

  return JSON.stringify(foo, null, 4)
}

Component.queries = queries
```

For a full example of using this library, see this starter https://github.com/KyleAMathews/vite-react-router-electric-sql-starter
