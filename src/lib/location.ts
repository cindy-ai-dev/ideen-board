export function formatPartyAddress(streetAddress: string, city: string): string {
  const street = streetAddress.trim()
  const town = city.trim()
  if (street && town) return `${street}, ${town}`
  return street || town || ''
}

