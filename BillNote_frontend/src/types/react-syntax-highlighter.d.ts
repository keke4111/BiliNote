declare module 'react-syntax-highlighter' {
  import type { ComponentType, HTMLAttributes } from 'react'

  export const Prism: ComponentType<HTMLAttributes<HTMLElement>>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const atomDark: Record<string, unknown>
}
