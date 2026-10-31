/** Prefer the Google provider's current profile photo, then Firebase's user photo. */
export const getGooglePhotoURL = (user) => {
  const googleProvider = user?.providerData?.find(({ providerId }) => providerId === 'google.com')
  return googleProvider?.photoURL || user?.photoURL || ''
}

export const hasGoogleProvider = (user) =>
  Boolean(user?.providerData?.some(({ providerId }) => providerId === 'google.com'))
