// Crockford's alphabet minus the vowels: no 0/O, 1/I/L or accidental words on a printed card.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 8

export const IHP_ID_PATTERN = new RegExp(`^IHP-[${ALPHABET}]{${LENGTH}}$`)

// A company ID is printed and read aloud, so it is generated once and never reissued.
export function generateIhpId() {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH))
  let id = ''
  for (const byte of bytes) {
    // Modulo bias over 30 symbols is ~4% per character, which no one can exploit in an opaque id.
    id += ALPHABET[byte % ALPHABET.length]
  }
  return `IHP-${id}`
}
