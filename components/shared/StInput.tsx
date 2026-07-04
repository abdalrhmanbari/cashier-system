'use client'

import React from 'react'

const ST: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  borderRadius: 'var(--r-s)',
  padding: '7px 10px',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--f)',
  transition: 'border-color .15s, box-shadow .15s',
}

export function StInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...ST, ...(props.style as object ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--indigo-g)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  )
}

export function StSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{ ...ST, cursor: 'pointer', ...(props.style as object ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--indigo-g)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  )
}

export function StTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{ ...ST, resize: 'none', ...(props.style as object ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--indigo-g)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  )
}