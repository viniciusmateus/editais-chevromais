import { useEffect, useRef, useState } from 'react'
import { horaValida, isoValida } from '../shared'

/**
 * Campos de data e hora com formato fixo, independente do idioma do navegador:
 * data dd/MM/aaaa e hora HH:mm (24 horas). O valor que sobe para o formulário é sempre
 * AAAA-MM-DD / HH:mm (ou '' enquanto estiver vazio ou incompleto).
 */

const isoToBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

function brToIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return ''
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  return isoValida(iso) ? iso : ''
}

function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.slice(0, 2) + (d.length > 2 ? '/' + d.slice(2, 4) : '') + (d.length > 4 ? '/' + d.slice(4) : '')
}

function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.slice(0, 2) + (d.length > 2 ? ':' + d.slice(2) : '')
}

interface Props {
  value: string
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

function MaskedInput({
  value,
  onChange,
  required,
  disabled,
  className,
  toText,
  toValue,
  mask,
  length,
  placeholder,
  erro,
}: Props & {
  toText: (v: string) => string
  toValue: (t: string) => string
  mask: (t: string) => string
  length: number
  placeholder: string
  erro: string
}) {
  const [text, setText] = useState(toText(value))
  const ref = useRef<HTMLInputElement>(null)

  // valor trocado por fora (ex.: ao escolher outro edital): atualiza o texto
  useEffect(() => {
    if (toValue(text) !== value) setText(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // texto preenchido pela metade ou inválido bloqueia o envio do formulário
  useEffect(() => {
    ref.current?.setCustomValidity(text && !toValue(text) ? erro : '')
  }, [text, toValue, erro])

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={length}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={text}
      onChange={(e) => {
        const t = mask(e.target.value)
        setText(t)
        onChange(toValue(t))
      }}
    />
  )
}

export function DateInput(p: Props) {
  return (
    <MaskedInput
      {...p}
      toText={isoToBr}
      toValue={brToIso}
      mask={maskDate}
      length={10}
      placeholder="dd/mm/aaaa"
      erro="Data inválida. Use o formato dd/mm/aaaa."
    />
  )
}

const toTime = (t: string) => (horaValida(t) ? t : '')

export function TimeInput(p: Props) {
  return (
    <MaskedInput
      {...p}
      toText={(v) => v}
      toValue={toTime}
      mask={maskTime}
      length={5}
      placeholder="hh:mm"
      erro="Horário inválido. Use 24 horas, hh:mm (ex.: 14:30)."
    />
  )
}
