import { deleteApp, type FirebaseApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import {
  arrayUnion,
  connectFirestoreEmulator,
  doc,
  type Firestore,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addStopTo, allStops, findStop, hasSpotOn, moveStop, placesOf, removeStop, type Stop, type StopPos, type Trip } from './trip'

// 行程共編（UX-FLOW.md C7）：兩個人同時加地點、拖曳換天時，stores/trips.ts 的 mutate（交易裡讀最新的一份再寫回）
// 不會互相蓋掉。要開 Firestore／Auth emulator（firestore.rules 照樣生效）：
//   npx firebase emulators:start --project demo-hitomeguri --only auth,firestore
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/services/collab.emu.test.ts
const HOST = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.FIRESTORE_EMULATOR_HOST

interface Client {
  app: FirebaseApp
  db: Firestore
  uid: string
}

async function client(name: string): Promise<Client> {
  const app = initializeApp({ apiKey: 'emulator', projectId: 'demo-hitomeguri', authDomain: 'localhost' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  const [host, port] = HOST!.split(':')
  connectFirestoreEmulator(db, host!, Number(port))
  const cred = await createUserWithEmailAndPassword(auth, `${name}-${Date.now()}@example.com`, 'password')
  return { app, db, uid: cred.user.uid }
}

const stop = (id: string): Stop => ({ type: 'catalog', spot_id: id, pref: 'kyoto', name: id })

/** stores/trips.ts 的 mutate：交易裡讀最新的一份、套用 fn、寫回 */
async function mutate(c: Client, id: string, fn: (t: Trip) => Partial<Trip> | null) {
  const ref = doc(c.db, 'trips', id)
  await runTransaction(c.db, async (tx) => {
    const snap = await tx.get(ref)
    const x = snap.data()!
    const t = { ...x, id, days: x.days, unscheduled: x.unscheduled } as Trip
    const patch = fn(t)
    if (!patch) return
    const n = { ...t, ...patch }
    tx.update(ref, { days: n.days, unscheduled: n.unscheduled, updated_at: serverTimestamp() })
  })
}

/** TripView 的 moveSpot：以景點 id 找到它現在的位置再移（對方可能已經動過） */
function moveSpot(c: Client, id: string, spotId: string, fromDay: number, to: (t: Trip, cur: StopPos) => StopPos | null) {
  return mutate(c, id, (t) => {
    const from = findStop(t, spotId, fromDay)
    const dest = from && to(t, from)
    if (!from || !dest || (dest.day !== from.day && hasSpotOn(t, dest.day, spotId))) return null
    return moveStop(t, from, dest)
  })
}
const toEnd = (day: number) => (t: Trip) => ({ day, idx: day === -1 ? t.unscheduled.length : t.days[day]!.stops.length })

async function read(c: Client, id: string): Promise<Trip> {
  const snap = await getDoc(doc(c.db, 'trips', id))
  return snap.data() as Trip
}

describe.skipIf(!HOST)('行程共編：兩個人同時編輯（emulator）', () => {
  let a: Client
  let b: Client
  let tripId: string

  beforeAll(async () => {
    a = await client('a')
    b = await client('b')
    // A 建立行程（三天）、產生邀請；B 用邀請加入（同 stores/trips.ts 的 create、invite、join）
    tripId = `collab-${Date.now()}`
    await setDoc(doc(a.db, 'trips', tripId), {
      name: '共編測試',
      status: 'planning',
      days: [{ stops: [] }, { stops: [] }, { stops: [] }],
      unscheduled: [],
      owner: a.uid,
      members: [a.uid],
      member_info: { [a.uid]: { name: 'A' } },
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    const code = `code${Date.now()}`
    await setDoc(doc(a.db, 'invites', code), { trip_id: tripId, trip_name: '共編測試', inviter: 'A', created_by: a.uid, created_at: serverTimestamp() })
    await updateDoc(doc(a.db, 'trips', tripId), { invite: code, updated_at: serverTimestamp() })
    await updateDoc(doc(b.db, 'trips', tripId), {
      members: arrayUnion(b.uid),
      [`member_info.${b.uid}`]: { name: 'B', via: code },
      updated_at: serverTimestamp(),
    })
  }, 30000)

  afterAll(async () => {
    for (const c of [a, b]) {
      if (!c) continue
      await terminate(c.db)
      await deleteApp(c.app)
    }
  })

  it('同時各加 10 個地點：20 個都在', async () => {
    const adds = [
      ...Array.from({ length: 10 }, (_, i) => mutate(a, tripId, (t) => addStopTo(t, stop(`a${i}`), i % 3))),
      ...Array.from({ length: 10 }, (_, i) => mutate(b, tripId, (t) => addStopTo(t, stop(`b${i}`), null))),
    ]
    await Promise.all(adds)
    const t = await read(a, tripId)
    const ids = allStops(t).map((s) => s.spot_id).sort()
    expect(ids).toEqual([...Array.from({ length: 10 }, (_, i) => `a${i}`), ...Array.from({ length: 10 }, (_, i) => `b${i}`)].sort())
  }, 30000)

  it('同時拖不同的地點換天：兩邊的移動都保留', async () => {
    await Promise.all([
      moveSpot(a, tripId, 'a0', 0, toEnd(2)),
      moveSpot(b, tripId, 'b0', -1, toEnd(1)),
      moveSpot(a, tripId, 'a1', 1, toEnd(-1)),
      moveSpot(b, tripId, 'b1', -1, toEnd(0)),
    ])
    const t = await read(b, tripId)
    expect(placesOf(t, 'a0')).toEqual([2])
    expect(placesOf(t, 'b0')).toEqual([1])
    expect(placesOf(t, 'a1')).toEqual([-1])
    expect(placesOf(t, 'b1')).toEqual([0])
    expect(allStops(t)).toHaveLength(20)
  }, 30000)

  it('兩個人同時把同一個地點拖到不同天：只在其中一天，不會變兩個或不見', async () => {
    await Promise.all([moveSpot(a, tripId, 'b2', -1, toEnd(0)), moveSpot(b, tripId, 'b2', -1, toEnd(2))])
    const t = await read(a, tripId)
    const at = placesOf(t, 'b2')
    expect(at).toHaveLength(1)
    expect([0, 2]).toContain(at[0])
    expect(allStops(t)).toHaveLength(20)
  }, 30000)

  it('一個人移除、另一個人同時拖同一個地點：移除後不會被拖回來', async () => {
    await Promise.all([
      mutate(a, tripId, (t) => {
        const cur = findStop(t, 'b3', -1)
        return cur ? removeStop(t, cur) : null
      }),
      moveSpot(b, tripId, 'b3', -1, toEnd(1)),
    ])
    const t = await read(b, tripId)
    // 先移除：拖曳找不到就不做。先拖到 DAY 2：移除照樣找得到它（findStop 會找別天）一起拿掉
    const left = placesOf(t, 'b3')
    expect(left).toEqual([])
    expect(allStops(t)).toHaveLength(19)
  }, 30000)

  it('對方的修改即時出現在自己的畫面（onSnapshot）', async () => {
    const seen = new Promise<Trip>((resolve) => {
      const off = onSnapshot(doc(b.db, 'trips', tripId), (snap) => {
        const t = snap.data() as Trip
        if (allStops(t).some((s) => s.spot_id === 'live')) {
          off()
          resolve(t)
        }
      })
    })
    await mutate(a, tripId, (t) => addStopTo(t, stop('live'), 0))
    const t = await seen
    expect(placesOf(t, 'live')).toEqual([0])
  }, 30000)

  it('不是成員的人讀不到也改不了', async () => {
    const c = await client('c')
    await expect(getDoc(doc(c.db, 'trips', tripId))).rejects.toThrow()
    await expect(mutate(c, tripId, (t) => addStopTo(t, stop('x'), 0))).rejects.toThrow()
    await terminate(c.db)
    await deleteApp(c.app)
  }, 30000)
})
