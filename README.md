# electric-query
Library for integrating ElectricSQL queries with your (React) routes


```ts
import { initElectric, setLoggedOut } from "electric-query"
import { Electric, schema } from "./generated/client"
import sqliteWasm from "wa-sqlite/dist/wa-sqlite-async.wasm?asset"

if (loggedIn) {
    const electric = await initElectric({
        appName: `my-app`,
        schema,
        sqlWasmPath: sqliteWasm,
        config: {
          auth: {
            token,
          },
          debug: false, //DEBUG_MODE,
          url: electricUrl,
        }
    })
} else {
  setLoggedOut()
}

// In routes
[
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
        queries: ({ db }) =>
          Video.queries({ db, id: props.params.videoId }),
      })

      return null
    },
  },
]

// In route components
import { useElectricData } from "electric-query"
import { useLocation } from "react-router-dom"
import { Electric, schema } from "../generated/client"

const queries = ({ db, props }: { db: Electric[`db`] }) => {
  return {
    foo: db.my_table.liveMany(),
  }
}

export default function Component () {
  const location = useLocation()
  const { foo } = useElectricData(
    location.pathname + location.search
  )

  return JSON.stringify(foo, null, 4)
}

Component.queries = queries

```
