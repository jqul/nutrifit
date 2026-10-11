import { describe, expect, it } from 'vitest'
import { detectColumns, detectDelimiter, parseCSV, stripAccents } from './spreadsheet'

describe('parseCSV', () => {
  it('reads commas and semicolons, as Spanish Excel exports them', () => {
    expect(parseCSV('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
    expect(parseCSV('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('keeps decimal commas inside a semicolon file, as Spanish Excel writes them', () => {
    expect(parseCSV('Cliente;Fecha;Peso\nLaura;01/09/2026;70,5')).toEqual([['Cliente', 'Fecha', 'Peso'], ['Laura', '01/09/2026', '70,5']])
  })
  it('reads tab-separated files and ignores a byte-order mark', () => {
    expect(parseCSV('﻿a\tb\n1,5\t2')).toEqual([['a', 'b'], ['1,5', '2']])
  })
  it('keeps quoted fields together, with commas, line breaks and doubled quotes inside', () => {
    expect(parseCSV('n,nota\n"Pérez, Ana","dijo ""hola""\nadiós"')).toEqual([['n', 'nota'], ['Pérez, Ana', 'dijo "hola"\nadiós']])
  })
  it('handles Windows line endings and a missing final newline', () => {
    expect(parseCSV('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCSV('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('detectDelimiter', () => {
  it('chooses by the header line, outside quotes', () => {
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('"Pérez, Ana";fecha')).toBe(';')
    expect(detectDelimiter('solo')).toBe(',')
  })
})

describe('detectColumns', () => {
  const aliases = { name: ['nombre', 'name'], weight: ['peso (kg)', 'peso'] }
  it('finds the columns in any order, ignoring case and accents', () => {
    expect(detectColumns(['Peso (kg)', ' NOMBRE '], aliases)).toEqual({ weight: 0, name: 1 })
    expect(stripAccents('Teléfono')).toBe('Telefono')
  })
  it('leaves out the fields without a column', () => {
    expect(detectColumns(['Nombre', 'Otra'], aliases)).toEqual({ name: 0 })
  })
})
