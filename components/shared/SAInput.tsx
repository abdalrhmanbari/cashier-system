'use client'

import React from 'react'

const SA: React.CSSProperties = {
  background: 'var(--diamond)', border: '1px solid var(--border-color)', color: 'var(--text)',
  borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%',
}

export function SAInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={{ ...SA, ...((props.style as object) ?? {}) }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--cerulean)')}
      onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border-color)')} />
  )
}

export function SASelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...SA, cursor: 'pointer', ...((props.style as object) ?? {}) }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--cerulean)')}
      onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border-color)')} />
  )
}

export function SATextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{ ...SA, resize: 'none', ...((props.style as object) ?? {}) }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--cerulean)')}
      onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border-color)')} />
  )
}
