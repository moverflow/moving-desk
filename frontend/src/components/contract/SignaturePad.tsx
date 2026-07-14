import type { JSX } from 'react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

const CANVAS_HEIGHT = 160

// Lightweight signature pad built on a raw <canvas> + Pointer Events, so it
// works for mouse and touch with no third-party dependency. The bitmap is
// sized to the element's CSS width × devicePixelRatio for crisp strokes.
const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_props, ref): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  function getContext(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext('2d') ?? null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = CANVAS_HEIGHT * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, CANVAS_HEIGHT)
  }, [])

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current
      const ctx = getContext()
      if (!canvas || !ctx) return
      const ratio = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      ctx.scale(ratio, ratio)
      dirty.current = false
    },
    isEmpty() {
      return !dirty.current
    },
    toDataURL() {
      return canvasRef.current?.toDataURL('image/png') ?? ''
    },
  }))

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pointFromEvent(e)
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current) return
    const ctx = getContext()
    const from = last.current
    if (!ctx || !from) return
    const to = pointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    last.current = to
    dirty.current = true
  }

  function handleUp(): void {
    drawing.current = false
    last.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      style={{
        width: '100%',
        height: CANVAS_HEIGHT,
        border: '1px solid #ccc',
        borderRadius: 8,
        touchAction: 'none',
        background: 'white',
      }}
    />
  )
})

export default SignaturePad
