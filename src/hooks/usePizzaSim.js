// usePizzaSim.js — React hook bridging pizzaSim engine to React rendering
// Owns the RAF loop, exposes actions, and manages scene lifecycle handoff.

import { useEffect, useRef, useState, useCallback } from 'react'
import { freshSim, resetSimData, step, applyTocAction, revertTocAction } from '../sim/pizza/pizzaSim.js'

export function usePizzaSim(initialRound = 1) {
  // ── React state (triggers re-renders) ──────────────────────────────────────
  const [simState, setSimState] = useState(() => freshSim(initialRound))
  const [running, setRunning] = useState(false)
  const [round, setRoundState] = useState(initialRound)
  const [showCfd, setShowCfdState] = useState(false)

  // ── Refs (accessible inside RAF without stale closures) ───────────────────
  const simStateRef = useRef(simState)
  const sceneRef = useRef(null)
  const animIdRef = useRef(null)
  const lastTRef = useRef(null)
  const runningRef = useRef(false)
  const roundRef = useRef(initialRound)
  const loopRef = useRef(null)
  // Persists each round's state across round switches so switching back restores progress
  const savedRoundStatesRef = useRef({ [initialRound]: simState })

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const loop = useCallback((now) => {
    animIdRef.current = requestAnimationFrame(loopRef.current)
    if (!runningRef.current) {
      // Render the static scene even when paused (keeps Three.js canvas visible)
      if (sceneRef.current) sceneRef.current.syncState(simStateRef.current, 0)
      return
    }
    const dt = Math.min((now - (lastTRef.current || now)) / 1000, 0.05)
    lastTRef.current = now
    const next = step(simStateRef.current, dt)
    simStateRef.current = next
    if (sceneRef.current) sceneRef.current.syncState(next, dt)
    setSimState(next)
    if (next.finished) {
      runningRef.current = false
      setRunning(false)
    }
  }, [])

  // ── Lifecycle: keep loopRef current so the RAF self-reschedule never goes stale ─
  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  // ── Lifecycle: start/stop RAF ─────────────────────────────────────────────
  useEffect(() => {
    animIdRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animIdRef.current)
      animIdRef.current = null
    }
  }, [loop])

  // ── Actions ───────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    runningRef.current = true
    setRunning(true)
    if (!animIdRef.current) {
      animIdRef.current = requestAnimationFrame(loop)
    }
  }, [loop])

  const pause = useCallback(() => {
    runningRef.current = false
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(animIdRef.current)
    animIdRef.current = null
    lastTRef.current = null
    const current = simStateRef.current
    const base = current.toc ? resetSimData(current) : freshSim(roundRef.current)
    // Preserve the WIP caps the player set — only reset pizzas/time/history
    const fresh = {
      ...base,
      stations: base.stations.map((st, i) => ({
        ...st,
        cap: current.stations[i]?.cap ?? st.cap,
      })),
    }
    savedRoundStatesRef.current[roundRef.current] = fresh
    simStateRef.current = fresh
    setSimState(fresh)
    if (sceneRef.current) sceneRef.current.loadRound(roundRef.current, fresh)
  }, [])

  const setRound = useCallback((num) => {
    // Save current round's state before switching
    savedRoundStatesRef.current[roundRef.current] = simStateRef.current

    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(animIdRef.current)
    animIdRef.current = null
    lastTRef.current = null

    roundRef.current = num
    setRoundState(num)

    // Restore saved state for the target round, or start fresh if never visited
    const restored = savedRoundStatesRef.current[num] ?? freshSim(num)
    simStateRef.current = restored
    setSimState(restored)

    if (sceneRef.current) sceneRef.current.loadRound(num, restored)
  }, [])

  const setWipLimit = useCallback((stationIndex, value) => {
    const current = simStateRef.current
    if (current.mode !== 'pull') return
    // Station 3 (bake) has fixedCap — refuse changes
    if (current.stations[stationIndex]?.fixedCap) return
    const updatedStations = current.stations.map((s, i) =>
      i === stationIndex ? { ...s, cap: value } : s
    )
    const updated = { ...current, stations: updatedStations }
    simStateRef.current = updated
    setSimState(updated)
  }, [])

  const tocNext = useCallback(() => {
    const current = simStateRef.current
    if (!current.toc) return
    const nextStep = current.tocStep + 1
    if (nextStep > 4) return
    const next = applyTocAction(simStateRef.current, nextStep)
    simStateRef.current = next
    setSimState(next)
    // If moving to Identify step (0) and not running, start the sim
    if (nextStep === 0 && !runningRef.current) {
      runningRef.current = true
      setRunning(true)
      if (!animIdRef.current) {
        animIdRef.current = requestAnimationFrame(loop)
      }
    }
  }, [loop])

  // Apply any specific ToC step directly (allows per-step toggles in the UI)
  const applyTocStep = useCallback((stepIndex) => {
    const current = simStateRef.current
    if (!current.toc) return
    const next = applyTocAction(current, stepIndex)
    simStateRef.current = next
    setSimState(next)
    if (stepIndex === 0 && !runningRef.current) {
      runningRef.current = true
      setRunning(true)
      if (!animIdRef.current) {
        animIdRef.current = requestAnimationFrame(loop)
      }
    }
  }, [loop])

  // Revert a structural ToC action (Subordinate or Elevate)
  const revertToc = useCallback((stepIndex) => {
    const current = simStateRef.current
    if (!current.toc) return
    const next = revertTocAction(current, stepIndex)
    simStateRef.current = next
    setSimState(next)
  }, [])

  const tocPrev = useCallback(() => {
    const current = simStateRef.current
    if (!current.toc) return
    const prevStep = current.tocStep - 1
    if (prevStep < 0) return
    // Only reverse the tocStep visually — no structural undo of sim changes
    const updated = { ...simStateRef.current, tocStep: prevStep }
    simStateRef.current = updated
    setSimState(updated)
  }, [])

  const setToc = useCallback((enabled) => {
    const current = simStateRef.current
    if (enabled) {
      const updated = { ...current, toc: true, tocStep: -1 }
      simStateRef.current = updated
      setSimState(updated)
    } else {
      const updated = { ...current, toc: false, tocStep: -1, constraint: -1 }
      simStateRef.current = updated
      setSimState(updated)
    }
  }, [])

  const setShowCfd = useCallback((bool) => {
    setShowCfdState(bool)
  }, [])

  // ── Return value ──────────────────────────────────────────────────────────
  return {
    simState,
    running,
    round,
    showCfd,
    sceneRef,
    start,
    pause,
    reset,
    setRound,
    setWipLimit,
    tocNext,
    tocPrev,
    setToc,
    setShowCfd,
    applyTocStep,
    revertToc,
  }
}

// ── Pure coaching helper (module-level, not part of the hook) ─────────────

export function getCoachingMessage(simState) {
  const { mode, stations, toc, tocStep } = simState

  // ToC mode messages take priority
  if (toc && tocStep >= 0) {
    switch (tocStep) {
      case 0:
        return { level: 'info', text: 'Constraint identified. Observe the ring — that station limits your throughput.' }
      case 1:
        return { level: 'info', text: 'Exploit: keep the constraint fed and never idle. Clear upstream blockers now.' }
      case 2:
        return { level: 'success', text: 'Subordinating upstream: intake slowed to feed constraint\'s exact pace. Watch upstream piles drain.' }
      case 3:
        return { level: 'success', text: 'Elevated: constraint has more capacity. Throughput should climb noticeably.' }
      case 4:
        return { level: 'info', text: 'Constraint moved! The ring shifted. Repeat the five steps for continuous improvement.' }
    }
  }

  // Push vs Pull messages
  const maxBuffer = Math.max(...stations.map(s => s.buffer.length))
  if (mode === 'push') {
    if (maxBuffer >= 3) return { level: 'warn', text: 'Push chaos: queues are piling up at the Oven. Pizzas are getting cold while they wait!' }
    return { level: 'info', text: 'Push mode running. Watch what happens as queues grow at the bottleneck.' }
  }

  // Pull mode
  const anyHighWip = stations.some((s, i) => i > 0 && s.cap < 99 && s.cap >= 4)
  if (anyHighWip) return { level: 'warn', text: 'High WIP limits: queues are growing. Try reducing limits to 2-3 for better flow.' }

  if (maxBuffer === 0 && simState.delivered > 5)
    return { level: 'success', text: 'Balanced flow! Pull discipline is working — no queues, steady delivery.' }

  return { level: 'info', text: 'Pull mode: WIP limits prevent queue buildup. Watch lead time vs Round 1.' }
}
