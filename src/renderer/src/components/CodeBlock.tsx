import { useState } from 'react'

interface Props {
  code: string
}

export function CodeBlock({ code }: Props): JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="code-block">
      <pre><code>{code}</code></pre>
      <button className="copy-btn" onClick={copy} title="Copy">
        {copied ? '✓ copied' : 'copy'}
      </button>
    </div>
  )
}
