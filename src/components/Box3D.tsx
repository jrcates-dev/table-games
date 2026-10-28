import type { CSSProperties, ReactNode } from 'react'

/**
 * A box standing on a tilted plane, built from CSS faces.
 *
 * Lives inside a `preserve-3d` plane whose +Z is the felt's normal: the top
 * face is lifted by the box's height, and each side is folded down from it.
 * Only the faces a seated player can see are drawn — the top, the front and
 * the two ends — because the back of a shoe is never on screen.
 */
export interface BoxFaces {
  top?: ReactNode
  front?: ReactNode
  left?: ReactNode
  right?: ReactNode
  back?: ReactNode
}

export function Box3D({
  w,
  d,
  h,
  faces,
  className,
  style,
  faceClassName = 'box3d__face',
}: {
  /** Width (x), depth (y, toward the player) and height (z). */
  w: number
  d: number
  h: number
  faces: BoxFaces
  className?: string
  style?: CSSProperties
  faceClassName?: string
}) {
  const face = (key: string, width: number, height: number, transform: string, content: ReactNode) => (
    <div
      key={key}
      className={`${faceClassName} ${faceClassName}--${key}`}
      style={{
        position: 'absolute',
        left: -width / 2,
        top: -height / 2,
        width,
        height,
        transform,
      }}
    >
      {content}
    </div>
  )

  return (
    <div className={`box3d${className ? ` ${className}` : ''}`} style={{ position: 'absolute', transformStyle: 'preserve-3d', ...style }}>
      {faces.back !== undefined && face('back', w, h, `translate3d(0, ${-d / 2}px, ${h / 2}px) rotateX(90deg)`, faces.back)}
      {faces.left !== undefined && face('left', d, h, `translate3d(${-w / 2}px, 0, ${h / 2}px) rotateY(-90deg) rotateZ(90deg)`, faces.left)}
      {faces.right !== undefined && face('right', d, h, `translate3d(${w / 2}px, 0, ${h / 2}px) rotateY(90deg) rotateZ(90deg)`, faces.right)}
      {faces.front !== undefined && face('front', w, h, `translate3d(0, ${d / 2}px, ${h / 2}px) rotateX(-90deg)`, faces.front)}
      {faces.top !== undefined && face('top', w, d, `translateZ(${h}px)`, faces.top)}
    </div>
  )
}
