import { useEffect, useRef } from 'react'

export function useThree(SceneClass, options) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    sceneRef.current = new SceneClass(el, options)

    const onResize = () => sceneRef.current?.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- SceneClass and options are stable init args

  return { mountRef, sceneRef }
}
